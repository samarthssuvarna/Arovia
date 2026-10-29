import { useCallback, useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'

export default function PatientConsents() {
  const [rows, setRows] = useState([])
  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState('')
  const [days, setDays] = useState(90)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await api('/portal/consents'))
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
    api('/portal/doctors').then(setDoctors).catch((e) => setError(e.message))
  }, [load])

  async function grant(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api('/portal/consents', { method: 'POST', body: { provider_id: Number(doctorId), days: Number(days) } })
      setNotice('Access granted. The doctor can now open your record.')
      setDoctorId('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id) {
    setError('')
    setNotice('')
    try {
      await api(`/portal/consents/${id}/revoke`, { method: 'POST' })
      setNotice('Access removed. The doctor can no longer open your record.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const active = rows.filter((r) => r.effective_status === 'active')

  return (
    <>
      <div className="card">
        <h2>Who can see my health record</h2>
        <p className="muted">
          Only doctors you allow can open your record. You can take access back at any time and it
          stops immediately. Every time a doctor tries to open your record, it is written to your activity list.
        </p>
        <div className="chips">
          <span className="badge ok">{active.length} doctor{active.length === 1 ? '' : 's'} with access now</span>
        </div>
      </div>

      <div className="card">
        <h3>Give a doctor access</h3>
        <form onSubmit={grant} className="row">
          <div className="grow">
            <label>Doctor</label>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
              <option value="">Choose a doctor...</option>
              {doctors.map((d) => (
                <option key={d.provider_id} value={d.provider_id}>{d.name}: {d.specialty}, {d.facility}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 150 }}>
            <label>For how long</label>
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>6 months</option>
              <option value={365}>1 year</option>
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Give access'}</button>
          </div>
        </form>
        {notice && <div className="alert ok">{notice}</div>}
        {error && <div className="alert bad">{error}</div>}
      </div>

      <div className="card scroll">
        <h3>My access list</h3>
        {rows.length === 0 ? (
          <div className="muted">You have not given anyone access yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Doctor</th><th>Where</th><th>Given on</th><th>Ends on</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.consent_id}>
                  <td>{r.provider}<div className="muted">{r.specialty}</div></td>
                  <td>{r.facility}</td>
                  <td>{fmtDate(r.granted_on)}</td>
                  <td>{fmtDate(r.expires_on)}</td>
                  <td><span className={`badge ${r.effective_status}`}>{r.effective_status}</span></td>
                  <td>
                    {r.effective_status === 'active' && (
                      <button className="small danger" onClick={() => revoke(r.consent_id)}>Remove access</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
