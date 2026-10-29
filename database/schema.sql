--
-- PostgreSQL database dump
--

\restrict eSNGQX9agJQNmNJBRAeGmKnIKiQrOuXTnWetLn3Js4zarod0GV0Z5gXglXzBGsl

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: has_valid_consent(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_valid_consent(p_provider integer, p_patient integer) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM consent_records
        WHERE provider_id = p_provider
          AND patient_id  = p_patient
          AND status = 'active'
          AND expires_on > now()
    );
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_logs (
    log_id bigint NOT NULL,
    provider_id integer,
    patient_id integer NOT NULL,
    accessed_on timestamp with time zone DEFAULT now() NOT NULL,
    action character varying(30) NOT NULL,
    reason text NOT NULL,
    granted boolean DEFAULT true NOT NULL,
    actor_patient_id integer,
    CONSTRAINT access_logs_one_actor CHECK (((((provider_id IS NOT NULL))::integer + ((actor_patient_id IS NOT NULL))::integer) = 1))
);


--
-- Name: access_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.access_logs_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: access_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.access_logs_log_id_seq OWNED BY public.access_logs.log_id;


--
-- Name: allergies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allergies (
    allergy_id integer NOT NULL,
    patient_id integer NOT NULL,
    substance character varying(100) NOT NULL,
    severity character varying(10) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT allergies_severity_check CHECK (((severity)::text = ANY ((ARRAY['mild'::character varying, 'moderate'::character varying, 'severe'::character varying])::text[])))
);


--
-- Name: allergies_allergy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.allergies_allergy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: allergies_allergy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.allergies_allergy_id_seq OWNED BY public.allergies.allergy_id;


--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_records (
    consent_id integer NOT NULL,
    patient_id integer NOT NULL,
    provider_id integer NOT NULL,
    granted_on timestamp with time zone DEFAULT now() NOT NULL,
    expires_on timestamp with time zone NOT NULL,
    status character varying(10) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT consent_records_check CHECK ((expires_on > granted_on)),
    CONSTRAINT consent_records_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'revoked'::character varying])::text[])))
);


--
-- Name: consent_records_consent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consent_records_consent_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consent_records_consent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consent_records_consent_id_seq OWNED BY public.consent_records.consent_id;


--
-- Name: diagnoses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnoses (
    diagnosis_id integer NOT NULL,
    encounter_id integer NOT NULL,
    condition character varying(200) NOT NULL,
    icd_code character varying(10)
);


--
-- Name: diagnoses_diagnosis_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.diagnoses_diagnosis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: diagnoses_diagnosis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.diagnoses_diagnosis_id_seq OWNED BY public.diagnoses.diagnosis_id;


