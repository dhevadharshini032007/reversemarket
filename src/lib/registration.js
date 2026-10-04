import { authenticate, requestReapplication, signup } from './db.js'

export async function registerAccount(values) {
  return signup({ ...values, name: values.name.trim(), email: values.email.trim().toLowerCase(), acceptedTerms: values.role !== 'seller' || values.acceptedTerms === true })
}

export async function loginAccount(email, password) {
  return authenticate(email, password)
}

export async function reapplySeller(values, uid) {
  return requestReapplication({ ...values, uid })
}
