<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="frontend/public/arovia-white.png">
    <img src="frontend/public/arovia-ink.png" alt="Arovia" width="320">
  </picture>
</p>

<p align="center"><strong>Your record. Your permission.</strong></p>

# Arovia: Secure Longitudinal Patient Record and Referral Exchange

*Arovia* combines *Arogya* (Sanskrit for health) and *via* (Latin for path): a patient's path to health, with every step recorded securely and shared only with their consent.

A web platform where authorised doctors see a patient's complete history across hospitals **only with the patient's valid consent**, send tracked referrals to each other, and leave an audit trail for every access, including the refused ones. An AI screening module reads retinal photos for diabetic retinopathy (DR) and refers patients who need a specialist automatically.

> **Synthetic data only.** Every patient, doctor and image in this project is fictional or from a public research dataset. It is a research and teaching prototype, not a medical device.

---

## The problem

A patient's records are scattered across clinics. A doctor seeing them for the first time has no history, no allergy information and no idea what other doctors prescribed. Sharing the records fixes that, but sharing without control is a privacy failure. Referrals also get lost: nobody knows whether the specialist ever received one. And diabetic eye disease, a leading cause of preventable blindness, is often found too late because screening is slow.

## What this project does

| Need | How the system handles it |
|---|---|
| One history across facilities | A doctor searches a patient and opens a combined timeline of visits, diagnoses, prescriptions and allergies from every provider. |
| Patient control | Access exists only while a patient's consent is active. Patients log in, grant access for a chosen period, and remove it at any time. Expired or removed consent is refused on the very next request. |
| Accountability | Every attempt to open a record is logged with who, when, why and whether it was allowed. Patients can see who looked at their record, including refused attempts. |
| Safe prescribing | Prescribing a drug that conflicts with a recorded allergy is blocked, unless the doctor explicitly accepts the risk. |
| Tracked referrals | Referrals follow a strict lifecycle (pending, accepted, completed, rejected, cancelled). The receiver accepts or completes, the sender cancels. Every change is logged. |
| Early DR detection | A doctor uploads a retinal image. The model grades it 0 to 4 and draws a Grad-CAM heatmap showing what it looked at. The doctor confirms or corrects the grade. Grade 2 or above automatically creates a referral to an ophthalmologist, and escalates an open referral if a later screening is worse. |

## Three user types

- **Doctor:** home dashboard, patient search, consent-gated records, new visits, referrals, eye screening.
- **Patient:** sees who can view their record, grants or removes access, sees every access attempt.
- **Admin:** records consent on a patient's behalf (front-desk case), views the full audit log, monitors denied attempts.

## Design and safety in the interface

