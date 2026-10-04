import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import {
  database,
  decodeCounterOffer,
  decodeOffer,
  decodeProfile,
  decodeRequirement,
  publicUser,
  seedDemoData,
} from './database.js'
import { categories, cleanTags, validateEmail, validateGstin, validateOffer, validatePassword, validateRequirement } from './validation.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const jwtSecret = process.env.JWT_SECRET || 'reversemarket-local-development-secret-change-me'
const tokenExpiry = '7d'

seedDemoData()
app.disable('x-powered-by')
app.use((request, response, next) => {
  const origin = request.get('origin')
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204)
  next()
})
app.use(express.json({ limit: '64kb' }))

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const fail = (status, message) => { throw new HttpError(status, message) }
const now = () => Date.now()
const parseList = (value) => Array.isArray(value) ? value : JSON.parse(value || '[]')
const parseKeywords = (value) => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map((item) => String(item).trim()).filter(Boolean))]
const getUser = (uid) => database.prepare('SELECT * FROM users WHERE uid = ?').get(uid)
const getProfile = (uid) => decodeProfile(database.prepare('SELECT * FROM seller_profiles WHERE uid = ?').get(uid))
const getRequirement = (id) => decodeRequirement(database.prepare('SELECT * FROM requirements WHERE id = ?').get(id))
const getOffer = (id) => decodeOffer(database.prepare('SELECT * FROM offers WHERE id = ?').get(id))
const getCounterOffer = (id) => decodeCounterOffer(database.prepare('SELECT * FROM counter_offers WHERE id = ?').get(id))
const isOpen = (requirement) => requirement?.status === 'open' && requirement.expiresAt > now()

function authRequired(request, response, next) {
  const [scheme, token] = String(request.get('authorization') || '').split(' ')
  if (scheme !== 'Bearer' || !token) return response.status(401).json({ error: 'Authentication required.' })
  try {
    request.auth = jwt.verify(token, jwtSecret)
    const user = getUser(request.auth.uid)
    if (!user) return response.status(401).json({ error: 'Authentication required.' })
    request.user = user
    next()
  } catch {
    response.status(401).json({ error: 'Authentication required.' })
  }
}

function allowRoles(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) return response.status(403).json({ error: 'You do not have access to this action.' })
    next()
  }
}

function tokenFor(user) {
  return jwt.sign({ uid: user.uid, role: user.role }, jwtSecret, { expiresIn: tokenExpiry })
}

function requirementFields(body) {
  const keywords = parseKeywords(body.keywords)
  const values = { ...body, keywords }
  const errors = validateRequirement(values)
  if (Object.keys(errors).length) fail(400, Object.values(errors)[0])
  return {
    title: body.title.trim(),
    details: String(body.details || '').trim(),
    category: body.category,
    budget: Number(body.budget),
    deadlineDays: Number(body.deadlineDays),
    keywords,
  }
}

function offerResponse(row) {
  const offer = decodeOffer(row)
  if (!offer) return null
  const profile = getProfile(offer.sellerId)
  return { ...offer, sellerBusinessName: profile?.businessName || '', sellerStatus: profile?.status || '' }
}

app.get('/api/health', (request, response) => response.json({ status: 'ok' }))

