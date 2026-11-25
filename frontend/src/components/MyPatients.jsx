import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

function day(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}
function age(dob) {
  if (!dob) return ''
  const ms = Date.now() - new Date(dob).getTime()
  return Math.floor(ms / 31557600000)
}

// A doctor's own list: which patients have allowed ME to open their record.
// onOpen(patient) is optional. When it is given, each active row gets an "Open record" button.
export default function MyPatients({ onOpen }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    api('/access/my-patients').then(setRows).catch((e) => setError(e.message))
  }, [])

  const { active, past } = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = (rows || []).filter(
      (r) => !needle || r.name.toLowerCase().includes(needle) || r.mrn.toLowerCase().includes(needle)
    )
    return {
      active: list.filter((r) => r.effective_status === 'active'),
      past: list.filter((r) => r.effective_status !== 'active'),
    }
  }, [rows, q])

  if (error) return <div className="alert bad">{error}</div>
  if (!rows) return <div className="card muted">Loading...</div>

  const soon = active.filter((r) => r.days_left <= 14).length

  return (
    <>
      <div className="card">
        <h2>My patients</h2>
        <p className="muted">
          These are the patients who have given you access. You can open a record only while its
          access is active. When a patient removes access, or it runs out, the patient moves to
          "Past access" and you can no longer open the record.
        </p>
        <div className="chips">
          <span className="badge ok">{active.length} patient{active.length === 1 ? '' : 's'} with access now</span>
          {soon > 0 && <span className="badge pending">{soon} ending within 14 days</span>}
          {past.length > 0 && <span className="badge routine">{past.length} past</span>}
        </div>
        <div style={{ marginTop: 14, maxWidth: 360 }}>
          <label>Find in my list</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or MRN" />
        </div>
      </div>

      <div className="card scroll">
        <h3>Access I have now</h3>
        {active.length === 0 ? (
          <div className="muted">No patient has given you access right now.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Patient</th><th>Age</th><th>Access given</th><th>Access ends</th><th>Last visit</th><th /></tr>
            </thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.consent_id}>
                  <td>{r.name}<div className="muted">{r.mrn}</div></td>
                  <td className="nw">{age(r.dob)} {r.gender}</td>
                  <td className="nw">{day(r.granted_on)}</td>
                  <td className="nw">
                    {day(r.expires_on)}
                    <div>
                      <span className={`badge ${r.days_left <= 14 ? 'pending' : 'ok'}`}>
                        {r.days_left} day{r.days_left === 1 ? '' : 's'} left
                      </span>
                    </div>
                  </td>
                  <td className="nw">{day(r.last_visit)}</td>
                  <td>
                    {onOpen && <button className="small primary" onClick={() => onOpen(r)}>Open record</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {past.length > 0 && (
        <div className="card scroll">
          <h3>Past access</h3>
          <p className="muted">You can no longer open these records. Ask the patient to give access again.</p>
          <table>
            <thead>
              <tr><th>Patient</th><th>Access was given</th><th>Ended</th><th>Why it ended</th></tr>
            </thead>
            <tbody>
              {past.map((r) => (
                <tr key={r.consent_id}>
                  <td>{r.name}<div className="muted">{r.mrn}</div></td>
                  <td className="nw">{day(r.granted_on)}</td>
                  <td className="nw">{day(r.expires_on)}</td>
                  <td>
                    <span className={`badge ${r.effective_status}`}>
                      {r.effective_status === 'revoked' ? 'Patient removed it' : 'Ran out'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
