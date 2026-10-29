import { useEffect, useState } from 'react'
import { actionLabel, api, fmtDate, fmtDateTime } from '../api.js'
import Loading from './Loading.jsx'

const DOCTOR_CARDS = [
  ['incoming_pending', 'Referrals waiting for you', 'referrals', 'warn'],
  ['urgent_pending', 'Urgent or emergency', 'referrals', 'bad'],
  ['outgoing_open', 'Your open referrals', 'referrals', ''],
  ['patients_with_access', 'Patients you can open', 'patients', 'ok'],
]

const ADMIN_CARDS = [
  ['patients', 'Patients on file', null, ''],
  ['active_consents', 'Active consents', 'consents', 'ok'],
  ['expiring_soon', 'Expiring in 14 days', 'consents', 'warn'],
  ['denied_7d', 'Denied attempts in 7 days', 'audit', 'bad'],
]

const URGENCY_RANK = { emergency: 0, urgent: 1, routine: 2 }

export default function Dashboard({ user, goTo }) {
  const isAdmin = user.role === 'admin'
  const [data, setData] = useState(null)
  const [waiting, setWaiting] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message))
    if (!isAdmin) {
      api('/referrals', { params: { direction: 'incoming', status: 'pending' } })
        .then((list) => setWaiting(
          [...list].sort((a, b) =>
            URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
            new Date(a.created_at) - new Date(b.created_at))
        ))
        .catch(() => setWaiting([]))
    }
  }, [isAdmin])

  const cards = isAdmin ? ADMIN_CARDS : DOCTOR_CARDS

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 2 }}>Welcome, {user.name}</h2>
        <div className="muted">
          {isAdmin
            ? 'Keep patient consent current and watch for refused access attempts.'
            : 'The referrals that need you are listed first.'}
        </div>
      </div>

      {error && <div className="alert bad">{error}</div>}
      {!data && !error && <Loading />}

      {data && (
        <div className="stat-grid">
          {cards.map(([key, label, tab, tone]) => (
            <button
              key={key}
              className={`stat ${tone}`}
              disabled={!tab}
              onClick={() => tab && goTo(tab)}
            >
              <span className="num">{data.cards[key]}</span>
              <span className="lbl">{label}</span>
            </button>
          ))}
        </div>
      )}

      {!isAdmin && (
        <div className="card scroll">
          <div className="spread" style={{ marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>Waiting for your reply</h3>
            <button className="small" onClick={() => goTo('referrals')}>Open referrals</button>
          </div>
          {waiting === null ? (
            <Loading />
          ) : waiting.length === 0 ? (
            <div className="muted">Nothing is waiting. New referrals sent to you will appear here.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Urgency</th><th>Patient</th><th>Reason</th><th>From</th><th>Sent</th></tr>
              </thead>
              <tbody>
                {waiting.slice(0, 5).map((r) => (
                  <tr key={r.referral_id}>
                    <td><span className={`badge ${r.urgency}`}>{r.urgency}</span></td>
                    <td>{r.patient}</td>
                    <td>{r.reason}</td>
                    <td>{r.from_provider}</td>
                    <td>{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {waiting && waiting.length > 5 && (
            <div className="muted" style={{ marginTop: 8 }}>{waiting.length - 5} more in Referrals.</div>
          )}
        </div>
      )}

      {data && (
        <div className="card scroll">
          <h3>{isAdmin ? 'Latest access activity' : 'Your recent activity'}</h3>
          {data.recent.length === 0 ? (
            <div className="muted">No activity yet. Search for a patient to get started.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  {isAdmin && <th>Doctor</th>}
                  <th>Patient</th><th>What happened</th><th>Result</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={i}>
                    <td>{fmtDateTime(r.accessed_on)}</td>
                    {isAdmin && <td>{r.provider}</td>}
                    <td>{r.patient}</td>
                    <td>{actionLabel(r.action)}</td>
                    <td><span className={`badge ${r.granted ? 'ok' : 'denied'}`}>{r.granted ? 'allowed' : 'refused'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}
