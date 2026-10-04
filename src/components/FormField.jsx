import { Children, cloneElement, isValidElement } from 'react'

export default function FormField({ id, label, error, hint, className = '', children }) {
  const hintId = hint ? `${id}-hint` : null
  const errorId = error ? `${id}-error` : null
  const describedBy = [hint && !error ? hintId : null, errorId].filter(Boolean).join(' ') || undefined
  const accessibleChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) return child
    const existingDescription = child.props['aria-describedby']
    return cloneElement(child, {
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': [existingDescription, describedBy].filter(Boolean).join(' ') || undefined,
    })
  })

  return (
    <div className={`form-field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {accessibleChildren}
      {hint && !error ? <p className="form-help" id={hintId}>{hint}</p> : null}
      {error ? <p className="form-error" id={errorId} role="alert">{error}</p> : null}
    </div>
  )
}
