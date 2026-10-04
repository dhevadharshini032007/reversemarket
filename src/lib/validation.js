const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const base36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const categories = ['Electronics', 'Books', 'Services', 'Event supplies', 'Furniture', 'Other']

export function validateEmail(email) {
  return emailPattern.test(email.trim())
}

export function validatePassword(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
}

export function validateGstin(value) {
  const gstin = value.trim().toUpperCase()
  if (!gstinPattern.test(gstin)) return false

  // GSTIN uses a base-36 check digit with alternating weights from right to left.
  let factor = 2
  let sum = 0
  for (let index = 13; index >= 0; index -= 1) {
    const product = base36.indexOf(gstin[index]) * factor
    sum += Math.floor(product / 36) + (product % 36)
    factor = factor === 2 ? 1 : 2
  }
  const checkDigit = (36 - (sum % 36)) % 36
  return base36[checkDigit] === gstin[14]
}

export async function hashIdentifier(value) {
  const data = new TextEncoder().encode(value.trim().toUpperCase())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
