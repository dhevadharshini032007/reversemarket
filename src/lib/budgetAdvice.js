const LOW_BUDGET_THRESHOLD = 0.75
const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function calculateBudgetAdvice(budget, offers) {
  const currentBudget = Number(budget)
  const prices = (Array.isArray(offers) ? offers : [])
    .map((offer) => Number(offer.price))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right)

  if (!Number.isFinite(currentBudget) || currentBudget <= 0 || prices.length === 0) return null

  const middle = Math.floor(prices.length / 2)
  const median = prices.length % 2 === 0
    ? (prices[middle - 1] + prices[middle]) / 2
    : prices[middle]

  // Warn only when the current budget is at least 25% below observed offers.
  if (currentBudget >= median * LOW_BUDGET_THRESHOLD) return null

  return {
    currentBudget,
    median,
    suggestedBudget: median,
    raiseAmount: Math.ceil(median - currentBudget),
    belowMedianPercent: Math.round(((median - currentBudget) / median) * 100),
  }
}

export function formatBudgetAdvice(advice) {
  if (!advice) return ''
  return `Your budget is ${advice.belowMedianPercent}% below the current offer median of Rs ${formatter.format(advice.median)}. Consider raising it by Rs ${formatter.format(advice.raiseAmount)} to around Rs ${formatter.format(advice.suggestedBudget)}.`
}
