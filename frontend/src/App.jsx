import { useEffect, useState } from 'react'
import { api, setToken, hasToken } from './api.js'
import Login from './components/Login.jsx'
import Patients from './components/Patients.jsx'
import Referrals from './components/Referrals.jsx'
import Consents from './components/Consents.jsx'
import Audit from './components/Audit.jsx'
import Dashboard from './components/Dashboard.jsx'
import PatientConsents from './components/PatientConsents.jsx'
import PatientActivity from './components/PatientActivity.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(hasToken())
  const [tab, setTab] = useState('home')

  // restore a session after a page refresh
  useEffect(() => {
    if (!hasToken()) return
    api('/auth/me')
      .catch(() => api('/auth/patient-me'))
      .then((me) => {
        setUser(me)
        setTab(me.role === 'patient' ? 'consents' : 'home')
      })
      .catch(() => setToken(null))
      .finally(() => setBooting(false))
  }, [])

  function handleLogin(token, me) {
    setToken(token)
    setUser(me)
    setTab(me.role === 'patient' ? 'consents' : 'home')
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  if (booting) return <div className="page muted">Loading...</div>
  if (!user) return <Login onLogin={handleLogin} />

  const isAdmin = user.role === 'admin'
  const isPatient = user.role === 'patient'
  const tabs = isPatient
    ? [['consents', 'Who can see my record'], ['activity', 'Who looked at it']]
    : isAdmin
    ? [['home', 'Home'], ['consents', 'Consent management'], ['audit', 'Audit log']]
    : [['home', 'Home'], ['patients', 'Patients'], ['referrals', 'Referrals'], ['consents', 'My access']]

  return (
    <>
      <div className="topbar">
        <div className="brand">Patient Record Exchange</div>
        <div className="who">
          <span className={`role-badge ${user.role}`}>{isPatient ? 'Patient' : isAdmin ? 'Admin' : 'Doctor'}</span>
          <span className="who-info">
            <strong>{user.name}</strong>
            <span className="muted">
              {isPatient ? `Record number ${user.mrn}` : `${user.specialty}${user.facility ? `, ${user.facility}` : ''}`}
            </span>
          </span>
          <button className="small" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="page">
        {!isPatient && tab === 'home' && <Dashboard user={user} goTo={setTab} />}
        {isPatient && tab === 'consents' && <PatientConsents />}
        {isPatient && tab === 'activity' && <PatientActivity />}
        {!isPatient && tab === 'patients' && <Patients user={user} />}
        {!isPatient && tab === 'referrals' && <Referrals user={user} />}
        {!isPatient && tab === 'consents' && <Consents user={user} />}
        {!isPatient && tab === 'audit' && <Audit />}
      </div>
    </>
  )
}
