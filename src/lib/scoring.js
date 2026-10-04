export const DEFAULT_WEIGHTS = Object.freeze({ budget: 4, delivery: 3, relevance: 3 })
const SCORE_KEYS = Object.keys(DEFAULT_WEIGHTS)
const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

function normalizeWord(word) {
  const lower = word.toLowerCase()
  if (lower.length > 3 && lower.endsWith('ies')) return `${lower.slice(0, -3)}y`
  if (lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1)
  return lower
}

function tokenize(text) {
  return String(text ?? '').toLowerCase().match(/[a-z0-9]+/g)?.map(normalizeWord) ?? []
}

function keywordMatches(description, keyword) {
  const phrase = tokenize(keyword)
  if (phrase.length === 0) return false

  // Match normalized consecutive words so simple plurals work without substring false positives.
  const words = tokenize(description)
  return words.some((_, start) => phrase.every((word, offset) => words[start + offset] === word))
}

function budgetScore(price, budget) {
  if (!Number.isFinite(price) || !Number.isFinite(budget)) return 0
  if (price <= budget) return 100
  if (budget <= 0) return 0
  // Penalize each unit over budget at three times its share of the budget.
  const overBudget = price - budget
  return Math.max(0, Math.round(100 - (overBudget / budget) * 300))
}

function deliveryScore(deliveryDays, deadlineDays) {
  if (!Number.isFinite(deliveryDays) || !Number.isFinite(deadlineDays) || deadlineDays <= 0) return 0
  // On-time delivery starts at 70 and reaches 100 at immediate delivery; lateness loses 25 per day.
  if (deliveryDays <= deadlineDays) {
    return Math.round(70 + 30 * ((deadlineDays - deliveryDays) / deadlineDays))
  }
  return Math.max(0, 70 - (deliveryDays - deadlineDays) * 25)
}

function uniqueKeywords(keywords) {
  const seen = new Set()
  return (Array.isArray(keywords) ? keywords : []).filter((keyword) => {
    const normalized = tokenize(keyword).join(' ')
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function relevanceScore(description, keywords) {
  if (keywords.length === 0) return { score: 70, matched: 0 }
  // Count each distinct buyer keyword once, then convert the match ratio to a percentage.
  const matched = keywords.filter((keyword) => keywordMatches(description, keyword)).length
  return { score: Math.round((matched / keywords.length) * 100), matched }
}

function resolveWeights(weights) {
  const resolved = Object.fromEntries(SCORE_KEYS.map((key) => {
    const value = Number(weights?.[key])
    return [key, Number.isFinite(value) ? Math.max(0, value) : DEFAULT_WEIGHTS[key]]
  }))
  if (Object.values(resolved).every((value) => value === 0)) return { ...DEFAULT_WEIGHTS }
  return resolved
}

function explainOffer(offer, requirement, keywordCount, matchedKeywords) {
  const price = Number(offer.price)
  const budget = Number(requirement.budget)
  const deliveryDays = Number(offer.deliveryDays)
  const deadlineDays = Number(requirement.deadlineDays)
  const budgetText = price < budget
    ? `Rs ${formatter.format(Math.round(budget - price))} under budget`
    : price === budget
      ? 'At budget'
      : `Rs ${formatter.format(Math.round(price - budget))} over budget`
  const deliveryText = deliveryDays < deadlineDays
    ? `${deadlineDays - deliveryDays} ${deadlineDays - deliveryDays === 1 ? 'day' : 'days'} early`
    : deliveryDays === deadlineDays
      ? 'on time'
      : `${deliveryDays - deadlineDays} ${deliveryDays - deadlineDays === 1 ? 'day' : 'days'} late`
  const relevanceText = keywordCount === 0
    ? 'no keyword criteria'
    : `matches ${matchedKeywords} of ${keywordCount} keywords`
  return `${budgetText}, ${deliveryText}, ${relevanceText}.`
}

/** Score and rank offers without mutating the supplied requirement or offers. */
export function scoreOffers(offers, requirement, buyerWeights) {
  if (!Array.isArray(offers) || offers.length === 0) return []

  const keywords = uniqueKeywords(requirement?.keywords)
  const weights = resolveWeights(buyerWeights ?? requirement?.weights)
  const weightTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  const scored = offers.map((offer) => {
    const relevance = relevanceScore(offer.description, keywords)
    const scores = {
      budget: budgetScore(Number(offer.price), Number(requirement.budget)),
      delivery: deliveryScore(Number(offer.deliveryDays), Number(requirement.deadlineDays)),
      relevance: relevance.score,
    }
    // Preserve the weighted-average value so ranking never depends on display rounding.
    const total = SCORE_KEYS.reduce((sum, key) => sum + scores[key] * weights[key], 0) / weightTotal
    return {
      ...offer,
      scores,
      total,
      why: explainOffer(offer, requirement, keywords.length, relevance.matched),
      badges: [],
    }
  })

  const bestTotal = Math.max(...scored.map((offer) => offer.total))
  const bestValue = Math.min(...scored.map((offer) => Number(offer.price)))
  const fastest = Math.min(...scored.map((offer) => Number(offer.deliveryDays)))

  // Assign badges to every tied offer instead of hiding ties behind list order.
  for (const offer of scored) {
    if (offer.total === bestTotal) offer.badges.push('Best match')
    if (Number(offer.price) === bestValue) offer.badges.push('Best value')
    if (Number(offer.deliveryDays) === fastest) offer.badges.push('Fastest')
  }

  return scored
    .sort((left, right) => right.total - left.total
      || Number(left.price) - Number(right.price)
      || Number(left.deliveryDays) - Number(right.deliveryDays))
}
