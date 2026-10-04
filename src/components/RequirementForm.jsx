import { useState } from 'react'
import FormField from './FormField.jsx'
import { categories } from '../lib/validation.js'
import { validateRequirement } from '../lib/requirementValidation.js'

const emptyValues = {
  title: '',
  details: '',
  category: '',
  budget: '',
  deadlineDays: '7',
  keywords: '',
}

export default function RequirementForm({ initialValue, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialValue ? {
    title: initialValue.title,
    details: initialValue.details || '',
    category: initialValue.category,
    budget: String(initialValue.budget),
    deadlineDays: String(initialValue.deadlineDays),
    keywords: initialValue.keywords.join(', '),
  } : emptyValues)
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
    const nextErrors = validateRequirement(values)
    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      await onSubmit(values)
    } catch (error) {
      setFormError(error.code === 'permission-denied'
        ? 'Your requirement could not be saved. Check your buyer account and try again.'
        : 'Your requirement could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="requirement-form" onSubmit={handleSubmit} noValidate>
      {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
      <div className="requirement-fields">
        <FormField id="requirement-title" label="What do you need?" error={errors.title} className="wide-field">
          <input
            autoComplete="off"
            id="requirement-title"
            maxLength={120}
            name="title"
            onChange={updateField}
            placeholder="e.g. 20 folding chairs for a campus event"
            value={values.title}
          />
        </FormField>
        <FormField id="requirement-category" label="Category" error={errors.category}>
          <select id="requirement-category" name="category" onChange={updateField} value={values.category}>
            <option value="">Choose a category</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </FormField>
        <FormField id="requirement-details" label="Additional details" className="wide-field">
          <textarea id="requirement-details" maxLength={500} name="details" onChange={updateField} placeholder="Add any other helpful details for sellers." rows={2} value={values.details} />
        </FormField>
        <FormField id="requirement-budget" label="Budget (Rs)" error={errors.budget}>
          <input
            id="requirement-budget"
            inputMode="decimal"
            max="1000000000"
            min="0.01"
            name="budget"
            onChange={updateField}
            placeholder="40000"
            step="0.01"
            type="number"
            value={values.budget}
          />
        </FormField>
        <FormField id="requirement-deadline" label="Needed within (days)" error={errors.deadlineDays}>
          <input
            id="requirement-deadline"
            inputMode="numeric"
            max="365"
            min="1"
            name="deadlineDays"
            onChange={updateField}
            step="1"
            type="number"
            value={values.deadlineDays}
          />
        </FormField>
        <FormField id="requirement-keywords" label="Keywords" error={errors.keywords} hint="Separate useful details with commas. Up to 12 keywords.">
          <input
            id="requirement-keywords"
            maxLength={500}
            name="keywords"
            onChange={updateField}
            placeholder="foldable, steel, delivery"
            value={values.keywords}
          />
        </FormField>
      </div>
      <div className="requirement-form-actions">
        {onCancel ? <button className="review-button secondary-action" disabled={saving} onClick={onCancel} type="button">Cancel</button> : null}
        <button className="button-primary requirement-submit" disabled={saving} type="submit">
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
