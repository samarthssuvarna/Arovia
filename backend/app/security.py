from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from .db import get_conn

bearer = HTTPBearer()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user_id: int, role: str, typ: str = "provider") -> str:
    """typ says whose id is in 'sub': a provider or a patient."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "typ": typ,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_provider(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    conn=Depends(get_conn),
):
    """Decode the JWT, then reload the provider from the DB so a
    deactivated account is rejected even if its token is still valid."""
    try:
        data = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        provider_id = int(data["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    # A patient token must never work on a doctor endpoint (ids overlap)
    if data.get("typ", "provider") != "provider":
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    row = conn.execute(
        """SELECT p.provider_id, p.name, p.specialty, p.role, p.is_active,
                  f.name AS facility
           FROM providers p JOIN facilities f ON f.facility_id = p.facility_id
           WHERE p.provider_id = %s""",
        (provider_id,),
    ).fetchone()
    if not row or not row["is_active"]:
        raise HTTPException(status_code=401, detail="Account not found or inactive")
    return row


def get_current_patient(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    conn=Depends(get_conn),
):
    """Same idea for patients: only tokens issued by the patient login work."""
    try:
        data = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        patient_id = int(data["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if data.get("typ") != "patient":
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    row = conn.execute(
        "SELECT patient_id, mrn, name, dob, gender, email FROM patients WHERE patient_id = %s",
        (patient_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Account not found")
    return row