--
-- Name: encounters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounters (
    encounter_id integer NOT NULL,
    patient_id integer NOT NULL,
    provider_id integer NOT NULL,
    encounter_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: encounters_encounter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.encounters_encounter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: encounters_encounter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.encounters_encounter_id_seq OWNED BY public.encounters.encounter_id;


--
-- Name: facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facilities (
    facility_id integer NOT NULL,
    name character varying(150) NOT NULL,
    city character varying(100)
);


--
-- Name: facilities_facility_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facilities_facility_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facilities_facility_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facilities_facility_id_seq OWNED BY public.facilities.facility_id;


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    patient_id integer NOT NULL,
    mrn character varying(20) NOT NULL,
    name character varying(120) NOT NULL,
    dob date NOT NULL,
    gender character varying(10),
    phone character varying(20),
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    password_hash text,
    CONSTRAINT patients_dob_check CHECK ((dob <= CURRENT_DATE)),
    CONSTRAINT patients_gender_check CHECK (((gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: patients_patient_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patients_patient_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patients_patient_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patients_patient_id_seq OWNED BY public.patients.patient_id;


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescriptions (
    prescription_id integer NOT NULL,
    encounter_id integer NOT NULL,
    medicine character varying(120) NOT NULL,
    dosage character varying(100) NOT NULL
);


--
-- Name: prescriptions_prescription_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prescriptions_prescription_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prescriptions_prescription_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prescriptions_prescription_id_seq OWNED BY public.prescriptions.prescription_id;


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    provider_id integer NOT NULL,
    name character varying(120) NOT NULL,
    specialty character varying(80) NOT NULL,
    facility_id integer NOT NULL,
    email character varying(150) NOT NULL,
    password_hash text NOT NULL,
    role character varying(20) DEFAULT 'doctor'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT providers_role_check CHECK (((role)::text = ANY ((ARRAY['doctor'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: providers_provider_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.providers_provider_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: providers_provider_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.providers_provider_id_seq OWNED BY public.providers.provider_id;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    referral_id integer NOT NULL,
    patient_id integer NOT NULL,
    encounter_id integer,
    from_provider integer NOT NULL,
    to_provider integer NOT NULL,
    reason text NOT NULL,
    urgency character varying(10) DEFAULT 'routine'::character varying NOT NULL,
    status character varying(12) DEFAULT 'pending'::character varying NOT NULL,
    source character varying(10) DEFAULT 'manual'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referrals_check CHECK ((from_provider <> to_provider)),
    CONSTRAINT referrals_source_check CHECK (((source)::text = ANY ((ARRAY['manual'::character varying, 'ai_dr'::character varying])::text[]))),
    CONSTRAINT referrals_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'completed'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT referrals_urgency_check CHECK (((urgency)::text = ANY ((ARRAY['routine'::character varying, 'urgent'::character varying, 'emergency'::character varying])::text[])))
);


--
-- Name: referrals_referral_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referrals_referral_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referrals_referral_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referrals_referral_id_seq OWNED BY public.referrals.referral_id;


--
-- Name: screening_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.screening_results (
    screening_id integer NOT NULL,
    patient_id integer NOT NULL,
    encounter_id integer,
    image_ref text NOT NULL,
    gradcam_ref text,
    dr_grade smallint NOT NULL,
    confidence numeric(5,4) NOT NULL,
    screened_by integer NOT NULL,
    screened_on timestamp with time zone DEFAULT now() NOT NULL,
    flagged_referral_id integer,
    model_version text DEFAULT 'unknown'::text NOT NULL,
    reviewed_grade smallint,
    review_note text,
    CONSTRAINT screening_flag_needs_grade2 CHECK (((flagged_referral_id IS NULL) OR (dr_grade >= 2))),
    CONSTRAINT screening_results_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT screening_results_dr_grade_check CHECK (((dr_grade >= 0) AND (dr_grade <= 4))),
    CONSTRAINT screening_results_reviewed_grade_check CHECK (((reviewed_grade >= 0) AND (reviewed_grade <= 4)))
);


--
-- Name: screening_results_screening_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.screening_results_screening_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: screening_results_screening_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.screening_results_screening_id_seq OWNED BY public.screening_results.screening_id;


--
-- Name: v_allergy_conflicts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_allergy_conflicts AS
 SELECT p.patient_id,
    p.name AS patient,
    a.substance,
    a.severity,
    rx.prescription_id,
    rx.medicine,
    e.encounter_id
   FROM (((public.prescriptions rx
     JOIN public.encounters e ON ((e.encounter_id = rx.encounter_id)))
     JOIN public.patients p ON ((p.patient_id = e.patient_id)))
     JOIN public.allergies a ON (((a.patient_id = p.patient_id) AND a.is_active)))
  WHERE (lower((rx.medicine)::text) ~~ (('%'::text || lower((a.substance)::text)) || '%'::text));


--
-- Name: v_latest_encounter; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_latest_encounter AS
 SELECT encounter_id,
    patient_id,
    provider_id,
    encounter_date,
    notes,
    rn
   FROM ( SELECT e.encounter_id,
            e.patient_id,
            e.provider_id,
            e.encounter_date,
            e.notes,
            row_number() OVER (PARTITION BY e.patient_id ORDER BY e.encounter_date DESC) AS rn
           FROM public.encounters e) t
  WHERE (rn = 1);


--
-- Name: v_patient_history; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_patient_history AS
 SELECT e.patient_id,
    e.encounter_id,
    e.encounter_date,
    pr.name AS provider_name,
    pr.specialty,
    f.name AS facility,
    e.notes,
    ( SELECT string_agg((d.condition)::text, '; '::text) AS string_agg
           FROM public.diagnoses d
          WHERE (d.encounter_id = e.encounter_id)) AS diagnoses,
    ( SELECT string_agg((((rx.medicine)::text || ' '::text) || (rx.dosage)::text), '; '::text) AS string_agg
           FROM public.prescriptions rx
          WHERE (rx.encounter_id = e.encounter_id)) AS prescriptions
   FROM ((public.encounters e
     JOIN public.providers pr ON ((pr.provider_id = e.provider_id)))
     JOIN public.facilities f ON ((f.facility_id = pr.facility_id)));


--
-- Name: access_logs log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs ALTER COLUMN log_id SET DEFAULT nextval('public.access_logs_log_id_seq'::regclass);


--
-- Name: allergies allergy_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergies ALTER COLUMN allergy_id SET DEFAULT nextval('public.allergies_allergy_id_seq'::regclass);


--
-- Name: consent_records consent_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records ALTER COLUMN consent_id SET DEFAULT nextval('public.consent_records_consent_id_seq'::regclass);


--
-- Name: diagnoses diagnosis_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses ALTER COLUMN diagnosis_id SET DEFAULT nextval('public.diagnoses_diagnosis_id_seq'::regclass);


--
-- Name: encounters encounter_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters ALTER COLUMN encounter_id SET DEFAULT nextval('public.encounters_encounter_id_seq'::regclass);


--
-- Name: facilities facility_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities ALTER COLUMN facility_id SET DEFAULT nextval('public.facilities_facility_id_seq'::regclass);


--
-- Name: patients patient_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients ALTER COLUMN patient_id SET DEFAULT nextval('public.patients_patient_id_seq'::regclass);


--
-- Name: prescriptions prescription_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions ALTER COLUMN prescription_id SET DEFAULT nextval('public.prescriptions_prescription_id_seq'::regclass);


--
-- Name: providers provider_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers ALTER COLUMN provider_id SET DEFAULT nextval('public.providers_provider_id_seq'::regclass);


--
-- Name: referrals referral_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals ALTER COLUMN referral_id SET DEFAULT nextval('public.referrals_referral_id_seq'::regclass);


--
-- Name: screening_results screening_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screening_results ALTER COLUMN screening_id SET DEFAULT nextval('public.screening_results_screening_id_seq'::regclass);


--
-- Name: access_logs access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_pkey PRIMARY KEY (log_id);


--
-- Name: allergies allergies_patient_id_substance_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_patient_id_substance_key UNIQUE (patient_id, substance);


--
-- Name: allergies allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_pkey PRIMARY KEY (allergy_id);


--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (consent_id);


--
-- Name: diagnoses diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (diagnosis_id);


--
-- Name: encounters encounters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_pkey PRIMARY KEY (encounter_id);


--
-- Name: facilities facilities_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_name_key UNIQUE (name);


--
-- Name: facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (facility_id);


--
-- Name: patients patients_mrn_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_mrn_key UNIQUE (mrn);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (patient_id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (prescription_id);


--
-- Name: providers providers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_email_key UNIQUE (email);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (provider_id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (referral_id);


--
-- Name: screening_results screening_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screening_results
    ADD CONSTRAINT screening_results_pkey PRIMARY KEY (screening_id);


--
-- Name: idx_access_logs_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_logs_patient ON public.access_logs USING btree (patient_id, accessed_on DESC);


--
-- Name: idx_consent_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_lookup ON public.consent_records USING btree (patient_id, provider_id, status);


--
-- Name: idx_encounters_patient_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encounters_patient_date ON public.encounters USING btree (patient_id, encounter_date DESC);


--
-- Name: idx_referrals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_status ON public.referrals USING btree (status, created_at);


--
-- Name: idx_referrals_to_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_to_provider ON public.referrals USING btree (to_provider, status);


--
-- Name: idx_screening_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_screening_patient ON public.screening_results USING btree (patient_id, screened_on DESC);


--
-- Name: patients_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patients_email_key ON public.patients USING btree (email);


--
-- Name: referrals trg_referrals_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_referrals_touch BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: access_logs access_logs_actor_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_actor_patient_id_fkey FOREIGN KEY (actor_patient_id) REFERENCES public.patients(patient_id);


--
-- Name: access_logs access_logs_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: access_logs access_logs_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(provider_id);


--
-- Name: allergies allergies_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;


--
-- Name: consent_records consent_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;


--
-- Name: consent_records consent_records_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(provider_id);


--
-- Name: diagnoses diagnoses_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id) ON DELETE CASCADE;


--
-- Name: encounters encounters_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE RESTRICT;


--
-- Name: encounters encounters_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(provider_id);


--
-- Name: prescriptions prescriptions_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id) ON DELETE CASCADE;


--
-- Name: providers providers_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id);


--
-- Name: referrals referrals_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: referrals referrals_from_provider_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_from_provider_fkey FOREIGN KEY (from_provider) REFERENCES public.providers(provider_id);


--
-- Name: referrals referrals_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: referrals referrals_to_provider_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_to_provider_fkey FOREIGN KEY (to_provider) REFERENCES public.providers(provider_id);


--
-- Name: screening_results screening_results_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screening_results
    ADD CONSTRAINT screening_results_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: screening_results screening_results_flagged_referral_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screening_results
    ADD CONSTRAINT screening_results_flagged_referral_id_fkey FOREIGN KEY (flagged_referral_id) REFERENCES public.referrals(referral_id);


--
-- Name: screening_results screening_results_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screening_results
    ADD CONSTRAINT screening_results_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: screening_results screening_results_screened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screening_results
    ADD CONSTRAINT screening_results_screened_by_fkey FOREIGN KEY (screened_by) REFERENCES public.providers(provider_id);


--
-- PostgreSQL database dump complete
--

\unrestrict eSNGQX9agJQNmNJBRAeGmKnIKiQrOuXTnWetLn3Js4zarod0GV0Z5gXglXzBGsl

