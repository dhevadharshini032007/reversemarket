import { useState } from 'react'
import { validateCounterOffer } from '../lib/counterOfferValidation.js'

function counterErrorMessage(error) {
  if (error.message === 'COUNTER_ALREADY_PENDING') return 'A counter-offer is already waiting for this seller.'
  if (error.message === 'OFFER_NOT_SHORTLISTED') return 'Shortlist this active offer before sending a counter-offer.'
  if (error.message === 'REQUIREMENT_CLOSED') return 'This requirement is no longer open for counter-offers.'
  if (error.message === 'OFFER_UNAVAILABLE') return 'This offer is no longer available.'
  if (error.code === 'permission-denied') return 'The counter-offer could not be sent. Confirm it is shortlisted and the requirement is open.'
  return 'The counter-offer could not be sent. Check your connection and try again.'
}

export default function CounterOfferForm({ onSubmit, onCancel }) {
  const [proposedPrice, setProposedPrice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const validationError = validateCounterOffer(proposedPrice)
    setError(validationError)
    if (validationError) return

    setSaving(true)
    try {
      await onSubmit(Number(proposedPrice))
    } catch (submitError) {
      setError(counterErrorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="counter-offer-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="counter-offer-price">Your proposed price (Rs)</label>
      <input
        autoComplete="off"
        id="counter-offer-price"
        inputMode="decimal"
        max="1000000000"
        min="0.01"
        onChange={(event) => { setProposedPrice(event.target.value); setError('') }}
        placeholder="Enter your offer"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'counter-offer-price-error' : undefined}
        step="0.01"
        type="number"
        value={proposedPrice}
      />
      {error ? <p className="form-error" id="counter-offer-price-error" role="alert">{error}</p> : null}
      <div className="counter-form-actions">
        <button className="review-button secondary-action" disabled={saving} onClick={onCancel} type="button">Cancel</button>
        <button className="button-primary counter-submit" disabled={saving} type="submit">{saving ? 'Sending...' : 'Send counter-offer'}</button>
      </div>
    </form>
  )
}
