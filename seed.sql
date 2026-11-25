-- =====================================================================
-- Synthetic seed data. NO real patient data.
-- Run AFTER schema.sql:  psql -U postgres -d recordsdb -f seed.sql
-- All provider passwords are:  Pass@123   (bcrypt-hashed via pgcrypto)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Facilities ----------
INSERT INTO facilities (facility_id, name, city) VALUES
  (1, 'City General Hospital',   'Bengaluru'),
  (2, 'Lakeview Family Clinic',  'Bengaluru'),
  (3, 'Vision Care Eye Institute','Bengaluru');

-- ---------- Providers ----------
INSERT INTO providers (provider_id, name, specialty, facility_id, email, password_hash, role) VALUES
  (1, 'Dr. Anita Rao',    'General Practice', 1, 'anita.rao@demo.test',    crypt('Pass@123', gen_salt('bf')), 'doctor'),
  (2, 'Dr. Vikram Shah',  'General Practice', 2, 'vikram.shah@demo.test',  crypt('Pass@123', gen_salt('bf')), 'doctor'),
  (3, 'Dr. Meera Iyer',   'Endocrinology',    1, 'meera.iyer@demo.test',   crypt('Pass@123', gen_salt('bf')), 'doctor'),
  (4, 'Dr. Rohan Mehta',  'Ophthalmology',    3, 'rohan.mehta@demo.test',  crypt('Pass@123', gen_salt('bf')), 'doctor'),
  (5, 'Dr. Sara Khan',    'Ophthalmology',    2, 'sara.khan@demo.test',    crypt('Pass@123', gen_salt('bf')), 'doctor'),
  (6, 'System Admin',     'Administration',   1, 'admin@demo.test',        crypt('Pass@123', gen_salt('bf')), 'admin');

-- ---------- Patients (synthetic) ----------
INSERT INTO patients (patient_id, mrn, name, dob, gender, phone, address) VALUES
  (1,  'MRN-0001', 'Arjun Nair',     '1968-03-14', 'male',   '9000000001', 'Synthetic Street 1'),
  (2,  'MRN-0002', 'Priya Menon',    '1975-07-22', 'female', '9000000002', 'Synthetic Street 2'),
  (3,  'MRN-0003', 'Kiran Desai',    '1959-11-05', 'male',   '9000000003', 'Synthetic Street 3'),
  (4,  'MRN-0004', 'Lakshmi Reddy',  '1982-01-30', 'female', '9000000004', 'Synthetic Street 4'),
  (5,  'MRN-0005', 'Rahul Verma',    '1990-09-12', 'male',   '9000000005', 'Synthetic Street 5'),
  (6,  'MRN-0006', 'Sunita Kulkarni','1963-05-19', 'female', '9000000006', 'Synthetic Street 6'),
  (7,  'MRN-0007', 'Manoj Pillai',   '1978-12-02', 'male',   '9000000007', 'Synthetic Street 7'),
  (8,  'MRN-0008', 'Divya Shetty',   '2001-04-25', 'female', '9000000008', 'Synthetic Street 8'),
  (9,  'MRN-0009', 'Harish Gowda',   '1954-08-08', 'male',   '9000000009', 'Synthetic Street 9'),
  (10, 'MRN-0010', 'Neha Joshi',     '1995-06-17', 'female', '9000000010', 'Synthetic Street 10');

-- ---------- Encounters ----------
INSERT INTO encounters (encounter_id, patient_id, provider_id, encounter_date, notes) VALUES
  (1,  1, 1, now() - interval '90 days', 'Routine check. Elevated fasting glucose.'),
  (2,  1, 3, now() - interval '60 days', 'Endocrine review. Type 2 diabetes confirmed. Started metformin.'),
  (3,  1, 2, now() - interval '20 days', 'Fever and cough for 3 days.'),
  (4,  2, 1, now() - interval '45 days', 'Hypertension follow-up. BP 150/95.'),
  (5,  2, 2, now() - interval '10 days', 'Recurrent headaches.'),
  (6,  3, 2, now() - interval '30 days', 'Diabetes follow-up. Poor glycemic control.'),
  (7,  3, 3, now() - interval '15 days', 'HbA1c review. Adjusting insulin.'),
  (8,  4, 1, now() - interval '100 days','Annual physical. Normal.'),
  (9,  5, 1, now() - interval '5 days',  'Sore throat, suspected bacterial.'),
  (10, 5, 2, now() - interval '50 days', 'Skin rash after antibiotic course.'),
  (11, 6, 3, now() - interval '70 days', 'Type 2 diabetes management.'),
  (12, 7, 2, now() - interval '25 days', 'Lower back pain.'),
  (13, 8, 1, now() - interval '12 days', 'Asthma review. Stable.'),
  (14, 9, 4, now() - interval '40 days', 'Routine eye exam.'),
  (15, 10, 1, now() - interval '8 days', 'Routine check.'),
  (16, 6, 1, now() - interval '3 days',  'Complains of blurred vision.');

-- ---------- Diagnoses ----------
INSERT INTO diagnoses (encounter_id, condition, icd_code) VALUES
  (1,  'Hyperglycemia',                    'R73.9'),
  (2,  'Type 2 diabetes mellitus',         'E11.9'),
  (3,  'Acute upper respiratory infection','J06.9'),
  (4,  'Essential hypertension',           'I10'),
  (5,  'Headache',                         'R51'),
  (6,  'Type 2 diabetes mellitus',         'E11.9'),
  (7,  'Type 2 diabetes mellitus',         'E11.9'),
  (8,  'General adult medical exam',       'Z00.00'),
  (9,  'Acute pharyngitis',                'J02.9'),
  (10, 'Drug-related skin eruption',       'L27.0'),
  (11, 'Type 2 diabetes mellitus',         'E11.9'),
  (12, 'Low back pain',                    'M54.5'),
  (13, 'Asthma',                           'J45.909'),
  (14, 'Presbyopia',                       'H52.4'),
  (15, 'General adult medical exam',       'Z00.00'),
  (16, 'Visual disturbance',               'H53.8');

