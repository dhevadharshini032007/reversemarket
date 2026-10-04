import assert from 'node:assert/strict'

const baseUrl = process.env.API_URL || 'http://127.0.0.1:3001'

async function call(path, method = 'GET', body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let data = {}
  try { data = await response.json() } catch { /* The status remains useful for assertion failures. */ }
  return { status: response.status, data }
}

async function login(email, password) {
  const result = await call('/api/auth/login', 'POST', { email, password })
  assert.equal(result.status, 200, `Login failed for ${email}: ${JSON.stringify(result.data)}`)
  return result.data.token
}

const health = await call('/api/health')
assert.equal(health.status, 200)

const adminToken = await login('admin@demo.com', 'Admin2026')
try {
  const buyerToken = await login('ananya@demo.com', 'Demo2026')
  const sellerToken = await login('meera@demo.com', 'Demo2026')
  const pendingSellerToken = await login('ravi@demo.com', 'Demo2026')

  const invalidLogin = await call('/api/auth/login', 'POST', { email: 'wrong@example.com', password: 'incorrect' })
  assert.equal(invalidLogin.status, 401)
  assert.equal(invalidLogin.data.error, 'Invalid email or password')

  const signupBody = { role: 'buyer', name: 'API Test Buyer', email: 'api-test@example.com', password: 'Testing2026', confirmPassword: 'Testing2026' }
  const signup = await call('/api/auth/signup', 'POST', signupBody)
  assert.equal(signup.status, 201)
  const duplicateSignup = await call('/api/auth/signup', 'POST', signupBody)
  assert.equal(duplicateSignup.status, 409)

  const deniedPendingSeller = await call('/api/requirements/req-campus-laptop/offers', 'POST', {
    price: 50000, deliveryDays: 3, description: 'Pending accounts cannot send marketplace responses.',
  }, pendingSellerToken)
  assert.equal(deniedPendingSeller.status, 403)

  const requirement = await call('/api/requirements', 'POST', {
    title: 'Laptop stand for study room',
    details: 'Need a sturdy laptop riser for a campus desk',
    category: 'Electronics',
    budget: 15000,
    deadlineDays: 14,
    keywords: ['laptop', 'stand'],
  }, buyerToken)
  assert.equal(requirement.status, 201)
  const requirementId = requirement.data.id

  const response = await call(`/api/requirements/${requirementId}/offers`, 'POST', {
    price: 12000,
    deliveryDays: 4,
    description: 'Aluminium laptop stand, delivered to campus.',
  }, sellerToken)
  assert.equal(response.status, 201)
  const offerId = response.data.id

  const ownerGuard = await call('/api/offers/req-campus-laptop_seller-demo-2', 'PATCH', {
    price: 20000,
    deliveryDays: 5,
    description: 'Attempted update of another seller response.',
  }, sellerToken)
  assert.equal(ownerGuard.status, 404)

  const shortlist = await call(`/api/offers/${offerId}/shortlist`, 'POST', { shortlisted: true }, buyerToken)
  assert.equal(shortlist.status, 200)
  const counterOffer = await call(`/api/offers/${offerId}/counter-offers`, 'POST', { proposedPrice: 11000 }, buyerToken)
  assert.equal(counterOffer.status, 201)
  const counterResponse = await call(`/api/counter-offers/${counterOffer.data.id}`, 'PATCH', { status: 'accepted' }, sellerToken)
  assert.equal(counterResponse.status, 200)
  assert.equal(counterResponse.data.status, 'accepted')

  const accepted = await call(`/api/offers/${offerId}/accept`, 'POST', {}, buyerToken)
  assert.equal(accepted.status, 200)
  const deal = await call(`/api/deals/${offerId}`, 'GET', undefined, sellerToken)
  assert.equal(deal.status, 200)
  assert.equal(deal.data.buyer.email, 'ananya@demo.com')
  const strangerDeal = await call(`/api/deals/${offerId}`, 'GET', undefined, pendingSellerToken)
  assert.equal(strangerDeal.status, 404)

  const deniedAdminQueue = await call('/api/admin/sellers', 'GET', undefined, sellerToken)
  assert.equal(deniedAdminQueue.status, 403)
  const approval = await call('/api/admin/sellers/seller-demo-4', 'PATCH', { status: 'approved' }, adminToken)
  assert.equal(approval.status, 200)
  assert.equal(approval.data.status, 'approved')

  console.log('API smoke checks passed: auth, role and ownership guards, requirements, offers, shortlist, counter-offers, acceptance, contact access, admin approval.')
} finally {
  const reset = await call('/api/admin/reset-demo-data', 'POST', {}, adminToken)
  assert.equal(reset.status, 200, 'Could not restore seeded demo data after smoke checks.')
}

const pendingQueue = await call('/api/admin/sellers', 'GET', undefined, adminToken)
assert.equal(pendingQueue.status, 200)
assert.equal(pendingQueue.data.length, 1)
