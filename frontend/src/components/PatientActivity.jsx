import { useEffect, useState } from 'react'
import { actionLabel, api, fmtDateTime } from '../api.js'


export default function PatientActivity() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api('/portal/access-log')
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true))
  }, [])

  const denied = rows.filter((r) => !r.granted).length

  return (
    <>
      <div className="card">
        <h2>Who looked at my record</h2>
        <p className="muted">
          Every attempt is listed, including ones that were refused because the doctor did not have your permission.
        </p>
        {loaded && (
          <div className="chips">
            <span className="badge ok">{rows.length - denied} allowed</span>
            <span className={`badge ${denied ? 'denied' : 'ok'}`}>{denied} refused</span>
          </div>
        )}
      </div>

      {error && <div className="alert bad">{error}</div>}

      <div className="card scroll">
        {loaded && rows.length === 0 ? (
          <div className="muted">Nobody has tried to open your record yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>When</th><th>Who</th><th>What</th><th>Details</th><th>Result</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.log_id}>
                  <td>{fmtDateTime(r.accessed_on)}</td>
                  <td>{r.actor}</td>
                  <td>{actionLabel(r.action)}</td>
                  <td>{r.reason}</td>
                  <td><span className={`badge ${r.granted ? 'ok' : 'denied'}`}>{r.granted ? 'allowed' : 'refused'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
