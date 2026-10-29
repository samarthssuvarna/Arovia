import { useCallback, useEffect, useState } from 'react'
import { actionLabel, api, fmtDateTime } from '../api.js'
import Loading from './Loading.jsx'

export default function Audit() {
  const [rows, setRows] = useState([])
  const [deniedOnly, setDeniedOnly] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await api('/audit'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const shown = deniedOnly ? rows.filter((r) => !r.granted) : rows

  return (
    <div className="card scroll">
      <div className="spread">
        <h2>Access audit log</h2>
        <div className="row">
          <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={deniedOnly} onChange={(e) => setDeniedOnly(e.target.checked)} />
            Show denied only
          </label>
          <button className="small" onClick={load}>Refresh</button>
        </div>
      </div>
      <p className="muted">Every read and write is recorded, including attempts the system refused.</p>
      {error && <div className="alert bad">{error}</div>}
      {!loaded && <Loading />}
      {loaded && <table>
        <thead>
          <tr><th>When</th><th>Doctor</th><th>Patient</th><th>Action</th><th>Reason</th><th>Result</th></tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.log_id}>
              <td>{fmtDateTime(r.accessed_on)}</td>
              <td>{r.provider}</td>
              <td>{r.patient}</td>
              <td>{actionLabel(r.action)}</td>
              <td>{r.reason}</td>
              <td><span className={`badge ${r.granted ? 'ok' : 'denied'}`}>{r.granted ? 'allowed' : 'denied'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>}
      {loaded && shown.length === 0 && !error && (
        <div className="muted">
          {deniedOnly ? 'No refused attempts. Everything was allowed.' : 'No activity has been recorded yet.'}
        </div>
      )}
    </div>
  )
}
