export const categories = ['Electronics', 'Books', 'Services', 'Event supplies', 'Furniture', 'Other']

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

export function validatePassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /[A-Za-z]/.test(password)
    && /[0-9]/.test(password)
}

export function validateGstin(value) {
  const gstin = String(value || '').trim().toUpperCase()
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false
  const base36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let factor = 2
  let sum = 0
  for (let index = 13; index >= 0; index -= 1) {
    const product = base36.indexOf(gstin[index]) * factor
    sum += Math.floor(product / 36) + (product % 36)
    factor = factor === 2 ? 1 : 2
  }
  return base36[(36 - (sum % 36)) % 36] === gstin[14]
}

export function cleanTags(value) {
  const tags = Array.isArray(value) ? value : String(value || '').split(',')
  return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))]
}

export function validateRequirement(values) {
  const errors = {}
  const title = String(values.title || '').trim()
  const budget = Number(values.budget)
  const deadlineDays = Number(values.deadlineDays)
  const keywords = Array.isArray(values.keywords)
    ? values.keywords
    : String(values.keywords || '').split(',').map((keyword) => keyword.trim()).filter(Boolean)
  if (title.length < 4 || title.length > 120) errors.title = 'Use a title between 4 and 120 characters.'
  if (!categories.includes(values.category)) errors.category = 'Choose a category.'
  if (!Number.isFinite(budget) || budget <= 0 || budget > 1000000000) errors.budget = 'Enter a valid budget.'
  if (!Number.isInteger(deadlineDays) || deadlineDays < 1 || deadlineDays > 365) errors.deadlineDays = 'Choose a deadline from 1 to 365 days.'
  if (keywords.length > 12 || keywords.some((keyword) => keyword.length > 40)) errors.keywords = 'Use up to 12 keywords, with no keyword longer than 40 characters.'
  if (String(values.details || '').trim().length > 500) errors.details = 'Use no more than 500 characters of details.'
  return errors
}

export function validateOffer(values) {
  const price = Number(values.price)
  const deliveryDays = Number(values.deliveryDays)
  const description = String(values.description || '').trim()
  if (!Number.isFinite(price) || price <= 0 || price > 1000000000) return 'Enter a valid offer price.'
  if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) return 'Enter a delivery time from 1 to 365 days.'
  if (description.length < 10 || description.length > 1000) return 'Use an offer note between 10 and 1,000 characters.'
  return ''
}
