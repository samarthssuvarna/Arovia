from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import audit, auth, consents, dashboard, encounters, patients, portal, providers, referrals, screening

app = FastAPI(title="Longitudinal Patient Record & Referral Exchange")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(providers.router)
app.include_router(referrals.router)
app.include_router(consents.router)
app.include_router(encounters.router)
app.include_router(audit.router)
app.include_router(dashboard.router)
app.include_router(portal.router)
app.include_router(screening.router)


@app.middleware("http")
async def security_headers(request, call_next):
    """Browser-side protections for every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"        # do not guess file types
    response.headers["X-Frame-Options"] = "DENY"                  # cannot be shown inside another site
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"                # patient data is never cached by the browser
    return response


@app.get("/health")
def health():
    return {"status": "ok"}