app.post('/api/auth/signup', (request, response) => {
  const body = request.body || {}
  const role = body.role
  const email = String(body.email || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const password = body.password
  if (!['buyer', 'seller'].includes(role)) fail(400, 'Choose a buyer or seller account.')
  if (!validateEmail(email)) fail(400, 'Enter a valid email address.')
  if (!name) fail(400, 'Enter your full name.')
  if (!validatePassword(password)) fail(400, 'Use at least 8 characters with both letters and numbers.')
  if (password !== body.confirmPassword) fail(400, 'Passwords do not match.')
  if (database.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(email)) fail(409, 'An account with this email already exists.')

  const uid = randomUUID()
  const createdAt = now()
  const passwordSalt = bcrypt.genSaltSync(10)
  const passwordHash = bcrypt.hashSync(password, passwordSalt)
  let profile = null

  if (role === 'seller') {
    const phone = String(body.phone || '').trim()
    const businessName = String(body.businessName || '').trim()
    const sellerType = body.sellerType
    const sellerCategories = parseList(body.categories)
    const location = String(body.location || '').trim()
    const idType = body.idType
    const idNumber = String(body.idNumber || '').trim()
    const description = String(body.description || '').trim()
    if (!/^[6-9]\d{9}$/.test(phone)) fail(400, 'Enter a valid 10-digit Indian mobile number.')
    if (!businessName) fail(400, 'Enter your business name.')
    if (!['individual', 'shop', 'company'].includes(sellerType)) fail(400, 'Choose a seller type.')
    if (!Array.isArray(sellerCategories) || sellerCategories.length === 0 || sellerCategories.some((category) => !categories.includes(category))) fail(400, 'Choose at least one valid category.')
    if (!location) fail(400, 'Enter your location.')
    if (!['GSTIN', 'Shop licence', 'Student ID'].includes(idType)) fail(400, 'Choose a verification ID type.')
    if (!idNumber) fail(400, 'Enter your ID number.')
    if (idType === 'GSTIN' && !validateGstin(idNumber)) fail(400, 'Enter a valid 15-character GSTIN, including its check digit.')
    if (!description) fail(400, 'Add a short business description.')
    if (body.acceptedTerms !== true) fail(400, 'Accept the seller terms to continue.')
    if (database.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone)) fail(409, 'An account with this phone number already exists.')
    const normalizedId = idType === 'GSTIN' ? idNumber.toUpperCase() : idNumber
    if (database.prepare('SELECT 1 FROM seller_profiles WHERE idNumber = ? COLLATE NOCASE').get(normalizedId)) fail(409, 'This verification ID is already in use.')
    profile = {
      uid,
      businessName,
      sellerType,
      categories: sellerCategories,
      productTags: cleanTags(body.productTags),
      location,
      idType,
      idNumber: normalizedId,
      description,
      status: 'pending',
      rejectionReason: '',
      reapplicationPending: false,
    }
  }

  const insert = database.transaction(() => {
    database.prepare('INSERT INTO users (uid, role, name, email, phone, createdAt, passwordSalt, passwordHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uid, role, name, email, role === 'seller' ? String(body.phone).trim() : '', createdAt, passwordSalt, passwordHash)
    if (profile) database.prepare(`INSERT INTO seller_profiles (uid, businessName, sellerType, categories, productTags, location, idType, idNumber, description, status, rejectionReason, reapplicationPending)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', 0)`)
      .run(uid, profile.businessName, profile.sellerType, JSON.stringify(profile.categories), JSON.stringify(profile.productTags), profile.location, profile.idType, profile.idNumber, profile.description)
  })
  insert()
  const user = getUser(uid)
  response.status(201).json({ token: tokenFor(user), user: { uid, role, name, email, phone: user.phone, createdAt }, sellerProfile: profile })
})

app.post('/api/auth/login', (request, response) => {
  const email = String(request.body?.email || '').trim().toLowerCase()
  const password = request.body?.password
  const user = database.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email)
  if (!user || typeof password !== 'string' || !bcrypt.compareSync(password, user.passwordHash)) {
    return response.status(401).json({ error: 'Invalid email or password' })
  }
  response.json({ token: tokenFor(user), user: publicUser(user), sellerProfile: getProfile(user.uid) })
})

app.get('/api/auth/me', authRequired, (request, response) => {
  response.json({ user: publicUser(request.user), sellerProfile: getProfile(request.user.uid) })
})

