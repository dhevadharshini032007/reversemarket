import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FormField from '../components/FormField.jsx'
import { useAuth } from '../context/useAuth.js'
import { loginAccount, reapplySeller, registerAccount } from '../lib/registration.js'
import { categories, validateEmail, validateGstin, validatePassword } from '../lib/validation.js'

const emptyForm = {
  role: 'buyer',
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  businessName: '',
  sellerType: 'individual',
  categories: [],
  productTags: '',
  location: '',
  idType: 'GSTIN',
  idNumber: '',
  description: '',
  acceptedTerms: false,
}

function validateForm(values, mode) {
  const errors = {}
  if (!validateEmail(values.email)) errors.email = 'Enter a valid email address.'
  if (mode === 'login') {
    if (!values.password) errors.password = 'Enter your password.'
    return errors
  }

  if (!values.name.trim()) errors.name = 'Enter your full name.'
  if (mode !== 'reapply') {
    if (!validatePassword(values.password)) errors.password = 'Use at least 8 characters with both letters and numbers.'
    if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  }

  if (values.role === 'seller') {
    if (!/^[6-9]\d{9}$/.test(values.phone.trim())) errors.phone = 'Enter a valid 10-digit Indian mobile number.'
    if (!values.businessName.trim()) errors.businessName = 'Enter your business name.'
    if (!['individual', 'shop', 'company'].includes(values.sellerType)) errors.sellerType = 'Choose a seller type.'
    if (values.categories.length === 0) errors.categories = 'Choose at least one category.'
    if (!values.location.trim()) errors.location = 'Enter your location.'
    if (!['GSTIN', 'Shop licence', 'Student ID'].includes(values.idType)) errors.idType = 'Choose a verification ID type.'
    if (!values.idNumber.trim()) errors.idNumber = 'Enter your ID number.'
    if (values.idType === 'GSTIN' && !validateGstin(values.idNumber)) {
      errors.idNumber = 'Enter a valid 15-character GSTIN, including its check digit.'
    }
    if (!values.description.trim()) errors.description = 'Add a short business description.'
    if (!values.acceptedTerms) errors.acceptedTerms = 'Accept the seller terms to continue.'
  }
  return errors
}

function authErrorMessage(error, mode) {
  if (mode === 'login') return 'Invalid email or password'
  if (error.message === 'APPLICATION_NOT_REJECTED') return 'This seller application is no longer awaiting re-application.'
  if (error.message === 'EMAIL_IN_USE') return 'An account with this email already exists.'
  if (error.message === 'PHONE_IN_USE') return 'An account with this phone number already exists.'
  if (error.message === 'ID_IN_USE') return 'This verification ID is already in use.'
  return mode === 'reapply'
    ? 'We could not submit your application. Check your connection and try again.'
    : 'We could not create your account. Check your connection and try again.'
}

