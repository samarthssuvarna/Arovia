from typing import Optional

from fastapi import APIRouter, Depends

from ..db import get_conn
from ..security import get_current_provider

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("")
def list_providers(
    specialty: Optional[str] = None,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Directory of active doctors, used to pick who to refer to.
    No passwords or emails are returned."""
    sql = """SELECT p.provider_id, p.name, p.specialty, f.name AS facility
             FROM providers p JOIN facilities f ON f.facility_id = p.facility_id
             WHERE p.is_active AND p.role = 'doctor'"""
    params = []
    if specialty:
        sql += " AND p.specialty ILIKE %s"
        params.append(f"%{specialty}%")
    sql += " ORDER BY p.specialty, p.name"
    return conn.execute(sql, params).fetchall()