app.post('/api/auth/reapply', authRequired, allowRoles('seller'), (request, response) => {
  const body = request.body || {}
  const profile = getProfile(request.user.uid)
  if (!profile || profile.status !== 'rejected') fail(409, 'This seller application is not eligible for reapplication.')
  const phone = String(body.phone || '').trim()
  const businessName = String(body.businessName || '').trim()
  const sellerType = body.sellerType
  const sellerCategories = parseList(body.categories)
  const location = String(body.location || '').trim()
  const idType = body.idType
  const idNumber = String(body.idNumber || '').trim()
  const description = String(body.description || '').trim()
  if (!/^[6-9]\d{9}$/.test(phone)) fail(400, 'Enter a valid 10-digit Indian mobile number.')
  if (!businessName) fail(400, 'Enter your business name.')
  if (!['individual', 'shop', 'company'].includes(sellerType)) fail(400, 'Choose a seller type.')
  if (!Array.isArray(sellerCategories) || sellerCategories.length === 0 || sellerCategories.some((category) => !categories.includes(category))) fail(400, 'Choose at least one valid category.')
  if (!location) fail(400, 'Enter your location.')
  if (!['GSTIN', 'Shop licence', 'Student ID'].includes(idType)) fail(400, 'Choose a verification ID type.')
  if (!idNumber) fail(400, 'Enter your ID number.')
  if (idType === 'GSTIN' && !validateGstin(idNumber)) fail(400, 'Enter a valid 15-character GSTIN, including its check digit.')
  if (!description) fail(400, 'Add a short business description.')
  if (database.prepare('SELECT 1 FROM users WHERE phone = ? AND uid != ?').get(phone, request.user.uid)) fail(409, 'An account with this phone number already exists.')
  const normalizedId = idType === 'GSTIN' ? idNumber.toUpperCase() : idNumber
  if (database.prepare('SELECT 1 FROM seller_profiles WHERE idNumber = ? COLLATE NOCASE AND uid != ?').get(normalizedId, request.user.uid)) fail(409, 'This verification ID is already in use.')
  database.transaction(() => {
    database.prepare('UPDATE users SET name = ?, phone = ? WHERE uid = ?').run(String(body.name || '').trim(), phone, request.user.uid)
    database.prepare(`UPDATE seller_profiles SET businessName = ?, sellerType = ?, categories = ?, productTags = ?, location = ?, idType = ?, idNumber = ?, description = ?, reapplicationPending = 1 WHERE uid = ?`)
      .run(businessName, sellerType, JSON.stringify(sellerCategories), JSON.stringify(cleanTags(body.productTags)), location, idType, normalizedId, description, request.user.uid)
  })()
  response.json({ user: publicUser(getUser(request.user.uid)), sellerProfile: getProfile(request.user.uid) })
})

app.get('/api/seller-profiles/:uid', authRequired, (request, response) => {
  const profile = getProfile(request.params.uid)
  if (!profile) fail(404, 'Seller profile not found.')
  if (request.user.uid !== profile.uid && request.user.role !== 'admin' && profile.status !== 'approved') fail(403, 'This seller profile is not available.')
  response.json(profile)
})

app.get('/api/requirements', authRequired, (request, response) => {
  let rows
  if (request.user.role === 'buyer') {
    rows = database.prepare('SELECT * FROM requirements WHERE buyerId = ? ORDER BY createdAt DESC').all(request.user.uid)
  } else if (request.user.role === 'seller') {
    const profile = getProfile(request.user.uid)
    if (profile?.status !== 'approved') fail(403, 'Seller approval is required to view requirements.')
    rows = database.prepare("SELECT * FROM requirements WHERE status = 'open' AND expiresAt > ? ORDER BY createdAt DESC").all(now())
      .map(decodeRequirement)
      .filter((requirement) => profile.categories.includes(requirement.category))
      .filter((requirement) => request.query.all === 'true' || profile.productTags.length === 0 || profile.productTags.some((tag) => [requirement.title, requirement.details, ...requirement.keywords].join(' ').toLowerCase().includes(tag.toLowerCase())))
    return response.json(rows)
  } else {
    rows = database.prepare('SELECT * FROM requirements ORDER BY createdAt DESC').all()
  }
  response.json(rows.map(decodeRequirement))
})

