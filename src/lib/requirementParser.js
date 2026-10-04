import { categories } from './validation.js'

const stopWords = new Set(['a', 'an', 'and', 'for', 'i', 'in', 'need', 'of', 'on', 'the', 'to', 'with'])
const numberWords = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const categoryRules = [
  ['Event supplies', /\b(event|party|chairs?|tables?|tents?|decorations?|catering|supplies)\b/i],
  ['Electronics', /\b(electronics?|laptops?|computers?|phones?|chargers?|devices?|headphones?)\b/i],
  ['Books', /\b(books?|textbooks?|novels?|workbooks?)\b/i],
  ['Services', /\b(services?|tutoring|repairs?|plumbing|cleaning|photography|lessons?)\b/i],
  ['Furniture', /\b(furniture|sofas?|desks?|beds?|wardrobes?|cabinets?)\b/i],
]

function parseBudget(sentence) {
  const patterns = [
    /\bunder\s+(?:rs\.?\s*)?([\d,]+(?:\.\d+)?)\s*(k|thousand)?\b/i,
    /\brs\.?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand)?\b/i,
    /\b([\d]{1,3}(?:,\d{3})+|\d{4,})(?:\.\d+)?\b/i,
  ]
  for (const pattern of patterns) {
    const match = sentence.match(pattern)
    if (!match) continue
    const raw = Number(match[1].replaceAll(',', ''))
    const multiplier = /^(k|thousand)$/i.test(match[2] || '') ? 1000 : 1
    return { budget: raw * multiplier, text: match[0] }
  }
  return { budget: '', text: '' }
}

function parseDeadline(sentence, referenceDate) {
  const relative = sentence.match(/\b(?:within|in)\s+(a|an|\d+|one|two|three|four|five|six|seven)\s+(days?|weeks?)\b/i)
  if (relative) {
    const count = Number(relative[1]) || numberWords[relative[1].toLowerCase()]
    const days = relative[2].toLowerCase().startsWith('week') ? count * 7 : count
    return { deadlineDays: Math.min(365, days), text: relative[0] }
  }

  const weekdayMatch = sentence.match(/\bby\s+(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i)
  if (weekdayMatch) {
    const targetDay = weekdays.indexOf(weekdayMatch[1].toLowerCase())
    const currentDay = referenceDate.getDay()
    const deadlineDays = (targetDay - currentDay + 7) % 7 || 7
    return { deadlineDays, text: weekdayMatch[0] }
  }

  return { deadlineDays: 7, text: '' }
}

function parseCategory(text) {
  for (const [category, pattern] of categoryRules) {
    if (pattern.test(text)) return category
  }
  return categories.includes('Other') ? 'Other' : categories.at(-1)
}

function makeKeywords(title) {
  const words = title.toLowerCase().match(/[a-z0-9]+/g) || []
  return [...new Set(words.filter((word) => !stopWords.has(word)))].slice(0, 12)
}

export function parseRequirementSentence(sentence, referenceDate = new Date()) {
  const source = String(sentence || '').trim()
  const budget = parseBudget(source)
  const deadline = parseDeadline(source, referenceDate)
  let title = source
  if (budget.text) title = title.replace(budget.text, ' ')
  if (deadline.text) title = title.replace(deadline.text, ' ')
  title = title.replace(/[\s,.;-]+/g, ' ').trim()

  return {
    title: title || source,
    category: parseCategory(source),
    budget: budget.budget,
    deadlineDays: deadline.deadlineDays,
    keywords: makeKeywords(title),
  }
}
