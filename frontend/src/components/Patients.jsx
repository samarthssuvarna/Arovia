import { useState } from 'react'
import { api, fmtDate } from '../api.js'
import RecordView from './RecordView.jsx'

export default function Patients({ user }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [target, setTarget] = useState(null) // patient we are about to open
  const [reason, setReason] = useState('')
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState('')
  const [record, setRecord] = useState(null) // { data, reason }

  async function search(e) {
    e.preventDefault()
    setError('')
    setTarget(null)
    setRecord(null)
    try {
      setResults(await api('/patients/search', { params: { q } }))
    } catch (err) {
      setError(err.status === 422 ? 'Type at least 2 characters' : err.message)
    }
  }

  async function openRecord(e) {
    e.preventDefault()
    setOpening(true)
    setOpenError('')
    try {
      const data = await api(`/patients/${target.patient_id}/history`, { params: { reason } })
      setRecord({ data, reason })
    } catch (err) {
      setOpenError(err.message)
    } finally {
      setOpening(false)
    }
  }

  async function reload() {
    const data = await api(`/patients/${record.data.patient.patient_id}/history`, { params: { reason: record.reason } })
    setRecord({ data, reason: record.reason })
  }

  if (record) {
    return (
      <RecordView
        user={user}
        data={record.data}
        onBack={() => { setRecord(null); setTarget(null); setReason('') }}
        onChanged={reload}
      />
    )
  }

  return (
    <>
      <div className="card">
        <h2>Find a patient</h2>
        <p className="muted">Search by name or medical record number. Results show identity only. Opening a record needs patient consent, and every attempt is logged.</p>
        <form onSubmit={search} className="row">
          <input className="grow" placeholder="e.g. Arjun or MRN-0001" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="primary">Search</button>
        </form>
        {error && <div className="alert bad">{error}</div>}
      </div>

      {results && (
        <div className="card scroll">
          {results.length === 0 ? (
            <div className="muted">No patients found.</div>
          ) : (
            <table>
              <thead>
                <tr><th>MRN</th><th>Name</th><th>Date of birth</th><th>Gender</th><th>Your access</th><th /></tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <tr key={p.patient_id}>
                    <td>{p.mrn}</td>
                    <td>{p.name}</td>
                    <td>{fmtDate(p.dob)}</td>
                    <td>{p.gender}</td>
                    <td>
                      <span className={`badge ${p.has_consent ? 'ok' : 'bad'}`}>
                        {p.has_consent ? 'Consent valid' : 'No valid consent'}
                      </span>
                    </td>
                    <td>
                      <button className="small primary" onClick={() => { setTarget(p); setOpenError(''); setReason('') }}>
                        Open record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {target && (
        <div className="card">
          <h3>Open record: {target.name}</h3>
          <p className="muted">State why you need this record. The reason is saved in the audit log.</p>
          <form onSubmit={openRecord} className="row">
            <input className="grow" placeholder="e.g. Follow-up consultation" value={reason}
                   onChange={(e) => setReason(e.target.value)} minLength={3} required />
            <button className="primary" disabled={opening}>{opening ? 'Checking...' : 'Access record'}</button>
            <button type="button" onClick={() => setTarget(null)}>Cancel</button>
          </form>
          {openError && <div className="alert bad">{openError}</div>}
        </div>
      )}
    </>
  )
}