app.post('/api/requirements', authRequired, allowRoles('buyer'), (request, response) => {
  const fields = requirementFields(request.body || {})
  const id = randomUUID()
  const createdAt = now()
  const expiresAt = createdAt + fields.deadlineDays * 86400000
  database.prepare(`INSERT INTO requirements (id, buyerId, title, details, category, budget, deadlineDays, keywords, seenOfferIds, status, acceptedOfferId, acceptedSellerId, offersCount, createdAt, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', 'open', NULL, NULL, 0, ?, ?)`)
    .run(id, request.user.uid, fields.title, fields.details, fields.category, fields.budget, fields.deadlineDays, JSON.stringify(fields.keywords), createdAt, expiresAt)
  response.status(201).json(getRequirement(id))
})

app.get('/api/requirements/:requirementId', authRequired, (request, response) => {
  const requirement = getRequirement(request.params.requirementId)
  if (!requirement) fail(404, 'Requirement not found.')
  if (request.user.role === 'admin' || (request.user.role === 'buyer' && requirement.buyerId === request.user.uid)) return response.json(requirement)
  const profile = request.user.role === 'seller' ? getProfile(request.user.uid) : null
  if (profile?.status === 'approved' && isOpen(requirement) && profile.categories.includes(requirement.category)) return response.json(requirement)
  fail(403, 'You do not have access to this requirement.')
})

app.patch('/api/requirements/:requirementId', authRequired, allowRoles('buyer'), (request, response) => {
  const requirement = getRequirement(request.params.requirementId)
  if (!requirement || requirement.buyerId !== request.user.uid) fail(404, 'Requirement not found.')
  if (Array.isArray(request.body?.seenOfferIds)) {
    const allowedIds = new Set(database.prepare('SELECT id FROM offers WHERE requirementId = ? AND status = \'active\'').all(requirement.id).map((row) => row.id))
    if (request.body.seenOfferIds.some((id) => !allowedIds.has(id))) fail(400, 'Invalid seen response list.')
    database.prepare('UPDATE requirements SET seenOfferIds = ? WHERE id = ?').run(JSON.stringify([...new Set(request.body.seenOfferIds)]), requirement.id)
    return response.json(getRequirement(requirement.id))
  }
  if (request.body?.status === 'expired' && requirement.status === 'open' && requirement.expiresAt <= now()) {
    database.prepare("UPDATE requirements SET status = 'expired' WHERE id = ?").run(requirement.id)
    return response.json(getRequirement(requirement.id))
  }
  if (!isOpen(requirement)) fail(409, 'This requirement is no longer open.')
  const fields = requirementFields(request.body || {})
  const expiresAt = now() + fields.deadlineDays * 86400000
  database.prepare('UPDATE requirements SET title = ?, details = ?, category = ?, budget = ?, deadlineDays = ?, keywords = ?, expiresAt = ? WHERE id = ?')
    .run(fields.title, fields.details, fields.category, fields.budget, fields.deadlineDays, JSON.stringify(fields.keywords), expiresAt, requirement.id)
  response.json(getRequirement(requirement.id))
})

app.delete('/api/requirements/:requirementId', authRequired, allowRoles('buyer'), (request, response) => {
  const requirement = getRequirement(request.params.requirementId)
  if (!requirement || requirement.buyerId !== request.user.uid) fail(404, 'Requirement not found.')
  if (!isOpen(requirement)) fail(409, 'This requirement is no longer open.')
  database.prepare("UPDATE requirements SET status = 'cancelled' WHERE id = ?").run(requirement.id)
  response.json({ id: requirement.id, status: 'cancelled' })
})