-- ---------- Allergies ----------
INSERT INTO allergies (patient_id, substance, severity) VALUES
  (1, 'Sulfa',       'mild'),
  (5, 'Penicillin',  'severe'),
  (7, 'Ibuprofen',   'moderate'),
  (8, 'Aspirin',     'mild');

-- ---------- Prescriptions ----------
-- Enc 9 (Penicillin V for patient 5) and Enc 12 (Ibuprofen for patient 7)
-- deliberately conflict with allergies: used to demo the safety-check query.
INSERT INTO prescriptions (encounter_id, medicine, dosage) VALUES
  (2,  'Metformin',        '500 mg twice daily'),
  (3,  'Paracetamol',      '650 mg as needed'),
  (4,  'Amlodipine',       '5 mg once daily'),
  (6,  'Metformin',        '1000 mg twice daily'),
  (7,  'Insulin glargine', '12 units at night'),
  (9,  'Penicillin V',     '250 mg four times daily'),
  (10, 'Cetirizine',       '10 mg once daily'),
  (11, 'Metformin',        '500 mg twice daily'),
  (12, 'Ibuprofen',        '400 mg three times daily'),
  (13, 'Salbutamol inhaler','2 puffs as needed');

-- ---------- Consent records ----------
INSERT INTO consent_records (patient_id, provider_id, granted_on, expires_on, status) VALUES
  (1, 1, now() - interval '100 days', now() + interval '180 days', 'active'),
  (1, 2, now() - interval '100 days', now() + interval '180 days', 'active'),
  (1, 3, now() - interval '100 days', now() + interval '180 days', 'active'),
  (1, 4, now() - interval '50 days',  now() + interval '180 days', 'revoked'),
  (2, 1, now() - interval '60 days',  now() + interval '120 days', 'active'),
  (2, 2, now() - interval '60 days',  now() + interval '120 days', 'active'),
  (3, 2, now() - interval '60 days',  now() + interval '120 days', 'active'),
  (3, 3, now() - interval '60 days',  now() + interval '120 days', 'active'),
  (3, 1, now() - interval '200 days', now() - interval '10 days',  'active'),   -- expired
  (4, 1, now() - interval '110 days', now() + interval '250 days', 'active'),
  (5, 1, now() - interval '60 days',  now() + interval '120 days', 'active'),
  (5, 2, now() - interval '60 days',  now() + interval '120 days', 'active'),
  (6, 3, now() - interval '80 days',  now() + interval '100 days', 'active'),
  (6, 1, now() - interval '10 days',  now() + interval '100 days', 'active'),
  (6, 4, now() - interval '5 days',   now() + interval '100 days', 'active'),
  (7, 2, now() - interval '40 days',  now() + interval '140 days', 'active'),
  (8, 1, now() - interval '20 days',  now() + interval '160 days', 'active'),
  (9, 4, now() - interval '50 days',  now() + interval '130 days', 'active'),
  (10, 1, now() - interval '10 days', now() + interval '170 days', 'active');

-- ---------- Referrals ----------
INSERT INTO referrals (referral_id, patient_id, encounter_id, from_provider, to_provider, reason, urgency, status, source, created_at) VALUES
  (1, 1, 2,  3, 4, 'Diabetic eye screening',                  'routine', 'pending',   'manual', now() - interval '10 days'),
  (2, 3, 7,  3, 5, 'Diabetic eye screening',                  'urgent',  'accepted',  'manual', now() - interval '9 days'),
  (3, 6, 16, 1, 4, 'Blurred vision, rule out retinopathy',    'urgent',  'pending',   'manual', now() - interval '3 days'),
  (4, 2, 5,  2, 3, 'Hypertension with headaches, further workup','routine','completed','manual', now() - interval '8 days'),
  (5, 9, 14, 4, 1, 'Diabetes risk screening',                 'routine', 'pending',   'manual', now() - interval '20 days'),
  (6, 5, 10, 2, 1, 'Drug allergy evaluation',                 'routine', 'rejected',  'manual', now() - interval '30 days');

-- ---------- Sample access logs ----------
INSERT INTO access_logs (provider_id, patient_id, accessed_on, action, reason, granted) VALUES
  (1, 1, now() - interval '2 days', 'view_history', 'Follow-up consultation', TRUE),
  (4, 1, now() - interval '1 day',  'view_history', 'Attempted access after consent revoked', FALSE),
  (3, 3, now() - interval '4 days', 'view_history', 'HbA1c review', TRUE);

-- ---------- Re-sync sequences after explicit ids ----------
SELECT setval('facilities_facility_id_seq',   (SELECT MAX(facility_id)   FROM facilities));
SELECT setval('providers_provider_id_seq',    (SELECT MAX(provider_id)   FROM providers));
SELECT setval('patients_patient_id_seq',      (SELECT MAX(patient_id)    FROM patients));
SELECT setval('encounters_encounter_id_seq',  (SELECT MAX(encounter_id)  FROM encounters));
SELECT setval('referrals_referral_id_seq',    (SELECT MAX(referral_id)   FROM referrals));
