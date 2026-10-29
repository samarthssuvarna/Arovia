from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import get_conn
from ..security import get_current_provider

router = APIRouter(prefix="/patients", tags=["encounters"])


class DiagnosisIn(BaseModel):
    condition: str = Field(min_length=2)
    icd_code: Optional[str] = None


class PrescriptionIn(BaseModel):
    medicine: str = Field(min_length=2)
    dosage: str = Field(min_length=1)


class EncounterCreate(BaseModel):
    notes: str = Field(min_length=3)
    diagnoses: List[DiagnosisIn] = []
    prescriptions: List[PrescriptionIn] = []
    override_allergy_warning: bool = False


@router.post("/{patient_id}/encounters", status_code=201)
def create_encounter(
    patient_id: int,
    body: EncounterCreate,
    provider=Depends(get_current_provider),
    conn=Depends(get_conn),
):
    """Record a visit with diagnoses and prescriptions.
    The encounter, its diagnoses, its prescriptions and the audit log are
    ONE transaction. Prescriptions are checked against the patient's active
    allergies; a conflict blocks the save unless the doctor overrides."""
    me = provider["provider_id"]

    if not conn.execute("SELECT 1 FROM patients WHERE patient_id = %s", (patient_id,)).fetchone():
        raise HTTPException(404, "Patient not found")

    if not conn.execute("SELECT has_valid_consent(%s, %s) AS ok", (me, patient_id)).fetchone()["ok"]:
        conn.execute(
            """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
               VALUES (%s, %s, 'create_encounter', 'Denied: no valid consent', FALSE)""",
            (me, patient_id),
        )
        conn.commit()
        raise HTTPException(403, "No valid consent for this patient. The attempt has been logged.")

    # Allergy safety check
    conflicts = []
    for rx in body.prescriptions:
        for a in conn.execute(
            """SELECT substance, severity FROM allergies
               WHERE patient_id = %s AND is_active
                 AND lower(%s) LIKE '%%' || lower(substance) || '%%'""",
            (patient_id, rx.medicine),
        ).fetchall():
            conflicts.append({"medicine": rx.medicine, "allergy": a["substance"], "severity": a["severity"]})

    if conflicts and not body.override_allergy_warning:
        conn.execute(
            """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
               VALUES (%s, %s, 'blocked_prescription', %s, FALSE)""",
            (me, patient_id, "Allergy conflict: " + ", ".join(f"{c['medicine']}/{c['allergy']}" for c in conflicts)),
        )
        conn.commit()
        raise HTTPException(
            409,
            detail={
                "message": "Allergy conflict. Nothing was saved. Resend with override_allergy_warning=true to proceed.",
                "conflicts": conflicts,
            },
        )

    # --- atomic part ---
    enc = conn.execute(
        "INSERT INTO encounters (patient_id, provider_id, notes) VALUES (%s, %s, %s) RETURNING *",
        (patient_id, me, body.notes),
    ).fetchone()

    for d in body.diagnoses:
        conn.execute(
            "INSERT INTO diagnoses (encounter_id, condition, icd_code) VALUES (%s, %s, %s)",
            (enc["encounter_id"], d.condition, d.icd_code),
        )
    for rx in body.prescriptions:
        conn.execute(
            "INSERT INTO prescriptions (encounter_id, medicine, dosage) VALUES (%s, %s, %s)",
            (enc["encounter_id"], rx.medicine, rx.dosage),
        )

    note = f"Encounter #{enc['encounter_id']}: {len(body.diagnoses)} diagnoses, {len(body.prescriptions)} prescriptions"
    if conflicts:
        note += " (allergy warning overridden)"
    conn.execute(
        """INSERT INTO access_logs (provider_id, patient_id, action, reason, granted)
           VALUES (%s, %s, 'create_encounter', %s, TRUE)""",
        (me, patient_id, note),
    )
    return {"encounter": enc, "allergy_warnings": conflicts}
