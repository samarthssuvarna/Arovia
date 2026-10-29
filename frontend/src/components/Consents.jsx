import { useCallback, useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import { useToast } from './Toast.jsx'

export default function Consents({ user }) {
  const isAdmin = user.role === 'admin'
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [asking, setAsking] = useState(null)
  const [pending, setPending] = useState([])
  const toast = useToast()

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await api(isAdmin ? '/consents' : '/consents/mine'))
    } catch (err) {
      setError(err.message)
    }
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  // Critical: ask first. After "yes" there is still a short undo window.
  function startRevoke(c) {
    setAsking(null)
    setPending((ids) => [...ids, c.consent_id])
    const forget = () => setPending((ids) => ids.filter((id) => id !== c.consent_id))
    toast.undoable(
      `Consent revoked for ${c.patient} and ${c.provider}`,
      async () => {
        try {
          await api(`/consents/${c.consent_id}/revoke`, { method: 'POST' })
          await load()
        } catch (err) {
          setError(err.message)
        } finally {
          forget()
        }
      },
      forget,
    )
  }

  return (
    <>
      {isAdmin && <GrantForm onGranted={(msg) => { setNotice(msg); load() }} onError={setError} />}

      <div className="card scroll">
        <h2>{isAdmin ? 'All consent records' : 'Patients who have given me access'}</h2>
        {!isAdmin && (
          <p className="muted">You can open a patient's record only while consent is active. Expired or revoked consent is refused by the server.</p>
        )}
        {notice && <div className="alert ok">{notice}</div>}
        {error && <div className="alert bad">{error}</div>}
        {rows.length === 0 ? (
          <div className="muted">No consent records.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Patient</th>{isAdmin && <th>Doctor</th>}<th>Granted</th><th>Expires</th><th>Status</th>{isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.consent_id}>
                  <td>{c.patient}</td>
                  {isAdmin && <td>{c.provider}</td>}
                  <td>{fmtDate(c.granted_on)}</td>
                  <td>{fmtDate(c.expires_on)}</td>
                  <td>
                    {pending.includes(c.consent_id)
                      ? <span className="badge revoked">revoking</span>
                      : <span className={`badge ${c.effective_status}`}>{c.effective_status}</span>}
                  </td>
                  {isAdmin && (
                    <td>
                      {c.effective_status === 'active' && !pending.includes(c.consent_id) && (
                        <button className="small danger" onClick={() => setAsking(c)}>Revoke</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {asking && (
        <ConfirmDialog
          title="Revoke this consent?"
          message={`${asking.provider} will lose access to ${asking.patient}'s record straight away.`}
          confirmText="Revoke consent"
          danger
          onConfirm={() => startRevoke(asking)}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  )
}

function GrantForm({ onGranted, onError }) {
  const [q, setQ] = useState('')
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState('')
  const [providers, setProviders] = useState([])
  const [providerId, setProviderId] = useState('')
  const [days, setDays] = useState(90)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/providers').then(setProviders).catch((e) => onError(e.message))
  }, [onError])

  async function search(e) {
    e.preventDefault()
    onError('')
    try {
      const list = await api('/patients/search', { params: { q } })
      setPatients(list)
      setPatientId(list[0] ? String(list[0].patient_id) : '')
    } catch (err) {
      onError(err.status === 422 ? 'Type at least 2 characters to search' : err.message)
    }
  }

  async function grant(e) {
    e.preventDefault()
    setBusy(true)
    onError('')
    try {
      await api('/consents', {
        method: 'POST',
        body: { patient_id: Number(patientId), provider_id: Number(providerId), days: Number(days) },
      })
      onGranted('Consent granted.')
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Record patient consent</h2>
      <p className="muted">Records a patient's decision to let a doctor see their record. Revoking or expiry cuts access immediately.</p>

      <form onSubmit={search} className="row" style={{ marginBottom: 12 }}>
        <input className="grow" placeholder="Search patient by name or MRN" value={q} onChange={(e) => setQ(e.target.value)} />
        <button>Search</button>
      </form>

      <form onSubmit={grant} className="row">
        <div className="grow">
          <label>Patient</label>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
            <option value="">Search first...</option>
            {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.name} ({p.mrn})</option>)}
          </select>
        </div>
        <div className="grow">
          <label>Give access to</label>
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} required>
            <option value="">Choose a doctor...</option>
            {providers.map((p) => <option key={p.provider_id} value={p.provider_id}>{p.name}: {p.specialty}</option>)}
          </select>
        </div>
        <div style={{ width: 110 }}>
          <label>Days</label>
          <input type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Grant consent'}</button>
        </div>
      </form>
    </div>
  )
}
