import { useState } from 'react'
import { api, setToken } from '../api.js'

const DEMO = [
  ['anita.rao@demo.test', 'Dr. Anita Rao', 'General practice, City General'],
  ['vikram.shah@demo.test', 'Dr. Vikram Shah', 'General practice, Lakeview Clinic'],
  ['meera.iyer@demo.test', 'Dr. Meera Iyer', 'Endocrinology, City General'],
  ['rohan.mehta@demo.test', 'Dr. Rohan Mehta', 'Ophthalmology, Vision Care'],
  ['admin@demo.test', 'System admin', 'Records consent and reads the audit log'],
]

const DEMO_PATIENTS = [
  ['mrn-0001@demo.test', 'Demo patient 1', 'Has a doctor whose access was removed'],
  ['mrn-0003@demo.test', 'Demo patient 3', 'Has an expired access entry'],
  ['mrn-0005@demo.test', 'Demo patient 5', 'Has a penicillin allergy'],
]

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('staff') // 'staff' or 'patient'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function switchMode(next) {
    setMode(next)
    setEmail('')
    setPassword('')
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const patient = mode === 'patient'
      const res = await api(patient ? '/auth/patient-login' : '/auth/login', {
        method: 'POST', body: { email, password },
      })
      setToken(res.access_token)
      const me = await api(patient ? '/auth/patient-me' : '/auth/me')
      onLogin(res.access_token, me)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-shell">
      <img className="login-logo logo-light" src="/arovia-ink.png" alt="Arovia" />
      <img className="login-logo logo-dark" src="/arovia-white.png" alt="Arovia" />

      <div className="card login-card">
        <h2>Sign in</h2>
        <p className="muted">Synthetic demo data only. No real patient information is stored.</p>

        <div className="seg" role="group" aria-label="Account type">
          <button type="button" className={mode === 'staff' ? 'on' : ''} aria-pressed={mode === 'staff'}
                  onClick={() => switchMode('staff')}>Doctor or admin</button>
          <button type="button" className={mode === 'patient' ? 'on' : ''} aria-pressed={mode === 'patient'}
                  onClick={() => switchMode('patient')}>Patient</button>
        </div>

        <form onSubmit={submit} className="stack">
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email}
                   onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password" value={password}
                   onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="alert bad" role="alert">{error}</div>}
          <button className="primary" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <details className="demo">
          <summary>Try a demo account</summary>
          <div className="muted" style={{ marginTop: 8 }}>Choose one to fill the form. The password is Pass@123 for all of them.</div>
          <div className="demo-list">
            {(mode === 'patient' ? DEMO_PATIENTS : DEMO).map(([em, name, desc]) => (
              <button key={em} type="button" onClick={() => { setEmail(em); setPassword('Pass@123') }}>
                <strong>{name}</strong>
                <span>{desc}</span>
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}
