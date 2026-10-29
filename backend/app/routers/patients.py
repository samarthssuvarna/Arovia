from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import get_conn
from ..security import get_current_provider

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/search")
def search_patients(
    q: str = Query(..., min_length=2, description="Name or MRN"),
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Find a patient. Returns identity fields only (no clinical data) plus
    whether THIS provider currently holds a valid consent for them."""
    like = f"%{q}%"
    return conn.execute(
        """SELECT p.patient_id, p.mrn, p.name, p.dob, p.gender,
                  has_valid_consent(%s, p.patient_id) AS has_consent
           FROM patients p
           WHERE p.name ILIKE %s OR p.mrn ILIKE %s
           ORDER BY p.name
           LIMIT 25""",
        (provider["provider_id"], like, like),
    ).fetchall()


@router.get("/{patient_id}/history")
def patient_history(
    patient_id: int,
    reason: str = Query(..., min_length=3, description="Why are you accessing this record?"),
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Longitudinal history across ALL providers, gated by consent.
    Every call is written to access_logs, whether allowed or denied."""
    pid = provider["provider_id"]

    patient = conn.execute(
        "SELECT patient_id, mrn, name, dob, gender, phone FROM patients WHERE patient_id = %s",
        (patient_id,),
    ).fetchone()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # 1. Consent check (enforced here in the API, not in the UI)
    allowed = conn.execute(
        "SELECT has_valid_consent(%s, %s) AS ok", (pid, patient_id)
    ).fetchone()["ok"]

    # 2. Audit log on EVERY read, with the outcome
    conn.execute(
        """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
           VALUES (%s, %s, 'view_history', %s, %s)""",
        (pid, patient_id, reason, allowed),
    )

    # 3. Denied: commit the log first. Raising an error would roll the
    #    transaction back and erase the record of the denied attempt.
    if not allowed:
        conn.commit()
        raise HTTPException(
            status_code=403,
            detail="No valid consent for this patient. The attempt has been logged.",
        )

    allergies = conn.execute(
        """SELECT allergy_id, substance, severity FROM allergies
           WHERE patient_id = %s AND is_active ORDER BY severity DESC""",
        (patient_id,),
    ).fetchall()

    encounters = conn.execute(
        """SELECT encounter_id, encounter_date, provider_name, specialty, facility,
                  notes, diagnoses, prescriptions
           FROM v_patient_history
           WHERE patient_id = %s
           ORDER BY encounter_date DESC""",
        (patient_id,),
    ).fetchall()

    referrals = conn.execute(
        """SELECT r.referral_id, r.reason, r.urgency, r.status, r.created_at,
                  fp.name AS from_provider, tp.name AS to_provider
           FROM referrals r
           JOIN providers fp ON fp.provider_id = r.from_provider
           JOIN providers tp ON tp.provider_id = r.to_provider
           WHERE r.patient_id = %s
           ORDER BY r.created_at DESC""",
        (patient_id,),
    ).fetchall()

    # The patient's permission for THIS doctor: when it was given and when it ends
    consent = conn.execute(
        """SELECT granted_on, expires_on,
                  GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expires_on - now())) / 86400))::int AS days_left
           FROM consent_records
           WHERE provider_id = %s AND patient_id = %s AND status = 'active' AND expires_on > now()
           ORDER BY expires_on DESC LIMIT 1""",
        (pid, patient_id),
    ).fetchone()

    return {
        "consent": consent,
        "patient": patient,
        "allergies": allergies,
        "encounters": encounters,
        "referrals": referrals,
    }
