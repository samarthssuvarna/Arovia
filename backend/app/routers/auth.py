from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .. import ratelimit
from ..db import get_conn
from ..security import create_token, get_current_patient, get_current_provider, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginRequest, request: Request, conn=Depends(get_conn)):
    ratelimit.check(request, body.email)
    row = conn.execute(
        "SELECT provider_id, name, role, password_hash, is_active "
        "FROM providers WHERE email = %s",
        (body.email,),
    ).fetchone()
    # Same error for unknown email and wrong password (no user enumeration)
    if not row or not row["is_active"] or not verify_password(body.password, row["password_hash"]):
        ratelimit.record_failure(request, body.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    ratelimit.clear(request, body.email)
    return {
        "access_token": create_token(row["provider_id"], row["role"]),
        "token_type": "bearer",
        "provider": {"provider_id": row["provider_id"], "name": row["name"], "role": row["role"]},
    }


@router.get("/me")
def me(provider=Depends(get_current_provider)):
    return provider


@router.post("/patient-login")
def patient_login(body: LoginRequest, request: Request, conn=Depends(get_conn)):
    ratelimit.check(request, body.email)
    row = conn.execute(
        "SELECT patient_id, name, password_hash FROM patients WHERE email = %s",
        (body.email,),
    ).fetchone()
    if not row or not row["password_hash"] or not verify_password(body.password, row["password_hash"]):
        ratelimit.record_failure(request, body.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    ratelimit.clear(request, body.email)
    return {
        "access_token": create_token(row["patient_id"], "patient", typ="patient"),
        "token_type": "bearer",
        "patient": {"patient_id": row["patient_id"], "name": row["name"], "role": "patient"},
    }


@router.get("/patient-me")
def patient_me(patient=Depends(get_current_patient)):
    return {**patient, "role": "patient"}