- **Calm, readable design:** black, white, beige and warm grey, with green, amber and red kept only for consent and risk, so colour always carries meaning. Light and dark themes, and the Atkinson Hyperlegible typeface, which was designed for readability.
- **Consent made visible:** a doctor sees a bar showing how long the patient's permission lasts. A patient sees the same information about each doctor.
- **Two safety nets, chosen by risk.** Critical actions (removing a patient's access, rejecting or cancelling a referral, saving a prescription despite an allergy, an admin revoking consent) ask for confirmation, and the confirm button stays locked for 3 seconds. Easy-to-redo actions (accepting or completing a referral) show a 3-second undo bar, and nothing is sent to the server until that window ends.

## Architecture

```
React (Vite)  <--REST/JSON-->  FastAPI  <--SQL-->  PostgreSQL
 browser                       JWT auth             13 tables, views,
                               consent checks       functions, triggers
                               DR model (PyTorch)   screening images on disk (consent-gated)
```

- **Strictly relational:** PostgreSQL, third normal form, foreign keys, CHECK constraints, a composite index for patient history, views, a window function and a trigger. No NoSQL.
- **Consent is enforced in the API, not just the screen.** The check is a SQL function, `has_valid_consent(doctor, patient)`, called on every clinical read and write.
- **A refused attempt is committed to the audit log before the 403 is returned**, so the record of the attempt survives.
- **Atomic changes:** creating a visit (with diagnoses and prescriptions), creating a referral, and an AI screening with its auto-referral each save together with their audit rows, or not at all. Referral status changes lock the row so two people cannot change it at once.
- **Separate login types:** a patient token cannot be used on any doctor endpoint, and the reverse.
- **Clinical images** are never public files. They are served only through a consent-checked, audit-logged endpoint.

## The DR model

| | |
|---|---|
| Model | ResNet-18 (ImageNet-pretrained), 5 outputs for grades 0 to 4 |
| Data | APTOS 2019 Blindness Detection (3,662 labelled retinal photos), 80/20 split |
| Explainability | Grad-CAM heatmap on the last convolution block |
| Overall accuracy | 81.6% exact-grade match, quadratic weighted kappa 0.883 |
| Referral decision (grade 2 or above) | about 93% sensitivity and 93% specificity on the validation set |
| Hardest cases | mild, severe and proliferative grades are rarer in the data and less reliable |

**Limits, stated plainly.** The best training epoch was chosen on the same validation set, so the figures are slightly optimistic. The model was trained on one public dataset and has not been tested on images from real hospitals or different cameras. It assists a doctor, who always confirms the grade. It is not a diagnostic device. The training notebook is in `colab/train_dr_model.ipynb`.

## Testing

`tests/Arovia_API_tests.postman_collection.json` holds 28 requests with 51 automatic checks. Import it into Postman, start the backend, and use **Run collection**. The last run passed all 51 checks (0 failed).

It covers: login for all three roles; wrong-password refusal; patient and doctor tokens rejected on each other's endpoints; consent granted, then removed, with the doctor refused on the very next request and the refused attempt visible in the patient's log; allergy conflicts blocked; referral creation, cancellation and an invalid state change refused; the audit log being admin-only; and the real trained model being loaded.

Automated unit tests and testing with real-world images are listed under the roadmap.

## Running it on Windows (no Docker)

**Requirements:** Python 3.11+, Node.js 18+, PostgreSQL 15+.

1. **Database.** In pgAdmin create a database, then run these files in order from its Query Tool:
   `schema.sql`, `seed.sql`, `step2_patient_login.sql`, `step2b_audit_actor.sql`, `dr1_screening_schema.sql`.
2. **Backend.**
   ```
   cd backend
   python -m venv venv
   venv\Scripts\pip install -r requirements.txt
   ```
   Create `backend\.env` with: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` (a long random string), `JWT_EXPIRE_MINUTES`. Then:
   ```
   venv\Scripts\python -m uvicorn app.main:app --reload
   ```
   API documentation: http://localhost:8000/docs
3. **Model (optional).** Put `dr_resnet18.pt` in `backend\models\`. Without it, an untrained demo model runs and the app clearly labels its output as not a medical result.
4. **Frontend.**
   ```
   cd frontend
   npm.cmd install
   npm.cmd run dev
   ```
   Open http://localhost:5173

**Demo logins** (password `Pass@123` for all): doctors `anita.rao`, `vikram.shah`, `meera.iyer`, `rohan.mehta` (ophthalmology), `sara.khan` at `@demo.test`; admin `admin@demo.test`; patients `mrn-0001@demo.test`, `mrn-0003@demo.test`, `mrn-0005@demo.test`.

## Main API endpoints

| Area | Endpoints |
|---|---|
| Login | `POST /auth/login`, `POST /auth/patient-login`, `GET /auth/me` |
| Patients | `GET /patients/search`, `GET /patients/{id}/history` (consent-gated, always logged) |
| Visits | `POST /patients/{id}/encounters` (allergy check, atomic) |
| Referrals | `POST /referrals`, `GET /referrals`, `PATCH /referrals/{id}/status`, `GET /referrals/summary` |
| Consent | `POST /consents`, `POST /consents/{id}/revoke` (admin); `/portal/consents` (patient) |
| Audit | `GET /audit` (admin), `GET /portal/access-log` (patient) |
| DR screening | `POST /screenings/patients/{id}`, `GET /screenings/patients/{id}`, `GET /screenings/{id}/image`, `PATCH /screenings/{id}/review` |
| Home | `GET /dashboard` |

## Roadmap

1. Hospital-system integration using the HL7 FHIR standard.
2. Real patient identity (phone OTP or national health ID) instead of demo passwords.
3. Validate the DR model on local hospital images and add more eye-disease classes.
4. Move the login attempt limit (5 failures in 15 minutes, currently kept in memory, so it resets when the server restarts) to a shared store, add two-factor login for doctors, and encrypt stored images.
5. Compliance mapping to India's DPDP Act and ABDM guidelines before any real data is used.
6. Mobile-friendly patient app and SMS alerts for urgent referrals.
7. Automated unit tests and a continuous-integration run on every push.
