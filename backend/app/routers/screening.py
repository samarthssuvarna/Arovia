import uuid
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from ..db import get_conn
from ..dr import engine
from ..security import get_current_provider

router = APIRouter(prefix="/screenings", tags=["DR screening"])

STORE = engine.BACKEND_DIR / "storage" / "screenings"
MAX_BYTES = 8 * 1024 * 1024
GRADE_NAMES = engine.GRADE_NAMES


def log(conn, provider_id, patient_id, action, reason, granted=True):
    conn.execute(
        """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
           VALUES (%s, %s, %s, %s, %s)""",
        (provider_id, patient_id, action, reason, granted),
    )


def require_consent(conn, provider, patient_id, action, reason):
    """Same rule as the patient history: no consent, no access, and the
    attempt is logged and committed before the 403 is raised."""
    if provider["role"] == "admin":
        raise HTTPException(403, "Admins cannot view or create clinical screenings")
    if not conn.execute("SELECT 1 FROM patients WHERE patient_id = %s", (patient_id,)).fetchone():
        raise HTTPException(404, "Patient not found")
    allowed = conn.execute(
        "SELECT has_valid_consent(%s, %s) AS ok", (provider["provider_id"], patient_id)
    ).fetchone()["ok"]
    if not allowed:
        log(conn, provider["provider_id"], patient_id, action, reason, granted=False)
        conn.commit()
        raise HTTPException(403, "No valid consent for this patient. The attempt has been logged.")


URGENCY = {2: "routine", 3: "urgent", 4: "emergency"}


def auto_referral(conn, me, patient_id, screening, grade, confidence, version):
    """Grade 2 or above: create (or reuse) a referral to an ophthalmologist.
    Runs inside the same transaction as the screening insert, so the
    screening, the referral and the audit rows are saved together or not at all.
    Returns (referral dict or None, message or None)."""
    if grade < 2:
        return None, None

    target = conn.execute(
        """SELECT provider_id, name FROM providers
           WHERE is_active AND role = 'doctor' AND specialty ILIKE 'ophthalm%%'
             AND provider_id <> %s
           ORDER BY provider_id LIMIT 1""",
        (me,),
    ).fetchone()
    if not target:
        return None, f"Grade {grade} found, but there is no other ophthalmologist to refer to."

    existing = conn.execute(
        """SELECT referral_id, urgency FROM referrals
           WHERE patient_id = %s AND to_provider = %s AND source = 'ai_dr'
             AND status IN ('pending', 'accepted')
           ORDER BY created_at DESC LIMIT 1""",
        (patient_id, target["provider_id"]),
    ).fetchone()
    if existing:
        # A worse finding must never sit under a lower-priority referral.
        # Urgency can be raised here, never lowered.
        rank = {"routine": 0, "urgent": 1, "emergency": 2}
        wanted, old = URGENCY[grade], existing["urgency"]
        if rank[wanted] > rank[old]:
            conn.execute("UPDATE referrals SET urgency = %s WHERE referral_id = %s",
                         (wanted, existing["referral_id"]))
            log(conn, me, patient_id, "update_referral",
                f"Referral #{existing['referral_id']}: urgency raised {old} -> {wanted} "
                f"after screening #{screening['screening_id']} (grade {grade})")
            msg = (f"An open referral to {target['name']} already existed. "
                   f"Its urgency was raised from {old} to {wanted}.")
        else:
            wanted = old
            msg = f"An open AI referral to {target['name']} already exists, so this screening was linked to it."
        return (
            {"referral_id": existing["referral_id"], "to_provider_name": target["name"],
             "urgency": wanted, "existing": True},
            msg,
        )

    reason = (f"AI diabetic eye screening: grade {grade} ({GRADE_NAMES[grade]}), "
              f"confidence {round(confidence * 100)}%. Screening #{screening['screening_id']}. "
              f"Please review the retinal image.")
    if version.startswith("demo"):
        reason += " [Demo model, not a clinical result]"

    ref = conn.execute(
        """INSERT INTO referrals (patient_id, from_provider, to_provider, reason, urgency, source)
           VALUES (%s, %s, %s, %s, %s, 'ai_dr') RETURNING referral_id, urgency""",
        (patient_id, me, target["provider_id"], reason, URGENCY[grade]),
    ).fetchone()
    log(conn, me, patient_id, "create_referral",
        f"Referral #{ref['referral_id']} to {target['name']} created automatically from screening #{screening['screening_id']}")
    return (
        {"referral_id": ref["referral_id"], "to_provider_name": target["name"],
         "urgency": ref["urgency"], "existing": False},
        f"Grade {grade} ({GRADE_NAMES[grade]}): a {ref['urgency']} referral was sent to {target['name']}.",
    )


def shape(row):
    row["grade_name"] = GRADE_NAMES[row["dr_grade"]]
    row["is_demo"] = row["model_version"].startswith("demo")
    row["has_image"] = True
    return row