app.get('/api/requirements/:requirementId/offers', authRequired, allowRoles('buyer', 'admin'), (request, response) => {
  const requirement = getRequirement(request.params.requirementId)
  if (!requirement || (request.user.role === 'buyer' && requirement.buyerId !== request.user.uid)) fail(404, 'Requirement not found.')
  const offers = database.prepare('SELECT * FROM offers WHERE requirementId = ? ORDER BY createdAt DESC').all(requirement.id)
    .map((row) => offerResponse(row))
  response.json(offers)
})

app.get('/api/offers/mine', authRequired, allowRoles('seller'), (request, response) => {
  response.json(database.prepare('SELECT * FROM offers WHERE sellerId = ? ORDER BY createdAt DESC').all(request.user.uid).map(decodeOffer))
})

app.post('/api/requirements/:requirementId/offers', authRequired, allowRoles('seller'), (request, response) => {
  const profile = getProfile(request.user.uid)
  if (profile?.status !== 'approved') fail(403, 'Only approved sellers can submit offers.')
  const requirement = getRequirement(request.params.requirementId)
  if (!isOpen(requirement)) fail(409, 'This requirement is no longer open.')
  if (!profile.categories.includes(requirement.category)) fail(403, 'This requirement is outside your approved categories.')
  const error = validateOffer(request.body || {})
  if (error) fail(400, error)
  const id = `${requirement.id}_${request.user.uid}`
  if (database.prepare('SELECT 1 FROM offers WHERE id = ?').get(id)) fail(409, 'You already responded to this requirement.')
  const values = request.body
  const createOffer = database.transaction(() => {
    database.prepare(`INSERT INTO offers (id, requirementId, requirementTitle, requirementCategory, sellerId, price, deliveryDays, description, shortlisted, pendingCounterOfferId, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 'active', ?)`)
      .run(id, requirement.id, requirement.title, requirement.category, request.user.uid, Number(values.price), Number(values.deliveryDays), values.description.trim(), now())
    database.prepare('UPDATE requirements SET offersCount = offersCount + 1 WHERE id = ?').run(requirement.id)
  })
  createOffer()
  response.status(201).json(getOffer(id))
})

app.patch('/api/offers/:offerId', authRequired, allowRoles('seller'), (request, response) => {
  const offer = getOffer(request.params.offerId)
  if (!offer || offer.sellerId !== request.user.uid) fail(404, 'Offer not found.')
  if (offer.status !== 'active' || offer.pendingCounterOfferId) fail(409, 'This offer cannot be changed.')
  if (!isOpen(getRequirement(offer.requirementId))) fail(409, 'This requirement is no longer open.')
  const profile = getProfile(request.user.uid)
  if (profile?.status !== 'approved') fail(403, 'Seller approval is required to change offers.')
  const fields = { price: request.body?.price, deliveryDays: request.body?.deliveryDays, description: request.body?.description }
  const error = validateOffer(fields)
  if (error) fail(400, error)
  database.prepare('UPDATE offers SET price = ?, deliveryDays = ?, description = ? WHERE id = ?')
    .run(Number(fields.price), Number(fields.deliveryDays), fields.description.trim(), offer.id)
  response.json(getOffer(offer.id))
})

app.delete('/api/offers/:offerId', authRequired, allowRoles('seller'), (request, response) => {
  const offer = getOffer(request.params.offerId)
  if (!offer || offer.sellerId !== request.user.uid) fail(404, 'Offer not found.')
  if (offer.status !== 'active' || !isOpen(getRequirement(offer.requirementId))) fail(409, 'This offer cannot be withdrawn.')
  if (getProfile(request.user.uid)?.status !== 'approved') fail(403, 'Seller approval is required to withdraw offers.')
  database.prepare("UPDATE offers SET status = 'withdrawn' WHERE id = ?").run(offer.id)
  response.json({ id: offer.id, status: 'withdrawn' })
})

