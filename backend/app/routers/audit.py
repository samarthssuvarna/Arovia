from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..security import get_current_provider

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def audit_log(
    patient_id: Optional[int] = None,
    limit: int = 200,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Who touched which record, when, why, and whether it was allowed.
    Admin only."""
    if provider["role"] != "admin":
        raise HTTPException(403, "Only an admin can view the audit log")

    sql = """SELECT l.log_id, l.accessed_on,
                    COALESCE(pr.name, ap.name || ' (patient)') AS provider, pt.name AS patient,
                    l.action, l.reason, l.granted
             FROM access_logs l
             LEFT JOIN providers pr ON pr.provider_id = l.provider_id
             LEFT JOIN patients ap ON ap.patient_id = l.actor_patient_id
             JOIN patients  pt ON pt.patient_id  = l.patient_id"""
    params = []
    if patient_id is not None:
        sql += " WHERE l.patient_id = %s"
        params.append(patient_id)
    sql += " ORDER BY l.log_id DESC LIMIT %s"
    params.append(max(1, min(limit, 1000)))
    return conn.execute(sql, params).fetchall()
