from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import get_conn
from ..security import get_current_patient

router = APIRouter(prefix="/portal", tags=["patient portal"])

EFFECTIVE = """CASE WHEN c.status = 'revoked' THEN 'revoked'
                    WHEN c.expires_on <= now() THEN 'expired'
                    ELSE 'active' END"""


class Grant(BaseModel):
    provider_id: int
    days: int = Field(default=90, ge=1, le=365)


def log(conn, patient_id: int, action: str, reason: str):
    """Patient-made audit row: actor_patient_id is set, provider_id is NULL."""
    conn.execute(
        """INSERT INTO access_logs (provider_id, actor_patient_id, patient_id, action, reason, granted)
           VALUES (NULL, %s, %s, %s, %s, TRUE)""",
        (patient_id, patient_id, action, reason),
    )


@router.get("/doctors")
def doctors(patient=Depends(get_current_patient), conn=Depends(get_conn)):
    """Doctors a patient may choose from."""
    return conn.execute(
        """SELECT p.provider_id, p.name, p.specialty, f.name AS facility
           FROM providers p JOIN facilities f ON f.facility_id = p.facility_id
           WHERE p.is_active AND p.role = 'doctor'
           ORDER BY p.name"""
    ).fetchall()


@router.get("/consents")
def my_consents(patient=Depends(get_current_patient), conn=Depends(get_conn)):
    """Everyone I have given (or taken back) access to."""
    return conn.execute(
        f"""SELECT c.consent_id, pr.name AS provider, pr.specialty, f.name AS facility,
                   c.granted_on, c.expires_on, {EFFECTIVE} AS effective_status
            FROM consent_records c
            JOIN providers  pr ON pr.provider_id = c.provider_id
            JOIN facilities f  ON f.facility_id  = pr.facility_id
            WHERE c.patient_id = %s
            ORDER BY c.granted_on DESC""",
        (patient["patient_id"],),
    ).fetchall()


@router.post("/consents", status_code=201)
def grant(body: Grant, patient=Depends(get_current_patient), conn=Depends(get_conn)):
    me = patient["patient_id"]
    doc = conn.execute(
        "SELECT name FROM providers WHERE provider_id = %s AND is_active AND role = 'doctor'",
        (body.provider_id,),
    ).fetchone()
    if not doc:
        raise HTTPException(404, "Doctor not found")

    if conn.execute("SELECT has_valid_consent(%s, %s) AS ok", (body.provider_id, me)).fetchone()["ok"]:
        raise HTTPException(409, "This doctor already has access")

    row = conn.execute(
        """INSERT INTO consent_records (patient_id, provider_id, expires_on)
           VALUES (%s, %s, now() + make_interval(days => %s)) RETURNING *""",
        (me, body.provider_id, body.days),
    ).fetchone()
    log(conn, me, "grant_consent",
        f"Patient granted consent #{row['consent_id']} to {doc['name']} for {body.days} days")
    return row


@router.post("/consents/{consent_id}/revoke")
def revoke(consent_id: int, patient=Depends(get_current_patient), conn=Depends(get_conn)):
    me = patient["patient_id"]
    # patient_id in the WHERE clause: a patient can only revoke their OWN consent
    row = conn.execute(
        """UPDATE consent_records SET status = 'revoked'
           WHERE consent_id = %s AND patient_id = %s AND status = 'active' RETURNING *""",
        (consent_id, me),
    ).fetchone()
    if not row:
        raise HTTPException(404, "No active consent with that id")
    log(conn, me, "revoke_consent", f"Patient revoked consent #{consent_id}")
    return row


@router.get("/access-log")
def access_log(patient=Depends(get_current_patient), conn=Depends(get_conn)):
    """Who looked at MY record, and was it allowed (denied tries included)."""
    return conn.execute(
        """SELECT l.log_id, l.accessed_on,
                  COALESCE(pr.name, 'You') AS actor, l.action, l.reason, l.granted
           FROM access_logs l
           LEFT JOIN providers pr ON pr.provider_id = l.provider_id
           WHERE l.patient_id = %s
           ORDER BY l.log_id DESC LIMIT 100""",
        (patient["patient_id"],),
    ).fetchall()
