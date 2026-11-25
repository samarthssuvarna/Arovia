"""Two read-only views of who can see what, and what has happened.

  GET /access/my-patients   (doctor)  patients who have given ME access, plus past access
  GET /access/my-summary    (patient) a dated story of everything that happened to MY record

Nothing here changes data, and nothing here reads another patient's clinical
details: the doctor list shows identity and dates only.
"""
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..security import get_current_patient, get_current_provider

router = APIRouter(prefix="/access", tags=["access"])

GRADE_NAMES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]


@router.get("/my-patients")
def my_patients(provider=Depends(get_current_provider), conn=Depends(get_conn)):
    """One row per patient who has ever given this doctor access, with the
    latest consent state. last_visit is shown only while access is active."""
    rows = conn.execute(
        """
        SELECT DISTINCT ON (c.patient_id)
               c.consent_id, c.patient_id, p.mrn, p.name, p.dob, p.gender,
               c.granted_on, c.expires_on,
               CASE WHEN c.status = 'revoked'   THEN 'revoked'
                    WHEN c.expires_on <= now()  THEN 'expired'
                    ELSE 'active' END AS effective_status,
               GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.expires_on - now())) / 86400))::int AS days_left,
               CASE WHEN c.status = 'active' AND c.expires_on > now()
                    THEN (SELECT max(e.encounter_date) FROM encounters e WHERE e.patient_id = c.patient_id)
               END AS last_visit
        FROM consent_records c
        JOIN patients p ON p.patient_id = c.patient_id
        WHERE c.provider_id = %s
        ORDER BY c.patient_id,
                 (c.status = 'active' AND c.expires_on > now()) DESC,
                 c.expires_on DESC
        """,
        (provider["provider_id"],),
    ).fetchall()
    order = {"active": 0, "expired": 1, "revoked": 2}
    rows.sort(key=lambda r: (order[r["effective_status"]], r["name"]))
    return rows


def _ev(when, kind, title, detail=None, tone="info"):
    return {"when": when, "kind": kind, "title": title, "detail": detail, "tone": tone}


@router.get("/my-summary")
def my_summary(patient=Depends(get_current_patient), conn=Depends(get_conn)):
    """Everything that happened to this patient's record, newest first."""
    pid = patient["patient_id"]
    events = []

    # 1. Visits (all providers)
    visits = conn.execute(
        """SELECT encounter_date, provider_name, specialty, facility, notes, diagnoses, prescriptions
           FROM v_patient_history WHERE patient_id = %s""",
        (pid,),
    ).fetchall()
    for v in visits:
        bits = []
        if v["diagnoses"]:
            bits.append(f"Diagnosis: {v['diagnoses']}")
        if v["prescriptions"]:
            bits.append(f"Medicines: {v['prescriptions']}")
        if v["notes"]:
            bits.append(v["notes"])
        events.append(_ev(
            v["encounter_date"], "visit",
            f"Visit with {v['provider_name']} ({v['specialty']}, {v['facility']})",
            " | ".join(bits) or None,
        ))

    # 2. Access the patient gave
    consents = conn.execute(
        """SELECT c.granted_on, c.expires_on, c.status, pr.name AS doctor
           FROM consent_records c JOIN providers pr ON pr.provider_id = c.provider_id
           WHERE c.patient_id = %s""",
        (pid,),
    ).fetchall()
    doctors_now = 0
    now = conn.execute("SELECT now() AS n").fetchone()["n"]
    for c in consents:
        is_active = c["status"] == "active" and c["expires_on"] > now
        if is_active:
            doctors_now += 1
            state = "Still active"
        elif c["status"] == "revoked":
            state = "Since removed"
        else:
            state = "Ended on its own"
        events.append(_ev(
            c["granted_on"], "consent",
            f"You gave {c['doctor']} access to your record",
            f"Until {c['expires_on']:%d %b %Y}. {state}.",
            "ok" if is_active else "info",
        ))

    # 3. Who opened or tried to open the record, and what the patient did
    logs = conn.execute(
        """SELECT l.accessed_on, l.action, l.reason, l.granted, l.provider_id, l.actor_patient_id,
                  pr.name AS doctor
           FROM access_logs l LEFT JOIN providers pr ON pr.provider_id = l.provider_id
           WHERE l.patient_id = %s""",
        (pid,),
    ).fetchall()
    opens = refused = 0
    for l in logs:
        action = (l["action"] or "").lower()
        if l["provider_id"] is not None:
            if not l["granted"]:
                refused += 1
                events.append(_ev(l["accessed_on"], "denied",
                                  f"{l['doctor']} tried to open your record and was refused",
                                  l["reason"], "bad"))
            elif action == "view_history":
                opens += 1
                events.append(_ev(l["accessed_on"], "access",
                                  f"{l['doctor']} opened your record", l["reason"]))
            elif action == "view_screening_image":
                events.append(_ev(l["accessed_on"], "access",
                                  f"{l['doctor']} viewed your eye image", None))
        elif "revoke" in action:
            # the only place the time of a removal is recorded
            events.append(_ev(l["accessed_on"], "consent", "You removed a doctor's access", l["reason"], "warn"))

    # 4. Referrals
    refs = conn.execute(
        """SELECT r.created_at, r.updated_at, r.reason, r.urgency, r.status, r.source,
                  fp.name AS from_doc, tp.name AS to_doc
           FROM referrals r
           JOIN providers fp ON fp.provider_id = r.from_provider
           JOIN providers tp ON tp.provider_id = r.to_provider
           WHERE r.patient_id = %s""",
        (pid,),
    ).fetchall()
    for r in refs:
        who = "An automatic eye-screening referral" if r["source"] == "ai_dr" else "A referral"
        events.append(_ev(r["created_at"], "referral",
                          f"{who} was made from {r['from_doc']} to {r['to_doc']}",
                          f"{r['reason']} ({r['urgency']})"))
        if r["status"] != "pending" and r["updated_at"] and r["updated_at"] > r["created_at"]:
            tone = "ok" if r["status"] in ("accepted", "completed") else "warn"
            events.append(_ev(r["updated_at"], "referral",
                              f"Referral to {r['to_doc']} is now {r['status']}", r["reason"], tone))

    # 5. Eye screenings. The patient sees the doctor's confirmed grade, not the raw AI output.
    shots = conn.execute(
        """SELECT s.screened_on, s.reviewed_grade, pr.name AS doctor
           FROM screening_results s JOIN providers pr ON pr.provider_id = s.screened_by
           WHERE s.patient_id = %s""",
        (pid,),
    ).fetchall()
    for s in shots:
        if s["reviewed_grade"] is not None:
            detail = f"Doctor's confirmed result: grade {s['reviewed_grade']}, {GRADE_NAMES[s['reviewed_grade']]}"
        else:
            detail = "Waiting for the doctor to review the result."
        events.append(_ev(s["screened_on"], "screening", f"Eye screening by {s['doctor']}", detail))

    events.sort(key=lambda e: e["when"], reverse=True)

    allergies = conn.execute(
        """SELECT substance, severity FROM allergies WHERE patient_id = %s AND is_active
           ORDER BY severity DESC""",
        (pid,),
    ).fetchall()

    return {
        "counts": {
            "visits": len(visits),
            "doctors_with_access": doctors_now,
            "record_opens": opens,
            "refused": refused,
            "referrals": len(refs),
            "screenings": len(shots),
        },
        "last_visit": max((v["encounter_date"] for v in visits), default=None),
        "allergies": allergies,
        "timeline": events[:150],
    }