app.post('/api/offers/:offerId/shortlist', authRequired, allowRoles('buyer'), (request, response) => {
  const offer = getOffer(request.params.offerId)
  const requirement = offer && getRequirement(offer.requirementId)
  if (!offer || requirement?.buyerId !== request.user.uid) fail(404, 'Offer not found.')
  if (offer.status !== 'active' || !isOpen(requirement)) fail(409, 'This offer is no longer available.')
  database.prepare('UPDATE offers SET shortlisted = ? WHERE id = ?').run(request.body?.shortlisted === false ? 0 : 1, offer.id)
  response.json(getOffer(offer.id))
})

app.post('/api/offers/:offerId/accept', authRequired, allowRoles('buyer'), (request, response) => {
  const transaction = database.transaction(() => {
    const offer = getOffer(request.params.offerId)
    const requirement = offer && getRequirement(offer.requirementId)
    if (!offer || !requirement || requirement.buyerId !== request.user.uid) fail(404, 'Offer not found.')
    if (!isOpen(requirement) || offer.status !== 'active') fail(409, 'This offer or requirement is no longer available.')
    if (offer.pendingCounterOfferId) fail(409, 'Wait for the seller to answer the pending counter-offer.')
    const allOffers = database.prepare('SELECT * FROM offers WHERE requirementId = ?').all(requirement.id)
    if (Number(requirement.offersCount) !== allOffers.length) fail(409, 'Offers changed; refresh the comparison and try again.')
    database.prepare("UPDATE requirements SET status = 'closed', acceptedOfferId = ?, acceptedSellerId = ? WHERE id = ?")
      .run(offer.id, offer.sellerId, requirement.id)
    const markAccepted = database.prepare("UPDATE offers SET status = 'accepted', buyerId = ? WHERE id = ?")
    const markNotChosen = database.prepare("UPDATE offers SET status = 'notChosen' WHERE id = ? AND status IN ('active', 'withdrawn')")
    for (const competing of allOffers) {
      if (competing.id === offer.id) markAccepted.run(request.user.uid, competing.id)
      else markNotChosen.run(competing.id)
    }
    return getOffer(offer.id)
  })
  response.json(transaction())
})

app.get('/api/deals/:offerId', authRequired, (request, response) => {
  const offer = getOffer(request.params.offerId)
  if (!offer || offer.status !== 'accepted' || ![offer.buyerId, offer.sellerId].includes(request.user.uid)) fail(404, 'Deal not found for this account.')
  response.json({ offer, buyer: publicUser(getUser(offer.buyerId)), seller: publicUser(getUser(offer.sellerId)) })
})

app.post('/api/offers/:offerId/counter-offers', authRequired, allowRoles('buyer'), (request, response) => {
  const offer = getOffer(request.params.offerId)
  const requirement = offer && getRequirement(offer.requirementId)
  const proposedPrice = Number(request.body?.proposedPrice)
  if (!offer || requirement?.buyerId !== request.user.uid) fail(404, 'Offer not found.')
  if (!Number.isFinite(proposedPrice) || proposedPrice <= 0 || proposedPrice > 1000000000) fail(400, 'Enter a valid counter-offer price.')
  if (!isOpen(requirement) || offer.status !== 'active' || !offer.shortlisted) fail(409, 'Only open, shortlisted offers can be countered.')
  if (offer.pendingCounterOfferId) fail(409, 'A counter-offer is already pending for this offer.')
  const profile = getProfile(offer.sellerId)
  if (profile?.status !== 'approved') fail(409, 'This seller is not approved.')
  const id = randomUUID()
  const createCounter = database.transaction(() => {
    database.prepare(`INSERT INTO counter_offers (id, offerId, requirementId, requirementTitle, buyerId, sellerId, proposedPrice, status, createdAt, respondedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL)`)
      .run(id, offer.id, requirement.id, offer.requirementTitle, request.user.uid, offer.sellerId, proposedPrice, now())
    database.prepare('UPDATE offers SET pendingCounterOfferId = ? WHERE id = ?').run(id, offer.id)
  })
  createCounter()
  response.status(201).json(getCounterOffer(id))
})