export default function AuthPage({ mode }) {
  const navigate = useNavigate()
  const { refreshAccount, account, sellerProfile } = useAuth()
  const isReapply = mode === 'reapply'
  const isSignup = mode === 'signup' || isReapply
  const [values, setValues] = useState(() => isReapply ? {
    ...emptyForm,
    role: 'seller',
    name: account?.name || '',
    email: account?.email || '',
    phone: account?.phone || '',
    businessName: sellerProfile?.businessName || '',
    sellerType: sellerProfile?.sellerType || 'individual',
    categories: sellerProfile?.categories || [],
    productTags: sellerProfile?.productTags?.join(', ') || '',
    location: sellerProfile?.location || '',
    idType: sellerProfile?.idType || 'GSTIN',
    idNumber: sellerProfile?.idNumber || '',
    description: sellerProfile?.description || '',
    acceptedTerms: true,
  } : emptyForm)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isSellerSignup = isSignup && values.role === 'seller'

  function updateField(event) {
    const { name, value, checked, type } = event.target
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setFormError('')
  }

  function toggleCategory(category) {
    setValues((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }))
    setErrors((current) => ({ ...current, categories: '' }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validationErrors = validateForm(values, mode)
    setErrors(validationErrors)
    setFormError('')
    if (Object.keys(validationErrors).length > 0) return
    setSubmitting(true)
    try {
      const user = isReapply
        ? await reapplySeller(values, account?.uid)
        : isSignup
          ? await registerAccount(values)
          : await loginAccount(values.email.trim(), values.password)
      await refreshAccount(user)
      navigate(isReapply ? '/seller' : '/', { replace: true })
    } catch (error) {
      setFormError(authErrorMessage(error, mode))
    } finally {
      setSubmitting(false)
    }
  }

  function chooseRole(role) {
    setValues((current) => ({
      ...emptyForm,
      role,
      name: current.name,
      email: current.email,
      password: current.password,
      confirmPassword: current.confirmPassword,
    }))
    setErrors({})
    setFormError('')
  }

  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <div>
          <p className="eyebrow">{isReapply ? 'Seller application' : isSignup ? 'Join ReverseMarket' : 'Welcome back'}</p>
          <h1>{isReapply ? 'Let’s get your application back on track.' : isSignup ? 'Good things begin with a clear need.' : 'Pick up where your next deal begins.'}</h1>
          <p className="auth-story-copy">
            {isReapply
              ? 'Review the note from our team, update your details, and send your application back for review.'
              : isSignup
              ? 'Create an account to take part in a marketplace built around real requirements.'
              : 'Sign in to return to your ReverseMarket workspace.'}
          </p>
        </div>
        <p className="auth-story-note">One place for buyers with a brief and sellers with a better-fit offer.</p>
      </aside>

      <section className="auth-form-wrap" aria-labelledby="auth-title">
        <h2 id="auth-title">{isReapply ? 'Update your seller details' : isSignup ? 'Create your account' : 'Log in'}</h2>
        <p className="form-intro">{isReapply ? 'Your seller account stays the same while we review the updated application.' : isSignup ? 'A few details and you are ready to get started.' : 'Enter your account details to continue.'}</p>
        {isReapply && sellerProfile?.rejectionReason ? (
          <div className="reapply-note"><strong>Review note</strong><p>{sellerProfile.rejectionReason}</p></div>
        ) : null}
        {mode === 'login' ? (
          <div className="config-notice demo-login-note" role="note">
            <strong>Demo logins</strong><br />Admin: admin@demo.com / Admin2026<br />Buyers: ananya@demo.com, karthik@demo.com / Demo2026<br />Approved sellers: meera@demo.com, arjun@demo.com, priya@demo.com / Demo2026<br />Pending seller: ravi@demo.com / Demo2026
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          {mode === 'signup' ? (
            <div className="role-picker" role="group" aria-label="Account type">
              <button aria-pressed={values.role === 'buyer'} className="role-option" onClick={() => chooseRole('buyer')} type="button">Buyer</button>
              <button aria-pressed={values.role === 'seller'} className="role-option" onClick={() => chooseRole('seller')} type="button">Seller</button>
            </div>
          ) : null}

          {formError ? <div className="form-alert" role="alert">{formError}</div> : null}

          <div className="form-grid">
            {isSignup ? (
              <FormField id="name" label="Full name" error={errors.name} className="full-width">
                <input autoComplete="name" id="name" name="name" onChange={updateField} value={values.name} />
              </FormField>
            ) : null}
            <FormField id="email" label="Email address" error={errors.email} className="full-width">
              <input autoComplete="email" id="email" name="email" onChange={updateField} readOnly={isReapply} type="email" value={values.email} />
            </FormField>
            {isSellerSignup ? (
              <>
                <FormField id="phone" label="Indian mobile number" error={errors.phone} hint="10 digits, starting with 6-9.">
                  <input autoComplete="tel-national" id="phone" inputMode="numeric" maxLength={10} name="phone" onChange={updateField} value={values.phone} />
                </FormField>
                <FormField id="businessName" label="Business name" error={errors.businessName}>
                  <input autoComplete="organization" id="businessName" name="businessName" onChange={updateField} value={values.businessName} />
                </FormField>
                <FormField id="sellerType" label="Seller type" error={errors.sellerType}>
                  <select id="sellerType" name="sellerType" onChange={updateField} value={values.sellerType}>
                    <option value="individual">Individual</option>
                    <option value="shop">Shop</option>
                    <option value="company">Company</option>
                  </select>
                </FormField>
                <FormField id="location" label="Location" error={errors.location}>
                  <input autoComplete="address-level2" id="location" name="location" onChange={updateField} value={values.location} />
                </FormField>
                <fieldset className="form-field full-width category-fieldset">
                  <legend className="field-label">Categories sold</legend>
                  <div className="category-checks">
                    {categories.map((category) => (
                      <label className="category-check" key={category}>
                        <input checked={values.categories.includes(category)} onChange={() => toggleCategory(category)} type="checkbox" />
                        {category}
                      </label>
                    ))}
                  </div>
                  {errors.categories ? <p className="form-error" role="alert">{errors.categories}</p> : null}
                </fieldset>
                <FormField id="productTags" label="Products you sell" hint="Optional. Separate product names with commas, such as laptop, mouse, keyboard." className="full-width">
                  <input id="productTags" name="productTags" onChange={updateField} placeholder="laptop, mouse, keyboard" value={values.productTags} />
                </FormField>
                <FormField id="idType" label="Verification ID type" error={errors.idType}>
                  <select id="idType" name="idType" onChange={updateField} value={values.idType}>
                    <option value="GSTIN">GSTIN</option>
                    <option value="Shop licence">Shop licence</option>
                    <option value="Student ID">Student ID</option>
                  </select>
                </FormField>
                <FormField id="idNumber" label="ID number" error={errors.idNumber} hint="Stored as text. Do not upload documents.">
                  <input autoComplete="off" id="idNumber" name="idNumber" onChange={updateField} value={values.idNumber} />
                </FormField>
                <FormField id="description" label="Short business description" error={errors.description} className="full-width">
                  <textarea id="description" name="description" onChange={updateField} rows={2} value={values.description} />
                </FormField>
              </>
            ) : null}
            {!isReapply ? (
              <FormField id="password" label="Password" error={errors.password} hint={isSignup ? 'At least 8 characters, with letters and numbers.' : undefined}>
                <input autoComplete={isSignup ? 'new-password' : 'current-password'} id="password" name="password" onChange={updateField} type="password" value={values.password} />
              </FormField>
            ) : null}
            {isSignup && !isReapply ? (
              <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
                <input autoComplete="new-password" id="confirmPassword" name="confirmPassword" onChange={updateField} type="password" value={values.confirmPassword} />
              </FormField>
            ) : null}
            {isSellerSignup ? (
              <div className="form-field full-width">
                <label className="terms-row" htmlFor="acceptedTerms">
                  <input
                    aria-describedby={errors.acceptedTerms ? 'acceptedTerms-error' : undefined}
                    aria-invalid={Boolean(errors.acceptedTerms)}
                    checked={values.acceptedTerms}
                    id="acceptedTerms"
                    name="acceptedTerms"
                    onChange={updateField}
                    type="checkbox"
                  />
                  <span>I agree to the seller terms and confirm these business details are accurate.</span>
                </label>
                {errors.acceptedTerms ? <p className="form-error" id="acceptedTerms-error" role="alert">{errors.acceptedTerms}</p> : null}
              </div>
            ) : null}
          </div>

          <button className="button-primary form-submit" disabled={submitting} type="submit">
            {submitting ? 'Please wait...' : isReapply ? 'Submit application for review' : isSignup ? 'Create account' : 'Log in'}
          </button>
          <p className="auth-switch">
            {isReapply ? '' : isSignup ? 'Already have an account? ' : 'New to ReverseMarket? '}
            {isReapply
              ? <Link to="/seller">Back to seller status</Link>
              : <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Log in' : 'Create an account'}</Link>}
          </p>
        </form>
      </section>
    </div>
  )
}
