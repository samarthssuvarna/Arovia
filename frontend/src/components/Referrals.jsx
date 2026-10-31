import { useCallback, useEffect, useState } from 'react'
import { api, fmtDate } from '../api.js'
import Loading from './Loading.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { useToast } from './Toast.jsx'

export default function Referrals() {
  const [direction, setDirection] = useState('incoming')
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState({})   // referral_id -> status it is about to get
  const [asking, setAsking] = useState(null)   // { r, status } waiting for confirmation
  const toast = useToast()

  const load = useCallback(async () => {
    setError('')
    try {
      const [list, sum] = await Promise.all([
        api('/referrals', { params: { direction } }),
        api('/referrals/summary'),
      ])
      setRows(list)
      setSummary(sum)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoaded(true)
    }
  }, [direction])

  useEffect(() => { setLoaded(false); load() }, [load])

  async function change(id, status) {
    setBusyId(id)
    setError('')
    try {
      await api(`/referrals/${id}/status`, { method: 'PATCH', body: { status } })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  // Easy steps: change the row now, tell the server after the undo window.
  function withUndo(r, status, message) {
    setPending((p) => ({ ...p, [r.referral_id]: status }))
    const forget = () => setPending((p) => { const n = { ...p }; delete n[r.referral_id]; return n })
    toast.undoable(
      message,
      async () => { await change(r.referral_id, status); forget() },
      forget,
    )
  }

  // incoming: I am the receiver. outgoing: I am the sender.
  function actions(r) {
    const busy = busyId === r.referral_id || pending[r.referral_id]
    if (direction === 'incoming') {
      if (r.status === 'pending')
        return (
          <div className="row">
            <button className="small primary" disabled={busy} onClick={() => withUndo(r, 'accepted', `Referral for ${r.patient} accepted`)}>Accept</button>
            <button className="small danger" disabled={busy} onClick={() => setAsking({ r, status: 'rejected' })}>Reject</button>
          </div>
        )
      if (r.status === 'accepted')
        return <button className="small primary" disabled={busy} onClick={() => withUndo(r, 'completed', `Referral for ${r.patient} marked completed`)}>Mark completed</button>
      return null
    }
    if (r.status === 'pending' || r.status === 'accepted')
      return <button className="small danger" disabled={busy} onClick={() => setAsking({ r, status: 'cancelled' })}>Cancel</button>
    return null
  }

  return (
    <>
      <div className="card">
        <div className="spread">
          <h2>Referrals</h2>
          <div className="row">
            <button className={direction === 'incoming' ? 'primary' : ''} onClick={() => setDirection('incoming')}>Incoming (to me)</button>
            <button className={direction === 'outgoing' ? 'primary' : ''} onClick={() => setDirection('outgoing')}>Outgoing (from me)</button>
          </div>
        </div>
        {summary.length > 0 && (
          <div className="chips" style={{ marginTop: 10 }}>
            {summary.map((s, i) => (
              <span key={i} className={`badge ${s.status}`}>{s.status}, {s.urgency}: {s.count}</span>
            ))}
          </div>
        )}
      </div>

      {error && <div className="alert bad">{error}</div>}

      <div className="card scroll">
        {!loaded ? (
          <Loading />
        ) : rows.length === 0 ? (
          <div className="muted">
            {direction === 'incoming'
              ? 'No referrals have been sent to you yet.'
              : 'You have not referred any patient yet. Open a patient record and choose "Refer patient".'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Patient</th><th>{direction === 'incoming' ? 'From' : 'To'}</th>
                <th>Reason</th><th>Urgency</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.referral_id}>
                  <td className="nw">{fmtDate(r.created_at)}</td>
                  <td className="nw">{r.patient}<div className="muted">{r.mrn}</div></td>
                  <td className="nw">{direction === 'incoming' ? r.from_provider : r.to_provider}</td>
                  <td>{r.reason}</td>
                  <td><span className={`badge ${r.urgency}`}>{r.urgency}</span></td>
                  <td><span className={`badge ${pending[r.referral_id] || r.status}`}>{pending[r.referral_id] || r.status}</span></td>
                  <td>{actions(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {asking && (
        <ConfirmDialog
          title={asking.status === 'rejected' ? 'Reject this referral?' : 'Cancel this referral?'}
          message={asking.status === 'rejected'
            ? `The referral for ${asking.r.patient} will be closed and cannot be reopened. The sender will see it as rejected.`
            : `The referral for ${asking.r.patient} will be closed and cannot be reopened.`}
          confirmText={asking.status === 'rejected' ? 'Reject referral' : 'Cancel referral'}
          danger
          busy={busyId === asking.r.referral_id}
          onConfirm={async () => { await change(asking.r.referral_id, asking.status); setAsking(null) }}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  )
}
