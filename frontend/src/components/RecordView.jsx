import { useEffect, useState } from 'react'
import { api, fmtDate, fmtDateTime } from '../api.js'
import Screening from './Screening.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'

export default function RecordView({ user, data, onBack, onChanged }) {
  const { patient, allergies, encounters, referrals, consent } = data
  const [panel, setPanel] = useState(null) // 'encounter' | 'referral' | null

  return (
    <>
      <div className="spread" style={{ marginBottom: 12 }}>
        <button onClick={onBack}>← Back to search</button>
        <div className="row">
          <button className="primary" onClick={() => setPanel(panel === 'encounter' ? null : 'encounter')}>New encounter</button>
          <button className={panel === 'referral' ? 'primary' : ''} onClick={() => setPanel(panel === 'referral' ? null : 'referral')}>Refer patient</button>
          <button className={panel === 'screening' ? 'primary' : ''} onClick={() => setPanel(panel === 'screening' ? null : 'screening')}>Eye screening</button>
        </div>
      </div>

      {panel === 'encounter' && (
        <EncounterForm patient={patient} onSaved={() => { setPanel(null); onChanged() }} />
      )}
      {panel === 'screening' && <Screening patient={patient} />}
      {panel === 'referral' && (
        <ReferralForm user={user} patient={patient} onSaved={() => { setPanel(null); onChanged() }} />
      )}

      <div className="card record-head">
        <div className="avatar" aria-hidden="true">{initials(patient.name)}</div>
        <div className="grow">
          <h2 style={{ marginBottom: 2 }}>{patient.name}</h2>
          <div className="muted">
            {ageFrom(patient.dob)} years old, born {fmtDate(patient.dob)}. {patient.gender}.
          </div>
          <div className="muted">Record number {patient.mrn}. Phone {patient.phone}.</div>
        </div>
        {consent && (
          <div className="consent-bar" role="status">
            <strong>The patient allows your access</strong>
            <div>Until {fmtDate(consent.expires_on)}, {consent.days_left} day{consent.days_left === 1 ? '' : 's'} left</div>
            <div className="bar"><span style={{ width: `${consentLeft(consent)}%` }} /></div>
          </div>
        )}
      </div>

      <div className={`card ${allergies.length ? `allergy ${allergyTone(allergies)}` : ''}`}>
        <h3>Allergies</h3>
        {allergies.length === 0 ? (
          <div className="muted">No known allergies recorded.</div>
        ) : (
          <div className="chips">
            {allergies.map((a) => (
              <span key={a.allergy_id} className={`badge ${a.severity}`}>{a.substance} ({a.severity})</span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>History across all providers ({encounters.length} visits)</h3>
        {encounters.length === 0 && <div className="muted">No visits recorded.</div>}
        <div className="timeline">
          {encounters.map((e) => (
            <div className="visit" key={e.encounter_id}>
              <strong>{fmtDate(e.encounter_date)}</strong>
              <div className="meta">{e.provider_name}, {e.specialty}, {e.facility}</div>
              <div style={{ marginTop: 4 }}>{e.notes}</div>
              {e.diagnoses && <div className="fact"><strong>Diagnosis</strong> {e.diagnoses}</div>}
              {e.prescriptions && <div className="fact"><strong>Prescribed</strong> {e.prescriptions}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card scroll">
        <h3>Referrals</h3>
        {referrals.length === 0 ? (
          <div className="muted">No referrals.</div>
        ) : (
          <table>
            <thead><tr><th>Date</th><th>From</th><th>To</th><th>Reason</th><th>Urgency</th><th>Status</th></tr></thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.referral_id}>
                  <td>{fmtDate(r.created_at)}</td>
                  <td>{r.from_provider}</td>
                  <td>{r.to_provider}</td>
                  <td>{r.reason}</td>
                  <td><span className={`badge ${r.urgency}`}>{r.urgency}</span></td>
                  <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function EncounterForm({ patient, onSaved }) {
  const [notes, setNotes] = useState('')
  const [dx, setDx] = useState([{ condition: '', icd_code: '' }])
  const [rx, setRx] = useState([{ medicine: '', dosage: '' }])
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [askOverride, setAskOverride] = useState(false)

  function update(list, setList, i, field, value) {
    setList(list.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  }

  async function save(override) {
    setBusy(true)
    setError('')
    try {
      await api(`/patients/${patient.patient_id}/encounters`, {
        method: 'POST',
        body: {
          notes,
          diagnoses: dx.filter((d) => d.condition.trim()).map((d) => ({
            condition: d.condition.trim(), icd_code: d.icd_code.trim() || null,
          })),
          prescriptions: rx.filter((r) => r.medicine.trim()).map((r) => ({
            medicine: r.medicine.trim(), dosage: r.dosage.trim() || 'as directed',
          })),
          override_allergy_warning: override,
        },
      })
      onSaved()
    } catch (err) {
      if (err.status === 409 && err.detail && err.detail.conflicts) {
        setConflicts(err.detail.conflicts)
      } else {
        setConflicts(null)
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>New encounter for {patient.name}</h3>
      <form onSubmit={(e) => { e.preventDefault(); setConflicts(null); save(false) }} className="stack">
        <div>
          <label>Visit notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} required minLength={3} />
        </div>

        <div>
          <label>Diagnoses (condition, ICD code)</label>
          {dx.map((d, i) => (
            <div className="inline-row" key={i} style={{ gridTemplateColumns: '2fr 1fr' }}>
              <input placeholder="Condition" value={d.condition} onChange={(e) => update(dx, setDx, i, 'condition', e.target.value)} />
              <input placeholder="ICD (optional)" value={d.icd_code} onChange={(e) => update(dx, setDx, i, 'icd_code', e.target.value)} />
            </div>
          ))}
          <button type="button" className="small" onClick={() => setDx([...dx, { condition: '', icd_code: '' }])}>+ Add diagnosis</button>
        </div>

        <div>
          <label>Prescriptions (medicine, dosage)</label>
          {rx.map((r, i) => (
            <div className="inline-row" key={i} style={{ gridTemplateColumns: '2fr 1fr' }}>
              <input placeholder="Medicine" value={r.medicine} onChange={(e) => update(rx, setRx, i, 'medicine', e.target.value)} />
              <input placeholder="Dosage" value={r.dosage} onChange={(e) => update(rx, setRx, i, 'dosage', e.target.value)} />
            </div>
          ))}
          <button type="button" className="small" onClick={() => setRx([...rx, { medicine: '', dosage: '' }])}>+ Add prescription</button>
        </div>

        {conflicts && (
          <div className="alert bad">
            <strong>Allergy conflict. Nothing was saved.</strong>
            <ul style={{ margin: '6px 0 10px', paddingLeft: 20 }}>
              {conflicts.map((c, i) => (
                <li key={i}>{c.medicine} conflicts with {c.allergy} allergy ({c.severity})</li>
              ))}
            </ul>
            <button type="button" className="danger small" disabled={busy} onClick={() => setAskOverride(true)}>
              I accept the risk: save anyway
            </button>
          </div>
        )}
        {error && <div className="alert bad">{error}</div>}

        <button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save encounter'}</button>
      </form>
      {askOverride && (
        <ConfirmDialog
          title="Save despite the allergy conflict?"
          message="The patient is allergic to something in this prescription. Saving anyway will be recorded in the audit log under your name."
          confirmText="Save anyway"
          danger
          busy={busy}
          onConfirm={async () => { await save(true); setAskOverride(false) }}
          onCancel={() => !busy && setAskOverride(false)}
        />
      )}
    </div>
  )
}

function ReferralForm({ user, patient, onSaved }) {
  const [providers, setProviders] = useState([])
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [urgency, setUrgency] = useState('routine')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/providers').then((list) => setProviders(list.filter((p) => p.provider_id !== user.provider_id))).catch((e) => setError(e.message))
  }, [user.provider_id])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/referrals', {
        method: 'POST',
        body: { patient_id: patient.patient_id, to_provider: Number(to), reason, urgency },
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>Refer {patient.name}</h3>
      <form onSubmit={submit} className="stack">
        <div>
          <label>Refer to</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} required>
            <option value="">Choose a doctor...</option>
            {providers.map((p) => (
              <option key={p.provider_id} value={p.provider_id}>{p.name}: {p.specialty}, {p.facility}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Reason</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
        </div>
        <div>
          <label>Urgency</label>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
        {error && <div className="alert bad">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Sending...' : 'Send referral'}</button>
      </form>
    </div>
  )
}

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function ageFrom(dob) {
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age -= 1
  return age
}

// share of the permission period still left, 0 to 100
function consentLeft(c) {
  const start = new Date(c.granted_on).getTime()
  const end = new Date(c.expires_on).getTime()
  return Math.max(0, Math.min(100, Math.round(((end - Date.now()) / (end - start)) * 100)))
}

function allergyTone(list) {
  if (list.some((a) => a.severity === 'severe')) return 'severe'
  if (list.some((a) => a.severity === 'moderate')) return 'moderate'
  return 'mild'
}
