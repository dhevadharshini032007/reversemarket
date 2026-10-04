import { categories } from './validation.js'

export function parseKeywords(value) {
  return [...new Set(value.split(',').map((keyword) => keyword.trim()).filter(Boolean))]
}

export function validateRequirement(values) {
  const errors = {}
  const title = values.title.trim()
  const budget = Number(values.budget)
  const deadlineDays = Number(values.deadlineDays)
  const keywords = parseKeywords(values.keywords)

  if (title.length < 4 || title.length > 120) errors.title = 'Use a title between 4 and 120 characters.'
  if (!categories.includes(values.category)) errors.category = 'Choose a category.'
  if (!Number.isFinite(budget) || budget <= 0 || budget > 1000000000) {
    errors.budget = 'Enter a budget greater than Rs 0 and no more than Rs 1,000,000,000.'
  }
  if (!Number.isInteger(deadlineDays) || deadlineDays < 1 || deadlineDays > 365) {
    errors.deadlineDays = 'Choose a deadline from 1 to 365 days.'
  }
  if (keywords.length > 12) errors.keywords = 'Use up to 12 keywords.'
  if (keywords.some((keyword) => keyword.length > 40)) errors.keywords = 'Each keyword must be 40 characters or fewer.'

  return errors
}