@router.get("/status")
def model_status(provider=Depends(get_current_provider)):
    """Tells the screen whether the real model or the demo model is running."""
    model, version = engine.get_model()
    return {"model_version": version, "is_demo": version == "demo-untrained"}


@router.post("/patients/{patient_id}", status_code=201)
def create_screening(
    patient_id: int,
    file: UploadFile = File(...),
    simulate_grade: Optional[int] = Query(None, ge=0, le=4),
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Upload a retinal image. The model grades it (0 to 4), draws a Grad-CAM
    heatmap, and the result is saved. In demo mode a grade can be simulated
    so the whole flow can be shown; that is recorded in model_version."""
    me = provider["provider_id"]
    require_consent(conn, provider, patient_id, "dr_screening", "DR screening upload")

    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image is larger than 8 MB")
    try:
        Image.open(BytesIO(data)).verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "That file is not a valid image (use JPG or PNG)")

    grade, confidence, probs, original, heatmap, version = engine.analyse(data)

    if simulate_grade is not None:
        if version != "demo-untrained":
            raise HTTPException(400, "Grade simulation is only available with the demo model")
        grade, version = simulate_grade, "demo-simulated"

    STORE.mkdir(parents=True, exist_ok=True)
    key = uuid.uuid4().hex
    img_path, cam_path = STORE / f"{key}.jpg", STORE / f"{key}_cam.jpg"
    img_path.write_bytes(original)
    cam_path.write_bytes(heatmap)

    try:
        row = conn.execute(
            """INSERT INTO screening_results
                   (patient_id, image_ref, gradcam_ref, dr_grade, confidence, screened_by, model_version)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *""",
            (patient_id, img_path.name, cam_path.name, grade, round(confidence, 4), me, version),
        ).fetchone()
        log(conn, me, patient_id, "dr_screening",
            f"Screening #{row['screening_id']}: grade {grade} ({GRADE_NAMES[grade]}), model {version}")

        referral, note = auto_referral(conn, me, patient_id, row, grade, confidence, version)
        if referral:
            row = conn.execute(
                "UPDATE screening_results SET flagged_referral_id = %s WHERE screening_id = %s RETURNING *",
                (referral["referral_id"], row["screening_id"]),
            ).fetchone()
    except Exception:
        img_path.unlink(missing_ok=True)
        cam_path.unlink(missing_ok=True)
        raise

    row["probabilities"] = probs
    row["referral"] = referral
    row["referral_note"] = note
    return shape(row)


@router.get("/patients/{patient_id}")
def list_screenings(
    patient_id: int,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    require_consent(conn, provider, patient_id, "view_screenings", "Viewed DR screenings")
    log(conn, provider["provider_id"], patient_id, "view_screenings", "Viewed DR screenings")
    rows = conn.execute(
        """SELECT s.*, p.name AS screened_by_name,
                  r.urgency AS referral_urgency, r.status AS referral_status,
                  tp.name AS referral_to
           FROM screening_results s
           JOIN providers p ON p.provider_id = s.screened_by
           LEFT JOIN referrals r  ON r.referral_id  = s.flagged_referral_id
           LEFT JOIN providers tp ON tp.provider_id = r.to_provider
           WHERE s.patient_id = %s ORDER BY s.screened_on DESC""",
        (patient_id,),
    ).fetchall()
    return [shape(r) for r in rows]


@router.get("/{screening_id}/image")
def screening_image(
    screening_id: int,
    kind: str = Query("original", pattern="^(original|heatmap)$"),
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Images are clinical data: served only through this consent-checked
    endpoint, never as public files."""
    row = conn.execute(
        "SELECT patient_id, image_ref, gradcam_ref FROM screening_results WHERE screening_id = %s",
        (screening_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Screening not found")
    require_consent(conn, provider, row["patient_id"], "view_screening_image", f"Screening #{screening_id} image")

    name = row["gradcam_ref"] if kind == "heatmap" else row["image_ref"]
    path = STORE / name
    if not path.is_file():
        raise HTTPException(404, "Image file is missing")
    return FileResponse(path, media_type="image/jpeg")


class Review(BaseModel):
    reviewed_grade: int = Field(ge=0, le=4)
    review_note: Optional[str] = Field(default=None, max_length=1000)


@router.patch("/{screening_id}/review")
def review_screening(
    screening_id: int,
    body: Review,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """The doctor confirms or corrects the AI grade. The AI assists, the doctor decides."""
    row = conn.execute(
        "SELECT patient_id FROM screening_results WHERE screening_id = %s", (screening_id,)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Screening not found")
    require_consent(conn, provider, row["patient_id"], "review_screening", f"Review of screening #{screening_id}")

    updated = conn.execute(
        """UPDATE screening_results SET reviewed_grade = %s, review_note = %s
           WHERE screening_id = %s RETURNING *""",
        (body.reviewed_grade, body.review_note, screening_id),
    ).fetchone()
    log(conn, provider["provider_id"], row["patient_id"], "review_screening",
        f"Screening #{screening_id} reviewed as grade {body.reviewed_grade}")
    return shape(updated)
