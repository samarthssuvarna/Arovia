import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const KIND = {
  visit: 'Visit',
  consent: 'Access',
  access: 'Record opened',
  denied: 'Refused',
  referral: 'Referral',
  screening: 'Eye screening',
}

const FILTERS = [
  ['all', 'Everything'],
  ['visit', 'Visits'],
  ['consent', 'Access I gave'],
  ['access', 'Who opened it'],
  ['referral', 'Referrals'],
  ['screening', 'Eye screening'],
]

function when(d) {
  const t = new Date(d)
  return {
    day: t.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  }
}

// The patient's own story: what happened to their record and when.
export default function PatientSummary() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api('/access/my-summary').then(setData).catch((e) => setError(e.message))
  }, [])

  const items = useMemo(() => {
    if (!data) return []
    return data.timeline.filter((e) => {
      if (filter === 'all') return true
      if (filter === 'access') return e.kind === 'access' || e.kind === 'denied'
      return e.kind === filter
    })
  }, [data, filter])

  if (error) return <div className="alert bad">{error}</div>
  if (!data) return <div className="card muted">Loading...</div>

  const c = data.counts

  return (
    <>
      <div className="card">
        <h2>My record summary</h2>
        <p className="muted">
          Everything that has happened to your health record, newest first: visits, who you gave
          access to, who opened your record, referrals and eye screenings.
        </p>
        {data.allergies.length > 0 && (
          <div className="chips" style={{ marginTop: 6 }}>
            <span className="muted">Allergies on file:</span>
            {data.allergies.map((a) => (
              <span key={a.substance} className={`badge ${a.severity}`}>{a.substance}</span>
            ))}
          </div>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="num">{c.visits}</div><div className="lbl">Visits</div></div>
        <div className="stat ok"><div className="num">{c.doctors_with_access}</div><div className="lbl">Doctors with access now</div></div>
        <div className="stat"><div className="num">{c.record_opens}</div><div className="lbl">Times a doctor opened it</div></div>
        <div className={`stat ${c.refused ? 'bad' : ''}`}><div className="num">{c.refused}</div><div className="lbl">Refused attempts</div></div>
        <div className="stat"><div className="num">{c.referrals}</div><div className="lbl">Referrals</div></div>
        <div className="stat"><div className="num">{c.screenings}</div><div className="lbl">Eye screenings</div></div>
      </div>

      <div className="card">
        <div className="tl-head">
          <h3>What happened, and when</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show">
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {items.length === 0 ? (
          <div className="muted">Nothing to show for this filter.</div>
        ) : (
          <ol className="timeline">
            {items.map((e, i) => {
              const w = when(e.when)
              return (
                <li key={i} className={`tl-item ${e.tone}`}>
                  <span className="tl-dot" />
                  <div className="tl-when">{w.day}<span>{w.time}</span></div>
                  <div className="tl-body">
                    <div className="tl-kind">{KIND[e.kind] || e.kind}</div>
                    <div className="tl-title">{e.title}</div>
                    {e.detail && <div className="muted">{e.detail}</div>}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </>
  )
}
