from fastapi import APIRouter, Depends

from ..db import get_conn
from ..security import get_current_provider

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

ACTIVE = "status = 'active' AND expires_on > now()"


@router.get("")
def dashboard(provider=Depends(get_current_provider), conn=Depends(get_conn)):
    """Numbers for the home screen. Doctors see their own workload;
    admins see system-wide consent and audit health."""
    me = provider["provider_id"]

    if provider["role"] == "admin":
        one = lambda sql: conn.execute(sql).fetchone()["n"]
        return {
            "role": "admin",
            "cards": {
                "patients": one("SELECT COUNT(*) AS n FROM patients"),
                "active_consents": one(f"SELECT COUNT(*) AS n FROM consent_records WHERE {ACTIVE}"),
                "expiring_soon": one(
                    f"""SELECT COUNT(*) AS n FROM consent_records
                        WHERE {ACTIVE} AND expires_on <= now() + interval '14 days'"""
                ),
                "denied_7d": one(
                    """SELECT COUNT(*) AS n FROM access_logs
                       WHERE NOT granted AND accessed_on >= now() - interval '7 days'"""
                ),
            },
            "recent": conn.execute(
                """SELECT l.accessed_on, COALESCE(pr.name, ap.name || ' (patient)') AS provider, p.name AS patient,
                          l.action, l.granted
                   FROM access_logs l
                   LEFT JOIN providers pr ON pr.provider_id = l.provider_id
                   LEFT JOIN patients ap ON ap.patient_id = l.actor_patient_id
                   JOIN patients  p  ON p.patient_id   = l.patient_id
                   ORDER BY l.accessed_on DESC LIMIT 8"""
            ).fetchall(),
        }

    def n(sql, params):
        return conn.execute(sql, params).fetchone()["n"]

    return {
        "role": "doctor",
        "cards": {
            "incoming_pending": n(
                "SELECT COUNT(*) AS n FROM referrals WHERE to_provider = %s AND status = 'pending'", (me,)
            ),
            "urgent_pending": n(
                """SELECT COUNT(*) AS n FROM referrals
                   WHERE to_provider = %s AND status = 'pending'
                     AND urgency IN ('urgent', 'emergency')""",
                (me,),
            ),
            "outgoing_open": n(
                """SELECT COUNT(*) AS n FROM referrals
                   WHERE from_provider = %s AND status IN ('pending', 'accepted')""",
                (me,),
            ),
            "patients_with_access": n(
                f"SELECT COUNT(DISTINCT patient_id) AS n FROM consent_records WHERE provider_id = %s AND {ACTIVE}",
                (me,),
            ),
        },
        "recent": conn.execute(
            """SELECT l.accessed_on, p.name AS patient, l.action, l.granted
               FROM access_logs l
               JOIN patients p ON p.patient_id = l.patient_id
               WHERE l.provider_id = %s
               ORDER BY l.accessed_on DESC LIMIT 8""",
            (me,),
        ).fetchall(),
    }
