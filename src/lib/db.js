const PREFIX = 'reversemarket:'
const collections = ['users', 'sellerProfiles', 'requirements', 'offers', 'counterOffers']
const changeEvent = 'reversemarket:change'
let seedPromise

function readCollection(name) {
  if (!collections.includes(name)) throw new Error(`UNKNOWN_COLLECTION:${name}`)
  try {
    return JSON.parse(localStorage.getItem(`${PREFIX}${name}`) || '[]')
  } catch {
    return []
  }
}

function notify(name) {
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: name }))
}

function writeCollection(name, rows) {
  localStorage.setItem(`${PREFIX}${name}`, JSON.stringify(rows))
  notify(name)
}

function makeId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function passwordHash(password, salt) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`))
  return toHex(new Uint8Array(digest))
}

async function seedUser(uid, role, name, email, phone = '', password = 'Demo2026') {
  const salt = makeId()
  return { uid, role, name, email, phone, createdAt: Date.now(), passwordSalt: salt, passwordHash: await passwordHash(password, salt) }
}

function daysFromNow(days) {
  return Date.now() + days * 86400000
}

async function createSeed() {
  const users = [
    await seedUser('admin-demo', 'admin', 'ReverseMarket Admin', 'admin@demo.com', '', 'Admin2026'),
    await seedUser('buyer-demo-1', 'buyer', 'Ananya Rao', 'ananya@demo.com', '9876500001'),
    await seedUser('buyer-demo-2', 'buyer', 'Karthik Iyer', 'karthik@demo.com', '9876500002'),
    await seedUser('seller-demo-1', 'seller', 'Meera Nair', 'meera@demo.com', '9876500003'),
    await seedUser('seller-demo-2', 'seller', 'Arjun Kumar', 'arjun@demo.com', '9876500004'),
    await seedUser('seller-demo-3', 'seller', 'Priya Shah', 'priya@demo.com', '9876500005'),
    await seedUser('seller-demo-4', 'seller', 'Ravi Stores', 'ravi@demo.com', '9876500006'),
  ]
  const profiles = [
    { uid: 'seller-demo-1', businessName: 'Meera Tech & Books', sellerType: 'shop', categories: ['Electronics', 'Books', 'Event supplies', 'Furniture'], productTags: ['laptop', 'textbooks', 'chairs'], location: 'Chennai', idType: 'Student ID', idNumber: 'CAMPUS-S-001', description: 'Campus electronics and course materials', status: 'approved', rejectionReason: '' },
    { uid: 'seller-demo-2', businessName: 'Arjun Campus Supply', sellerType: 'individual', categories: ['Electronics', 'Event supplies', 'Furniture'], productTags: ['laptop', 'banners', 'folding chairs'], location: 'Chennai', idType: 'Shop licence', idNumber: 'CAMPUS-S-002', description: 'Reliable supplies for student groups', status: 'approved', rejectionReason: '' },
    { uid: 'seller-demo-3', businessName: 'Priya Print Studio', sellerType: 'company', categories: ['Services', 'Books', 'Event supplies'], productTags: ['textbooks', 'printing', 'banners', 'badges'], location: 'Chennai', idType: 'Student ID', idNumber: 'CAMPUS-S-003', description: 'Printing, binding, and event services', status: 'approved', rejectionReason: '' },
    { uid: 'seller-demo-4', businessName: 'Ravi Campus Mart', sellerType: 'shop', categories: ['Electronics', 'Furniture', 'Other'], productTags: ['laptop', 'desks', 'chargers'], location: 'Chennai', idType: 'Shop licence', idNumber: 'CAMPUS-S-004', description: 'Everyday campus essentials', status: 'pending', rejectionReason: '' },
  ]
  const requirements = [
    { id: 'req-campus-laptop', buyerId: 'buyer-demo-1', title: 'Laptop for engineering lab work', details: 'Laptop required for CAD and coding classes', category: 'Electronics', budget: 65000, deadlineDays: 14, keywords: ['16GB RAM', 'SSD', 'engineering'], seenOfferIds: [], status: 'open', acceptedOfferId: null, acceptedSellerId: null, offersCount: 3, createdAt: Date.now(), expiresAt: daysFromNow(14) },
    { id: 'req-campus-books', buyerId: 'buyer-demo-1', title: 'Second-year engineering textbooks', details: 'New or clean used editions for the semester', category: 'Books', budget: 9000, deadlineDays: 10, keywords: ['engineering', 'textbooks', 'used'], seenOfferIds: [], status: 'open', acceptedOfferId: null, acceptedSellerId: null, offersCount: 2, createdAt: Date.now(), expiresAt: daysFromNow(10) },
    { id: 'req-fest-printing', buyerId: 'buyer-demo-2', title: 'College fest banners and badges', details: 'Need colourful print work for our annual campus festival', category: 'Event supplies', budget: 18000, deadlineDays: 21, keywords: ['printing', 'banners', 'badges'], seenOfferIds: [], status: 'open', acceptedOfferId: null, acceptedSellerId: null, offersCount: 3, createdAt: Date.now(), expiresAt: daysFromNow(21) },
    { id: 'req-seminar-chairs', buyerId: 'buyer-demo-2', title: 'Folding chairs for department seminar', details: 'Delivery to the seminar hall before the department event', category: 'Furniture', budget: 30000, deadlineDays: 30, keywords: ['folding', 'chairs', 'seminar'], seenOfferIds: [], status: 'open', acceptedOfferId: null, acceptedSellerId: null, offersCount: 2, createdAt: Date.now(), expiresAt: daysFromNow(30) },
  ]
  const offerRows = [
    ['req-campus-laptop', 'seller-demo-1', 61900, 5, 'Configured for lab assignments with 16GB RAM and SSD storage.'],
    ['req-campus-laptop', 'seller-demo-2', 63500, 3, 'New laptop with campus delivery and setup support.'],
    ['req-campus-laptop', 'seller-demo-3', 59900, 8, 'Refurbished business model, tested and warranty included.'],
    ['req-campus-books', 'seller-demo-1', 7200, 2, 'Complete textbook set with clean second-hand copies.'],
    ['req-campus-books', 'seller-demo-3', 8400, 4, 'New editions, bundled and ready for collection.'],
    ['req-fest-printing', 'seller-demo-2', 15800, 6, 'Weather-safe banners and 200 name badges.'],
    ['req-fest-printing', 'seller-demo-3', 14900, 8, 'Full-colour print package with proof review.'],
    ['req-fest-printing', 'seller-demo-1', 17200, 5, 'Premium fabric banners and laminated badges.'],
    ['req-seminar-chairs', 'seller-demo-2', 26400, 10, 'Twenty sturdy folding chairs delivered to campus.'],
    ['req-seminar-chairs', 'seller-demo-1', 28800, 7, 'Metal-frame chairs with floor protectors.'],
  ]
  const offers = offerRows.map(([requirementId, sellerId, price, deliveryDays, description], index) => {
    const requirement = requirements.find((row) => row.id === requirementId)
    const id = `${requirementId}_${sellerId}`
    return { id, requirementId, requirementTitle: requirement.title, requirementCategory: requirement.category, sellerId, price, deliveryDays, description, shortlisted: index === 1, pendingCounterOfferId: null, status: 'active', createdAt: Date.now() - index * 1000 }
  })
  for (const name of collections) localStorage.setItem(`${PREFIX}${name}`, JSON.stringify({ users, sellerProfiles: profiles, requirements, offers, counterOffers: [] }[name]))
  localStorage.setItem(`${PREFIX}seeded`, 'true')
}

export async function initializeDb() {
  if (!seedPromise) seedPromise = (async () => {
    localStorage.removeItem(`${PREFIX}session`)
    if (localStorage.getItem(`${PREFIX}seeded`) !== 'true') await createSeed()
  })()
  await seedPromise
}

export async function create(name, value) {
  await initializeDb()
  const rows = readCollection(name)
  const id = value.id || value.uid || makeId()
  if (rows.some((row) => (row.id || row.uid) === id)) throw new Error('ALREADY_EXISTS')
  const record = { ...value, ...(value.uid ? { uid: value.uid } : { id }) }
  writeCollection(name, [...rows, record])
  return record
}

export async function get(name, id) {
  await initializeDb()
  return readCollection(name).find((row) => (row.id || row.uid) === id) || null
}

export async function update(name, id, changes) {
  await initializeDb()
  const rows = readCollection(name)
  const index = rows.findIndex((row) => (row.id || row.uid) === id)
  if (index < 0) throw new Error('NOT_FOUND')
  rows[index] = { ...rows[index], ...changes }
  writeCollection(name, rows)
  return rows[index]
}

export async function list(name, predicate = () => true) {
  await initializeDb()
  return readCollection(name).filter(predicate)
}

export async function remove(name, id) {
  await initializeDb()
  writeCollection(name, readCollection(name).filter((row) => (row.id || row.uid) !== id))
}

export function watch(name, callback) {
  const refresh = (event) => {
    if (!event?.detail || event.detail === name) void list(name).then(callback)
  }
  const onStorage = (event) => {
    if (event.key === `${PREFIX}${name}` || event.key === null) void list(name).then(callback)
  }
  window.addEventListener(changeEvent, refresh)
  window.addEventListener('storage', onStorage)
  void list(name).then(callback)
  return () => {
    window.removeEventListener(changeEvent, refresh)
    window.removeEventListener('storage', onStorage)
  }
}

export async function authenticate(email, password) {
  await initializeDb()
  const normalized = email.trim().toLowerCase()
  const user = readCollection('users').find((row) => row.email.toLowerCase() === normalized)
  if (!user || !user.passwordHash || !user.passwordSalt) throw new Error('INVALID_CREDENTIALS')
  if (await passwordHash(password, user.passwordSalt) !== user.passwordHash) throw new Error('INVALID_CREDENTIALS')
  sessionStorage.setItem(`${PREFIX}session`, JSON.stringify({ uid: user.uid }))
  return user
}

export async function setSession(uid) {
  await initializeDb()
  sessionStorage.setItem(`${PREFIX}session`, JSON.stringify({ uid }))
}

export function clearSession() {
  sessionStorage.removeItem(`${PREFIX}session`)
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: 'session' }))
}

export function watchSession(callback) {
  const refresh = () => void getSessionUser().then(callback)
  window.addEventListener(changeEvent, refresh)
  refresh()
  return () => {
    window.removeEventListener(changeEvent, refresh)
  }
}

export async function getSessionUser() {
  await initializeDb()
  try {
    const session = JSON.parse(sessionStorage.getItem(`${PREFIX}session`) || 'null')
    return session?.uid ? get('users', session.uid) : null
  } catch {
    return null
  }
}

export async function resetDemoData() {
  await createSeed()
  seedPromise = Promise.resolve()
  for (const name of collections) notify(name)
}

export const db = { create, get, update, list, delete: remove, watch, initialize: initializeDb }
