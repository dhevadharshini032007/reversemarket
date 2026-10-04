const currency = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

function points(value) {
  return Number(value.toFixed(1)).toString()
}

export function summarizeTopTradeOff(rankedOffers) {
  if (!Array.isArray(rankedOffers) || rankedOffers.length < 2) return ''

  const [first, second] = rankedOffers
  const parts = []
  const scoreDifference = Math.abs(Number(first.total) - Number(second.total))

  if (scoreDifference === 0) {
    parts.push(`Offers 1 and 2 are tied at ${points(Number(first.total))} points`)
  } else {
    parts.push(`Offer 1 leads by ${points(scoreDifference)} points`)
  }

  const priceDifference = Math.abs(Number(first.price) - Number(second.price))
  if (priceDifference > 0) {
    const cheaperOffer = Number(first.price) < Number(second.price) ? 1 : 2
    parts.push(`Offer ${cheaperOffer} costs Rs ${currency.format(priceDifference)} less`)
  } else {
    parts.push('both offers have the same price')
  }

  const deliveryDifference = Math.abs(Number(first.deliveryDays) - Number(second.deliveryDays))
  if (deliveryDifference > 0) {
    const fasterOffer = Number(first.deliveryDays) < Number(second.deliveryDays) ? 1 : 2
    parts.push(`Offer ${fasterOffer} arrives ${deliveryDifference} ${deliveryDifference === 1 ? 'day' : 'days'} sooner`)
  } else {
    parts.push('both offers have the same delivery time')
  }

  return `${parts.join('; ')}.`
}
