import { useState } from 'react'
import FormField from './FormField.jsx'
import { validateOffer } from '../lib/offerValidation.js'

function offerErrorMessage(error) {
  if (error.message === 'OFFER_EXISTS') return 'You already have an offer on this requirement. Edit it from My offers instead.'
  if (error.message === 'REQUIREMENT_CLOSED') return 'This requirement is no longer open for offers.'
  if (error.message === 'REQUIREMENT_EXPIRED') return 'The deadline has passed for this requirement.'
  if (error.message === 'SELLER_NOT_APPROVED') return 'Only approved sellers can submit or change offers.'
  if (error.message === 'CATEGORY_NOT_ALLOWED') return 'This requirement is outside your approved seller categories.'
  return 'The offer could not be saved. Check your connection and try again.'
}

export default function OfferForm({ requirement, initialValue, submitLabel, onSubmit, onCancel, noteLabel = 'Offer details' }) {
  const [values, setValues] = useState(() => initialValue ? {
    price: String(initialValue.price),
    deliveryDays: String(initialValue.deliveryDays),
    description: initialValue.description,
  } : { price: '', deliveryDays: '3', description: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateOffer(values)
    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      await onSubmit(values)
    } catch (error) {
      setFormError(offerErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="offer-form" onSubmit={handleSubmit} noValidate>
      {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
      <p className="offer-form-requirement">Offer for: <strong>{requirement.title}</strong></p>
      <div className="offer-form-fields">
        <FormField id="offer-price" label="Your price (Rs)" error={errors.price}>
          <input id="offer-price" inputMode="decimal" max="1000000000" min="0.01" name="price" onChange={updateField} placeholder="36000" step="0.01" type="number" value={values.price} />
        </FormField>
        <FormField id="offer-delivery" label="Delivery within (days)" error={errors.deliveryDays}>
          <input id="offer-delivery" inputMode="numeric" max="365" min="1" name="deliveryDays" onChange={updateField} step="1" type="number" value={values.deliveryDays} />
        </FormField>
        <FormField id="offer-description" label={noteLabel} error={errors.description} hint={noteLabel === 'Note' ? 'Add a short note about what you can supply.' : 'Describe what is included and any important terms.'} className="offer-description-field">
          <textarea id="offer-description" maxLength={1000} name="description" onChange={updateField} placeholder="Materials, delivery, availability, and other details" rows={3} value={values.description} />
        </FormField>
      </div>
      <div className="offer-form-actions">
        {onCancel ? <button className="review-button secondary-action" disabled={saving} onClick={onCancel} type="button">Cancel</button> : null}
        <button className="button-primary offer-submit" disabled={saving} type="submit">{saving ? 'Saving...' : submitLabel}</button>
      </div>
    </form>
  )
}
