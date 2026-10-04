import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { getDeal } from '../lib/db.js'

function ContactCard({ label, user }) {
  return (
    <section className="deal-contact-card" aria-label={`${label} contact details`}>
      <p className="eyebrow">{label}</p>
      <h2>{user.name || label}</h2>
      <dl>
        <div><dt>Email</dt><dd><a href={`mailto:${user.email}`}>{user.email || 'Not provided'}</a></dd></div>
        <div><dt>Phone</dt><dd>{user.phone || 'Not provided'}</dd></div>
      </dl>
    </section>
  )
}

export default function DealConfirmedPage() {
  const { offerId } = useParams()
  const { account } = useAuth()
  const [deal, setDeal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!offerId || !account?.uid) return undefined
    let active = true

    async function loadDeal() {
      try {
        const { offer, buyer, seller } = await getDeal(offerId)
        if (!buyer || !seller) throw new Error('CONTACT_NOT_FOUND')
        if (!active) return

        setDeal({
          offer,
          buyer,
          seller,
        })
        setError('')
      } catch (loadError) {
        if (!active) return
        setError(loadError.message === 'CONTACT_NOT_FOUND'
          ? 'Contact information could not be loaded for this deal.'
          : 'This deal could not be found for your account.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDeal()
    return () => { active = false }
  }, [offerId, account?.uid])

  return (
    <div className="deal-page">
      {loading ? <div className="status-panel" role="status">Loading deal details...</div> : null}
      {!loading && error ? <div className="status-panel status-error" role="alert">{error}</div> : null}
      {!loading && !error && deal ? (
        <>
          <header className="deal-confirmed-heading">
            <span className="deal-check" aria-hidden="true">&#10003;</span>
            <p className="eyebrow">ReverseMarket</p>
            <h1>Deal confirmed</h1>
            <p>The offer was accepted. Contact details are now available to both parties.</p>
          </header>

          <section className="deal-summary" aria-label="Accepted offer summary">
            <div>
              <span>Requirement</span>
              <strong>{deal.offer.requirementTitle}</strong>
            </div>
            <div>
              <span>Accepted offer</span>
              <strong>Rs {new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(deal.offer.price)}</strong>
            </div>
            <div>
              <span>Delivery</span>
              <strong>{deal.offer.deliveryDays} days</strong>
            </div>
          </section>

          <div className="deal-contacts">
            <ContactCard label="Buyer" user={deal.buyer} />
            <ContactCard label="Chosen seller" user={deal.seller} />
          </div>
          <Link className="comparison-back-link" to={account.role === 'seller' ? '/seller' : '/buyer'}>
            {account.role === 'seller' ? 'Back to seller dashboard' : 'Back to my requirements'}
          </Link>
        </>
      ) : null}
    </div>
  )
}
