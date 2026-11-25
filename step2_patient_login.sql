-- Step 2: let patients log in.
-- Safe to run more than once. Nothing is deleted.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Two new columns on patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Give each demo patient a login:  mrn-0001@demo.test  /  Pass@123
UPDATE patients
SET email         = lower(mrn) || '@demo.test',
    password_hash = crypt('Pass@123', gen_salt('bf'))
WHERE email IS NULL;

-- 3. Two patients cannot share an email
CREATE UNIQUE INDEX IF NOT EXISTS patients_email_key ON patients (email);

-- 4. Check: should list every patient with an email
SELECT patient_id, mrn, name, email FROM patients ORDER BY patient_id;
