import { useCallback, useEffect, useState } from 'react'
import { api, apiBlob, apiUpload, fmtDateTime } from '../api.js'
import Loading from './Loading.jsx'

const BADGE = ['ok', 'mild', 'moderate', 'severe', 'emergency']
const NAMES = ['No DR', 'Mild', 'Moderate', 'Severe', 'Proliferative']

function SecureImage({ id, kind, alt }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    let made = null
    apiBlob(`/screenings/${id}/image`, { kind })
      .then((u) => {
        if (!live) { URL.revokeObjectURL(u); return }
        made = u
        setUrl(u)
      })
      .catch(() => live && setFailed(true))
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [id, kind])

  if (failed) return <div className="muted">Image unavailable</div>
  if (!url) return <Loading text="" />
  return <img className="scan" src={url} alt={alt} />
}

function ResultCard({ s, onSaved }) {
  const [grade, setGrade] = useState(s.reviewed_grade ?? s.dr_grade)
  const [note, setNote] = useState(s.review_note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function saveReview(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/screenings/${s.screening_id}/review`, {
        method: 'PATCH', body: { reviewed_grade: Number(grade), review_note: note || null },
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
      <div className="spread">
        <h3>
          AI grade: <span className={`badge ${BADGE[s.dr_grade]}`}>Grade {s.dr_grade}, {NAMES[s.dr_grade]}</span>
        </h3>
        <span className="muted">
          {fmtDateTime(s.screened_on)}, by {s.screened_by_name || 'you'}, confidence {Math.round(s.confidence * 100)}%
        </span>
      </div>
      {s.is_demo && (
        <div className="alert warn">
          Demo model ({s.model_version}). This grade is NOT a medical result.
        </div>
      )}
      {s.flagged_referral_id && (
        <div className="alert info">
          Referral #{s.flagged_referral_id} to {s.referral_to} ·{' '}
          <span className={`badge ${s.referral_urgency}`}>{s.referral_urgency}</span>{' '}
          <span className={`badge ${s.referral_status}`}>{s.referral_status}</span>
        </div>
      )}
      <div className="pair">
        <div><div className="muted">Retinal image</div><SecureImage id={s.screening_id} kind="original" alt="Retinal image" /></div>
        <div><div className="muted">Grad-CAM heatmap (areas that drove the grade)</div><SecureImage id={s.screening_id} kind="heatmap" alt="Grad-CAM heatmap" /></div>
      </div>

      <form onSubmit={saveReview} className="row" style={{ marginTop: 12 }}>
        <div style={{ width: 200 }}>
          <label>Doctor's grade</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            {NAMES.map((n, i) => <option key={i} value={i}>{i} · {n}</option>)}
          </select>
        </div>
        <div className="grow">
          <label>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button disabled={busy}>{busy ? 'Saving...' : s.reviewed_grade != null ? 'Update review' : 'Confirm grade'}</button>
        </div>
      </form>
      {s.reviewed_grade != null && (
        <div className="muted" style={{ marginTop: 6 }}>Doctor reviewed this as grade {s.reviewed_grade} · {NAMES[s.reviewed_grade]}.</div>
      )}
      {error && <div className="alert bad">{error}</div>}
    </div>
  )
}

export default function Screening({ patient }) {
  const [status, setStatus] = useState(null)
  const [list, setList] = useState(null)
  const [file, setFile] = useState(null)
  const [simulate, setSimulate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      setList(await api(`/screenings/patients/${patient.patient_id}`))
    } catch (err) {
      setError(err.message)
      setList([])
    }
  }, [patient.patient_id])

  useEffect(() => {
    api('/screenings/status').then(setStatus).catch((e) => setError(e.message))
    load()
  }, [load])

  async function upload(e) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiUpload(`/screenings/patients/${patient.patient_id}`, form, { simulate_grade: simulate })
      setNotice(res.referral_note || `Grade ${res.dr_grade}: no referral needed.`)
      setFile(null)
      e.target.reset()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card">
        <h3>Diabetic retinopathy screening for {patient.name}</h3>
        <p className="muted">
          Upload a retinal photo. The model suggests a grade from 0 (no DR) to 4 (proliferative) and
          highlights what it looked at. The AI only assists: you confirm or correct the grade.
        </p>
        {status && status.is_demo && (
          <div className="alert warn">
            Demo model running (not trained). Grades are for showing the workflow only and are not medical results.
          </div>
        )}
        <form onSubmit={upload} className="row">
          <div className="grow">
            <label>Retinal image (JPG or PNG, up to 8 MB)</label>
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files[0] || null)} required />
          </div>
          {status && status.is_demo && (
            <div style={{ width: 210 }}>
              <label>Demo only: pretend grade</label>
              <select value={simulate} onChange={(e) => setSimulate(e.target.value)}>
                <option value="">Use model output</option>
                {NAMES.map((n, i) => <option key={i} value={i}>{i} · {n}</option>)}
              </select>
            </div>
          )}
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="primary" disabled={busy || !file}>{busy ? 'Analysing...' : 'Analyse image'}</button>
          </div>
        </form>
        {notice && <div className="alert ok">{notice}</div>}
        {error && <div className="alert bad">{error}</div>}
      </div>

      {list === null && <Loading />}
      {list && list.length === 0 && !error && <div className="muted">No screenings yet for this patient.</div>}
      {list && list.map((s) => <ResultCard key={s.screening_id} s={s} onSaved={load} />)}
    </>
  )
}