app.get('/api/counter-offers/mine', authRequired, (request, response) => {
  if (!['buyer', 'seller'].includes(request.user.role)) fail(403, 'You do not have access to counter-offers.')
  const field = request.user.role === 'buyer' ? 'buyerId' : 'sellerId'
  response.json(database.prepare(`SELECT * FROM counter_offers WHERE ${field} = ? ORDER BY createdAt DESC`).all(request.user.uid).map(decodeCounterOffer))
})

app.patch('/api/counter-offers/:counterOfferId', authRequired, allowRoles('seller'), (request, response) => {
  const counterOffer = getCounterOffer(request.params.counterOfferId)
  if (!counterOffer || counterOffer.sellerId !== request.user.uid || counterOffer.status !== 'pending') fail(404, 'Counter-offer not found.')
  if (getProfile(request.user.uid)?.status !== 'approved') fail(403, 'Seller approval is required to respond.')
  const decision = request.body?.status
  if (!['accepted', 'declined'].includes(decision)) fail(400, 'Choose accepted or declined.')
  const requirement = getRequirement(counterOffer.requirementId)
  const offer = getOffer(counterOffer.offerId)
  if (!isOpen(requirement) || offer?.pendingCounterOfferId !== counterOffer.id) fail(409, 'This counter-offer is no longer available.')
  const respond = database.transaction(() => {
    database.prepare('UPDATE counter_offers SET status = ?, respondedAt = ? WHERE id = ?').run(decision, now(), counterOffer.id)
    database.prepare('UPDATE offers SET price = ?, pendingCounterOfferId = NULL WHERE id = ?')
      .run(decision === 'accepted' ? counterOffer.proposedPrice : offer.price, offer.id)
  })
  respond()
  response.json(getCounterOffer(counterOffer.id))
})

app.get('/api/admin/sellers', authRequired, allowRoles('admin'), (request, response) => {
  const status = request.query.status
  const profiles = status
    ? database.prepare('SELECT * FROM seller_profiles WHERE status = ? OR reapplicationPending = 1 ORDER BY businessName').all(status)
    : database.prepare("SELECT * FROM seller_profiles WHERE status = 'pending' OR reapplicationPending = 1 ORDER BY businessName").all()
  response.json(profiles.map((row) => {
    const profile = decodeProfile(row)
    return { ...profile, user: publicUser(getUser(profile.uid)) }
  }))
})

app.patch('/api/admin/sellers/:uid', authRequired, allowRoles('admin'), (request, response) => {
  const profile = getProfile(request.params.uid)
  if (!profile) fail(404, 'Seller application not found.')
  const status = request.body?.status
  if (!['approved', 'rejected'].includes(status)) fail(400, 'Choose approved or rejected.')
  const rejectionReason = String(request.body?.rejectionReason || '').trim()
  if (status === 'rejected' && !rejectionReason) fail(400, 'Add a rejection reason before rejecting this application.')
  database.prepare('UPDATE seller_profiles SET status = ?, rejectionReason = ?, reapplicationPending = 0 WHERE uid = ?')
    .run(status, status === 'approved' ? '' : rejectionReason, profile.uid)
  response.json(getProfile(profile.uid))
})

app.post('/api/admin/reset-demo-data', authRequired, allowRoles('admin'), (request, response) => {
  seedDemoData({ reset: true })
  response.json({ status: 'reset', message: 'Demo data restored.' })
})

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  if (error instanceof HttpError) return response.status(error.status).json({ error: error.message })
  if (String(error?.code || '').startsWith('SQLITE_CONSTRAINT')) return response.status(409).json({ error: 'That value is already in use or conflicts with another record.' })
  console.error(error)
  response.status(500).json({ error: 'The server could not complete this request.' })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`ReverseMarket API listening on http://127.0.0.1:${port}`)
})
