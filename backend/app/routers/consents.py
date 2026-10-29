from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import get_conn
from ..security import get_current_provider

router = APIRouter(prefix="/consents", tags=["consents"])

# status as the system actually treats it right now
EFFECTIVE = """CASE WHEN c.status = 'revoked' THEN 'revoked'
                    WHEN c.expires_on <= now() THEN 'expired'
                    ELSE 'active' END"""


class ConsentGrant(BaseModel):
    patient_id: int
    provider_id: int
    days: int = Field(default=90, ge=1, le=730)


def require_admin(provider):
    # No patient login exists in this prototype, so an admin records the
    # patient's decision on their behalf (like a front-desk consent form).
    if provider["role"] != "admin":
        raise HTTPException(403, "Only an admin can record or revoke consent")


@router.post("", status_code=201)
def grant_consent(
    body: ConsentGrant,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    require_admin(provider)

    if not conn.execute("SELECT 1 FROM patients WHERE patient_id = %s", (body.patient_id,)).fetchone():
        raise HTTPException(404, "Patient not found")
    if not conn.execute(
        "SELECT 1 FROM providers WHERE provider_id = %s AND is_active AND role = 'doctor'",
        (body.provider_id,),
    ).fetchone():
        raise HTTPException(404, "Doctor not found")

    if conn.execute("SELECT has_valid_consent(%s, %s) AS ok", (body.provider_id, body.patient_id)).fetchone()["ok"]:
        raise HTTPException(409, "This doctor already has valid consent for this patient")

    row = conn.execute(
        """INSERT INTO consent_records (patient_id, provider_id, expires_on)
           VALUES (%s, %s, now() + make_interval(days => %s))
           RETURNING *""",
        (body.patient_id, body.provider_id, body.days),
    ).fetchone()

    conn.execute(
        """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
           VALUES (%s, %s, 'grant_consent', %s, TRUE)""",
        (provider["provider_id"], body.patient_id,
         f"Consent #{row['consent_id']} granted to provider {body.provider_id} for {body.days} days"),
    )
    return row


@router.post("/{consent_id}/revoke")
def revoke_consent(
    consent_id: int,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    require_admin(provider)

    row = conn.execute(
        "UPDATE consent_records SET status = 'revoked' WHERE consent_id = %s AND status = 'active' RETURNING *",
        (consent_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "No active consent with that id")

    conn.execute(
        """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
           VALUES (%s, %s, 'revoke_consent', %s, TRUE)""",
        (provider["provider_id"], row["patient_id"], f"Consent #{consent_id} revoked"),
    )
    return row


@router.get("")
def list_consents(
    patient_id: Optional[int] = None,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Admin: all consents (optionally for one patient)."""
    require_admin(provider)
    sql = f"""SELECT c.consent_id, c.patient_id, pt.name AS patient,
                     c.provider_id, pr.name AS provider,
                     c.granted_on, c.expires_on, {EFFECTIVE} AS effective_status
              FROM consent_records c
              JOIN patients  pt ON pt.patient_id  = c.patient_id
              JOIN providers pr ON pr.provider_id = c.provider_id"""
    params = []
    if patient_id is not None:
        sql += " WHERE c.patient_id = %s"
        params.append(patient_id)
    sql += " ORDER BY c.patient_id, c.granted_on DESC"
    return conn.execute(sql, params).fetchall()


@router.get("/mine")
def my_consents(
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Which patients has this doctor been given access to?"""
    return conn.execute(
        f"""SELECT c.consent_id, c.patient_id, pt.mrn, pt.name AS patient,
                   c.granted_on, c.expires_on, {EFFECTIVE} AS effective_status
            FROM consent_records c
            JOIN patients pt ON pt.patient_id = c.patient_id
            WHERE c.provider_id = %s
            ORDER BY c.expires_on DESC""",
        (provider["provider_id"],),
    ).fetchall()
