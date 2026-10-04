import { authenticate, create, get, list, setSession, update } from './db.js'

function makeSalt() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
}

async function hashPassword(password, salt) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function cleanProfile(values, uid) {
  return {
    uid,
    businessName: values.businessName.trim(),
    sellerType: values.sellerType,
    categories: values.categories,
    productTags: [...new Set((values.productTags || '').split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
    location: values.location.trim(),
    idType: values.idType,
    idNumber: values.idType === 'GSTIN' ? values.idNumber.trim().toUpperCase() : values.idNumber.trim(),
    description: values.description.trim(),
    status: 'pending',
    rejectionReason: '',
    reapplicationPending: false,
  }
}

export async function registerAccount(values) {
  const email = values.email.trim().toLowerCase()
  if ((await list('users')).some((user) => user.email.toLowerCase() === email)) throw new Error('EMAIL_IN_USE')
  if (values.role === 'seller') {
    const profiles = await list('sellerProfiles')
    const users = await list('users')
    const phone = values.phone.trim()
    const idNumber = values.idType === 'GSTIN' ? values.idNumber.trim().toUpperCase() : values.idNumber.trim().toUpperCase()
    if (users.some((user) => user.phone === phone)) throw new Error('PHONE_IN_USE')
    if (profiles.some((profile) => profile.idNumber.toUpperCase() === idNumber)) throw new Error('ID_IN_USE')
  }
  const uid = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const salt = makeSalt()
  const user = await create('users', {
    uid,
    role: values.role,
    name: values.name.trim(),
    email,
    phone: values.role === 'seller' ? values.phone.trim() : '',
    createdAt: Date.now(),
    passwordSalt: salt,
    passwordHash: await hashPassword(values.password, salt),
  })
  if (values.role === 'seller') await create('sellerProfiles', cleanProfile(values, uid))
  await setSession(uid)
  return user
}

export async function loginAccount(email, password) {
  return authenticate(email, password)
}

export async function reapplySeller(values, uid) {
  const profile = await get('sellerProfiles', uid)
  if (!profile || profile.status !== 'rejected') throw new Error('APPLICATION_NOT_REJECTED')
  const profiles = await list('sellerProfiles')
  const users = await list('users')
  const phone = values.phone.trim()
  const idNumber = values.idType === 'GSTIN' ? values.idNumber.trim().toUpperCase() : values.idNumber.trim().toUpperCase()
  if (users.some((user) => user.uid !== uid && user.phone === phone)) throw new Error('PHONE_IN_USE')
  if (profiles.some((entry) => entry.uid !== uid && entry.idNumber.toUpperCase() === idNumber)) throw new Error('ID_IN_USE')
  await update('users', uid, { name: values.name.trim(), phone })
  await update('sellerProfiles', uid, { ...cleanProfile(values, uid), status: 'rejected', reapplicationPending: true })
  return get('users', uid)
}
