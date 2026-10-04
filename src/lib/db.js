const SESSION_KEY = 'reversemarket:session'
const changeEvent = 'reversemarket:change'

function storedSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

async function request(path, options = {}) {
  const session = storedSession()
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error || 'The request could not be completed.')
    error.status = response.status
    error.code = response.status === 401 ? 'INVALID_CREDENTIALS' : payload?.code || 'API_ERROR'
    throw error
  }
  return payload
}

function storeSession(payload) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: payload.token }))
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: 'session' }))
  return payload.user
}

export async function initializeDb() {
  // SQLite is initialized and seeded by the API process.
}

export async function signup(values) {
  const payload = await request('/auth/signup', { method: 'POST', body: values })
  return storeSession(payload)
}

export async function requestReapplication(values) {
  return (await request('/auth/reapply', { method: 'POST', body: values })).user
}

export async function create(name, value) {
  await initializeDb()
  if (name === 'requirements') return request('/requirements', { method: 'POST', body: value })
  if (name === 'offers') return request(`/requirements/${encodeURIComponent(value.requirementId)}/offers`, { method: 'POST', body: value })
  if (name === 'counterOffers') return request(`/offers/${encodeURIComponent(value.offerId)}/counter-offers`, { method: 'POST', body: value })
  if (name === 'users') return signup(value)
  throw new Error(`CREATE_NOT_SUPPORTED:${name}`)
}

export async function get(name, id) {
  await initializeDb()
  const key = encodeURIComponent(id)
  if (name === 'users') {
    const current = await getSessionUser()
    return current?.uid === id ? current : null
  }
  if (name === 'sellerProfiles') {
    const current = await getSessionUser()
    if (current?.uid === id && current.role === 'seller') return (await request('/auth/me')).sellerProfile
    return request(`/seller-profiles/${key}`)
  }
  if (name === 'requirements') return request(`/requirements/${key}`)
  if (name === 'offers') {
    const current = await getSessionUser()
    if (current?.role === 'seller') return (await request('/offers/mine')).find((row) => row.id === id) || null
    const requirements = await list('requirements')
    for (const requirement of requirements) {
      const offer = (await request(`/requirements/${encodeURIComponent(requirement.id)}/offers`)).find((row) => row.id === id)
      if (offer) return offer
    }
    return null
  }
  if (name === 'counterOffers') return (await list(name)).find((row) => row.id === id) || null
  throw new Error(`UNKNOWN_COLLECTION:${name}`)
}

export async function update(name, id, changes) {
  await initializeDb()
  const key = encodeURIComponent(id)
  if (name === 'requirements') {
    if (changes.status === 'cancelled') return remove(name, id)
    return request(`/requirements/${key}`, { method: 'PATCH', body: changes })
  }
  if (name === 'sellerProfiles') return request(`/admin/sellers/${key}`, { method: 'PATCH', body: changes })
  if (name === 'offers') {
    if (changes.status === 'withdrawn') return request(`/offers/${key}`, { method: 'DELETE' })
    if (Object.hasOwn(changes, 'shortlisted')) return request(`/offers/${key}/shortlist`, { method: 'POST', body: changes })
    return request(`/offers/${key}`, { method: 'PATCH', body: changes })
  }
  if (name === 'counterOffers') return request(`/counter-offers/${key}`, { method: 'PATCH', body: changes })
  throw new Error(`UPDATE_NOT_SUPPORTED:${name}`)
}

export async function list(name, predicate = () => true) {
  await initializeDb()
  let rows
  if (name === 'users') {
    const current = await getSessionUser()
    rows = current ? [current] : []
  } else if (name === 'sellerProfiles') {
    const current = await getSessionUser()
    rows = current?.role === 'admin' ? await request('/admin/sellers?status=pending') : current?.role === 'seller' ? [(await request('/auth/me')).sellerProfile].filter(Boolean) : []
  } else if (name === 'requirements') {
    const current = await getSessionUser()
    rows = await request(`/requirements${current?.role === 'seller' ? '?all=true' : ''}`)
  } else if (name === 'offers') {
    const current = await getSessionUser()
    if (current?.role === 'seller') rows = await request('/offers/mine')
    else {
      const requirements = await request('/requirements')
      rows = (await Promise.all(requirements.map((requirement) => request(`/requirements/${encodeURIComponent(requirement.id)}/offers`)))).flat()
    }
  } else if (name === 'counterOffers') {
    rows = await request('/counter-offers/mine')
  } else {
    throw new Error(`UNKNOWN_COLLECTION:${name}`)
  }
  return rows.filter(predicate)
}

export async function remove(name, id) {
  await initializeDb()
  const path = name === 'requirements' ? `/requirements/${encodeURIComponent(id)}` : name === 'offers' ? `/offers/${encodeURIComponent(id)}` : null
  if (!path) throw new Error(`DELETE_NOT_SUPPORTED:${name}`)
  return request(path, { method: 'DELETE' })
}

export function watch(name, callback, onError) {
  let active = true
  let inFlight = false
  const refresh = async () => {
    if (!active || inFlight) return
    inFlight = true
    try {
      const rows = await list(name)
      if (active) callback(rows)
    } catch (error) {
      if (active && onError) onError(error)
      if (active) window.dispatchEvent(new CustomEvent(`${changeEvent}:error`, { detail: { name, error } }))
    } finally {
      inFlight = false
    }
  }
  const timer = window.setInterval(refresh, 3000)
  const onChange = (event) => {
    if (!event?.detail || event.detail === name || event.detail === 'session') void refresh()
  }
  window.addEventListener(changeEvent, onChange)
  void refresh()
  return () => {
    active = false
    window.clearInterval(timer)
    window.removeEventListener(changeEvent, onChange)
  }
}

export async function authenticate(email, password) {
  const payload = await request('/auth/login', { method: 'POST', body: { email, password } })
  return storeSession(payload)
}

export async function setSession(uid) {
  const user = await getSessionUser()
  if (user?.uid !== uid) throw new Error('AUTH_SESSION_REQUIRED')
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: 'session' }))
}

export function watchSession(callback) {
  const refresh = () => void getSessionUser().then(callback).catch(() => callback(null))
  window.addEventListener(changeEvent, refresh)
  refresh()
  return () => window.removeEventListener(changeEvent, refresh)
}

export async function getSessionUser() {
  const session = storedSession()
  if (!session?.token) return null
  try {
    return (await request('/auth/me')).user
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export async function resetDemoData() {
  await request('/admin/reset-demo-data', { method: 'POST' })
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: 'reset' }))
}

export async function getDeal(offerId) {
  return request(`/deals/${encodeURIComponent(offerId)}`)
}

export async function acceptOffer(offerId) {
  return request(`/offers/${encodeURIComponent(offerId)}/accept`, { method: 'POST', body: {} })
}

export const db = { create, get, update, list, delete: remove, watch, initialize: initializeDb }
