export function validateCounterOffer(value) {
  const proposedPrice = Number(value)
  if (!Number.isFinite(proposedPrice) || proposedPrice <= 0 || proposedPrice > 1000000000) {
    return 'Enter a proposed price greater than Rs 0 and no more than Rs 1,000,000,000.'
  }
  return ''
}
