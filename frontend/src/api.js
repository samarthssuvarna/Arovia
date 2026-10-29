const BASE = import.meta.env.VITE_API || 'http://localhost:8000'

let token = null
try {
  token = sessionStorage.getItem('token')
} catch {
  token = null
}

export function setToken(t) {
  token = t
  try {
    if (t) sessionStorage.setItem('token', t)
    else sessionStorage.removeItem('token')
  } catch {
    /* storage unavailable: token stays in memory only */
  }
}

export function hasToken() {
  return !!token
}

export async function api(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + path)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    })
  }

  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    const err = new Error('Cannot reach the server. Is the backend running on port 8000?')
    err.status = 0
    throw err
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const d = data && data.detail
    const message =
      typeof d === 'string' ? d : d && d.message ? d.message : res.status === 422 ? 'Some fields are invalid' : 'Request failed'
    const err = new Error(message)
    err.status = res.status
    err.detail = d
    throw err
  }
  return data
}

export function fmtDate(v) {
  if (!v) return ''
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtDateTime(v) {
  if (!v) return ''
  return new Date(v).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ---- helpers for file upload and for images that need the login token ----

async function failFrom(res) {
  let data = null
  try { data = await res.json() } catch { data = null }
  const d = data && data.detail
  const err = new Error(typeof d === 'string' ? d : res.status === 422 ? 'Some fields are invalid' : 'Request failed')
  err.status = res.status
  err.detail = d
  return err
}

function unreachable() {
  const err = new Error('Cannot reach the server. Is the backend running on port 8000?')
  err.status = 0
  return err
}

export async function apiUpload(path, formData, params) {
  const url = new URL(BASE + path)
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  let res
  try {
    // no Content-Type header: the browser adds the right multipart boundary itself
    res = await fetch(url, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
  } catch {
    throw unreachable()
  }
  if (!res.ok) throw await failFrom(res)
  return res.json()
}

// An <img> tag cannot send the login token, so we fetch the picture ourselves.
export async function apiBlob(path, params) {
  const url = new URL(BASE + path)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  let res
  try {
    res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw unreachable()
  }
  if (!res.ok) throw await failFrom(res)
  return URL.createObjectURL(await res.blob())
}

// Plain-language names for the action codes stored in the audit log.
export const ACTION_LABELS = {
  view_history: 'Opened record',
  create_encounter: 'Added a visit',
  create_referral: 'Sent a referral',
  update_referral: 'Updated a referral',
  grant_consent: 'Access given',
  revoke_consent: 'Access removed',
  dr_screening: 'Ran eye screening',
  view_screenings: 'Viewed eye screenings',
  view_screening_image: 'Viewed a retinal image',
  review_screening: 'Reviewed an eye screening',
}

export function actionLabel(action) {
  return ACTION_LABELS[action] || action
}
