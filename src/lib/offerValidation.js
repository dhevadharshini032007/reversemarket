export function validateOffer(values) {
  const errors = {}
  const price = Number(values.price)
  const deliveryDays = Number(values.deliveryDays)
  const description = values.description.trim()

  if (!Number.isFinite(price) || price <= 0 || price > 1000000000) {
    errors.price = 'Enter an offer price greater than Rs 0 and no more than Rs 1,000,000,000.'
  }
  if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) {
    errors.deliveryDays = 'Enter a delivery time from 1 to 365 days.'
  }
  if (description.length < 10 || description.length > 1000) {
    errors.description = 'Use a description between 10 and 1,000 characters.'
  }

  return errors
}
