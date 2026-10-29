from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import get_conn
from ..security import get_current_provider

router = APIRouter(prefix="/referrals", tags=["referrals"])

Status = Literal["pending", "accepted", "completed", "rejected", "cancelled"]

# Allowed status moves. Anything else is rejected with 409.
TRANSITIONS = {
    "pending": {"accepted", "rejected", "cancelled"},
    "accepted": {"completed", "cancelled"},
}


class ReferralCreate(BaseModel):
    patient_id: int
    to_provider: int
    reason: str = Field(min_length=3)
    urgency: Literal["routine", "urgent", "emergency"] = "routine"
    encounter_id: Optional[int] = None


class StatusUpdate(BaseModel):
    status: Literal["accepted", "completed", "rejected", "cancelled"]


@router.post("", status_code=201)
def create_referral(
    body: ReferralCreate,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Create a referral. The referral row and its audit-log row are written
    in ONE transaction: if either insert fails, both are rolled back."""
    me = provider["provider_id"]

    if body.to_provider == me:
        raise HTTPException(400, "You cannot refer a patient to yourself")

    if not conn.execute(
        "SELECT 1 FROM patients WHERE patient_id = %s", (body.patient_id,)
    ).fetchone():
        raise HTTPException(404, "Patient not found")

    if not conn.execute(
        "SELECT 1 FROM providers WHERE provider_id = %s AND is_active", (body.to_provider,)
    ).fetchone():
        raise HTTPException(404, "Receiving provider not found")

    # Consent is enforced here, in the API layer
    allowed = conn.execute(
        "SELECT has_valid_consent(%s, %s) AS ok", (me, body.patient_id)
    ).fetchone()["ok"]
    if not allowed:
        conn.execute(
            """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
               VALUES (%s, %s, 'create_referral', %s, FALSE)""",
            (me, body.patient_id, body.reason),
        )
        conn.commit()  # keep the denied-attempt log
        raise HTTPException(403, "No valid consent for this patient. The attempt has been logged.")

    if body.encounter_id is not None and not conn.execute(
        "SELECT 1 FROM encounters WHERE encounter_id = %s AND patient_id = %s",
        (body.encounter_id, body.patient_id),
    ).fetchone():
        raise HTTPException(400, "That encounter does not belong to this patient")

    # --- the atomic part: both statements commit together, or neither does ---
    referral = conn.execute(
        """INSERT INTO referrals
               (patient_id, encounter_id, from_provider, to_provider, reason, urgency)
           VALUES (%s, %s, %s, %s, %s, %s)
           RETURNING *""",
        (body.patient_id, body.encounter_id, me, body.to_provider, body.reason, body.urgency),
    ).fetchone()

    conn.execute(
        """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
           VALUES (%s, %s, 'create_referral', %s, TRUE)""",
        (me, body.patient_id, f"Referral #{referral['referral_id']} to provider {body.to_provider}: {body.reason}"),
    )
    return referral


@router.get("")
def list_referrals(
    direction: Literal["incoming", "outgoing", "all"] = "all",
    status: Optional[Status] = None,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Referrals I sent (outgoing) and/or received (incoming)."""
    me = provider["provider_id"]
    conditions, params = [], []

    if direction == "incoming":
        conditions.append("r.to_provider = %s")
        params.append(me)
    elif direction == "outgoing":
        conditions.append("r.from_provider = %s")
        params.append(me)
    else:
        conditions.append("(r.from_provider = %s OR r.to_provider = %s)")
        params.extend([me, me])

    if status:
        conditions.append("r.status = %s")
        params.append(status)

    return conn.execute(
        f"""SELECT r.referral_id, r.patient_id, p.mrn, p.name AS patient,
                   fp.name AS from_provider, tp.name AS to_provider,
                   r.reason, r.urgency, r.status, r.source, r.created_at, r.updated_at
            FROM referrals r
            JOIN patients  p  ON p.patient_id   = r.patient_id
            JOIN providers fp ON fp.provider_id = r.from_provider
            JOIN providers tp ON tp.provider_id = r.to_provider
            WHERE {' AND '.join(conditions)}
            ORDER BY r.created_at DESC""",
        params,
    ).fetchall()


@router.get("/summary")
def referral_summary(
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """GROUP BY report: my referrals counted by status and urgency."""
    me = provider["provider_id"]
    return conn.execute(
        """SELECT status, urgency, COUNT(*) AS count
           FROM referrals
           WHERE from_provider = %s OR to_provider = %s
           GROUP BY status, urgency
           ORDER BY status, urgency""",
        (me, me),
    ).fetchall()


@router.patch("/{referral_id}/status")
def update_referral_status(
    referral_id: int,
    body: StatusUpdate,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Move a referral through its lifecycle. Status change and audit log
    are one transaction. The row is locked (FOR UPDATE) so two people
    cannot change the same referral at the same instant."""
    me = provider["provider_id"]

    ref = conn.execute(
        "SELECT * FROM referrals WHERE referral_id = %s FOR UPDATE", (referral_id,)
    ).fetchone()
    if not ref:
        raise HTTPException(404, "Referral not found")

    if body.status not in TRANSITIONS.get(ref["status"], set()):
        raise HTTPException(
            409, f"Cannot change a '{ref['status']}' referral to '{body.status}'"
        )

    # Who may do what: the sender cancels; the receiver accepts/rejects/completes
    if body.status == "cancelled":
        if me != ref["from_provider"]:
            raise HTTPException(403, "Only the referring provider can cancel")
    elif me != ref["to_provider"]:
        raise HTTPException(403, "Only the receiving provider can do this")

    updated = conn.execute(
        "UPDATE referrals SET status = %s WHERE referral_id = %s RETURNING *",
        (body.status, referral_id),
    ).fetchone()

    conn.execute(
        """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
           VALUES (%s, %s, 'update_referral', %s, TRUE)""",
        (me, ref["patient_id"], f"Referral #{referral_id}: {ref['status']} -> {body.status}"),
    )
    return updated
