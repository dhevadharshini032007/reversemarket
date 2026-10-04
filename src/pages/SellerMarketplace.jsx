import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OfferForm from '../components/OfferForm.jsx'
import { getDeal } from '../lib/db.js'
import { matchingProductTag } from '../lib/productMatching.js'
import { useAuth } from '../context/useAuth.js'
import {
  createSellerOffer,
  respondToCounterOffer,
  updateSellerOffer,
  watchOpenRequirements,
  watchSellerCounterOffers,
  watchSellerOffers,
  withdrawSellerOffer,
} from '../lib/offers.js'

function formatBudget(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)
}

function dateLabel(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Deadline unavailable'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeValue(value) { return typeof value?.toMillis === 'function' ? value.toMillis() : Number(value || 0) }

function isPastDeadline(requirement, now) {
  return timeValue(requirement.expiresAt) <= now
}

function offerStatus(offer) {
  if (offer.status === 'accepted') return { label: 'Accepted', key: 'accepted' }
  if (offer.status === 'notChosen') return { label: 'Not chosen', key: 'notChosen' }
  if (offer.status === 'withdrawn') return { label: 'Withdrawn', key: 'withdrawn' }
  if (offer.shortlisted) return { label: 'Shortlisted', key: 'shortlisted' }
  return { label: 'Waiting', key: 'waiting' }
}

export default function SellerMarketplace({ sellerProfile }) {
  const { account } = useAuth()
  const [view, setView] = useState('requirements')
  const [requirements, setRequirements] = useState([])
  const [offers, setOffers] = useState([])
  const [counterOffers, setCounterOffers] = useState([])
  const [buyerUsers, setBuyerUsers] = useState({})
  const [requirementsLoading, setRequirementsLoading] = useState(true)
  const [offersLoading, setOffersLoading] = useState(true)
  const [requirementsError, setRequirementsError] = useState('')
  const [offersError, setOffersError] = useState('')
  const [counterOffersLoading, setCounterOffersLoading] = useState(true)
  const [counterOffersError, setCounterOffersError] = useState('')
  const [actionError, setActionError] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [maxBudget, setMaxBudget] = useState('')
  const [showAllRequirements, setShowAllRequirements] = useState(false)
  const [activeRequirementId, setActiveRequirementId] = useState('')
  const [editingOfferId, setEditingOfferId] = useState('')
  const [offerBusyId, setOfferBusyId] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const unsubscribe = watchOpenRequirements((snapshot) => {
      setRequirements(snapshot.docs.map((item) => item.data()))
      setRequirementsLoading(false)
      setRequirementsError('')
    }, () => {
      setRequirementsLoading(false)
      setRequirementsError('Open requirements could not be loaded. Check your connection and approved seller access.')
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!account?.uid) return undefined
    const unsubscribe = watchSellerOffers(account.uid, (snapshot) => {
      const sellerOffers = snapshot.docs.map((item) => item.data())
      setOffers(sellerOffers.sort((left, right) => timeValue(right.createdAt) - timeValue(left.createdAt)))
      setOffersLoading(false)
      setOffersError('')
    }, () => {
      setOffersLoading(false)
      setOffersError('Your offers could not be loaded. Check your connection and seller access.')
    })
    return unsubscribe
  }, [account?.uid])

  useEffect(() => {
    if (!account?.uid) return undefined
    const unsubscribe = watchSellerCounterOffers(account.uid, (snapshot) => {
      const counters = snapshot.docs.map((item) => item.data())
      setCounterOffers(counters.sort((left, right) => timeValue(right.createdAt) - timeValue(left.createdAt)))
      setCounterOffersLoading(false)
      setCounterOffersError('')
    }, () => {
      setCounterOffersLoading(false)
      setCounterOffersError('Your counter-offers could not be loaded. Check your connection and seller access.')
    })
    return unsubscribe
  }, [account?.uid])

  useEffect(() => {
    let active = true
    const accepted = offers.filter((offer) => offer.status === 'accepted' && offer.buyerId)
    Promise.all(accepted.map(async (offer) => {
      try {
        const deal = await getDeal(offer.id)
        return [offer.id, deal.buyer]
      } catch {
        return [offer.id, null]
      }
    })).then((entries) => {
      if (active) setBuyerUsers(Object.fromEntries(entries.filter(([, buyer]) => buyer)))
    })
    return () => { active = false }
  }, [offers])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  const productTags = Array.isArray(sellerProfile.productTags) ? sellerProfile.productTags : []
  const eligibleRequirements = requirements.map((requirement) => ({
    ...requirement,
    matchedTag: matchingProductTag(requirement, productTags),
  })).filter((requirement) => (
    requirement.status === 'open'
    && !isPastDeadline(requirement, now)
    && sellerProfile.categories.includes(requirement.category)
    && (showAllRequirements || productTags.length === 0 || requirement.matchedTag)
    && (categoryFilter === 'all' || requirement.category === categoryFilter)
    && (maxBudget === '' || requirement.budget <= Number(maxBudget))
  )).sort((left, right) => timeValue(right.createdAt) - timeValue(left.createdAt))

  const offerByRequirement = new Map(offers.map((offer) => [offer.requirementId, offer]))
  const offerById = new Map(offers.map((offer) => [offer.id, offer]))
  const pendingCounterCount = counterOffers.filter((counter) => counter.status === 'pending').length
  const openRequirementIds = new Set(requirements
    .filter((requirement) => requirement.status === 'open' && !isPastDeadline(requirement, now))
    .map((requirement) => requirement.id))

  async function submitNewOffer(requirement, values) {
    await createSellerOffer(requirement, values)
    setActiveRequirementId('')
    setActionError('')
  }

  async function saveOffer(offer, values) {
    setOfferBusyId(offer.id)
    setActionError('')
    try {
      await updateSellerOffer(offer.id, values)
      setEditingOfferId('')
    } catch (error) {
      setActionError(error.code === 'permission-denied'
        ? 'This offer can no longer be changed. The requirement may have closed or your seller approval may have changed.'
        : 'This offer could not be updated. Check your connection and try again.')
      throw error
    } finally {
      setOfferBusyId('')
    }
  }

  async function withdrawOffer(offer) {
    if (!window.confirm(`Withdraw your offer for "${offer.requirementTitle}"?`)) return
    setOfferBusyId(offer.id)
    setActionError('')
    try {
      await withdrawSellerOffer(offer.id)
    } catch {
      setActionError('This offer could not be withdrawn. It may already be closed or withdrawn.')
    } finally {
      setOfferBusyId('')
    }
  }

  async function decideCounterOffer(counterOffer, decision) {
    setOfferBusyId(counterOffer.id)
    setActionError('')
    try {
      await respondToCounterOffer(counterOffer.id, decision)
    } catch (error) {
      setActionError(error.message === 'REQUIREMENT_CLOSED'
        ? 'This requirement is no longer open, so the counter-offer cannot be answered.'
        : 'The counter-offer response could not be saved. Check your connection and seller approval.')
    } finally {
      setOfferBusyId('')
    }
  }

  return (
    <section className="seller-marketplace" aria-label="Seller marketplace">
      <div className="seller-tabs" role="group" aria-label="Seller workspace views">
        <button aria-pressed={view === 'requirements'} className="seller-tab" onClick={() => setView('requirements')} type="button">Open requirements</button>
        <button aria-pressed={view === 'offers'} className="seller-tab" onClick={() => setView('offers')} type="button">My offers <span>{offers.length}</span></button>
        <button aria-pressed={view === 'counters'} className="seller-tab" onClick={() => setView('counters')} type="button">Counter offers <span>{pendingCounterCount}</span></button>
      </div>

      {actionError ? <div className="form-alert" role="alert">{actionError}</div> : null}

      {view === 'requirements' ? (
        <div className="seller-requirements-view">
          <div className="seller-board-heading">
            <div>
              <h2>Requirements in your categories</h2>
              <p>Open requests in your approved categories, matched to your products where tags are available.</p>
            </div>
            <div className="requirement-result-count">{eligibleRequirements.length} matching</div>
          </div>

          <div className="seller-filters" aria-label="Filter requirements">
            <label className="seller-all-requirements-toggle">
              <input checked={showAllRequirements} onChange={(event) => setShowAllRequirements(event.target.checked)} type="checkbox" />
              <span>Show all requirements in my categories</span>
            </label>
            <label>
              <span>Category</span>
              <select aria-label="Filter by category" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
                <option value="all">All my categories</option>
                {sellerProfile.categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              <span>Maximum budget (Rs)</span>
              <input aria-label="Maximum budget" inputMode="decimal" min="0" onChange={(event) => setMaxBudget(event.target.value)} placeholder="No limit" step="0.01" type="number" value={maxBudget} />
            </label>
          </div>

          {requirementsLoading ? <div className="status-panel" role="status">Loading open requirements...</div> : null}
          {!requirementsLoading && requirementsError ? <div className="status-panel status-error" role="alert">{requirementsError}</div> : null}
          {!requirementsLoading && !requirementsError && eligibleRequirements.length === 0 ? (
            <div className="seller-empty-state" role="status">
              <h3>No matching open requirements.</h3>
              <p>New requests that match your categories and budget filters will appear here.</p>
            </div>
          ) : null}

          {!requirementsLoading && !requirementsError && eligibleRequirements.length > 0 ? (
            <div className="seller-requirement-list">
              {eligibleRequirements.map((requirement) => {
                const existingOffer = offerByRequirement.get(requirement.id)
                return (
                  <article className="seller-requirement-card" key={requirement.id}>
                    <div className="seller-requirement-topline">
                      <span>{requirement.category}</span>
                      <span className="requirement-status status-open">Open</span>
                    </div>
                    <h3>{requirement.title}</h3>
                    {requirement.matchedTag ? <span className="product-match-label">Matches your products: <strong>{requirement.matchedTag}</strong></span> : null}
                    {requirement.details ? <p className="seller-offer-description">{requirement.details}</p> : null}
                    <div className="seller-requirement-facts">
                      <div><span>Buyer budget</span><strong>Rs {formatBudget(requirement.budget)}</strong></div>
                      <div><span>Needed within</span><strong>{requirement.deadlineDays} days · {dateLabel(requirement.expiresAt)}</strong></div>
                      <div><span>Keywords</span><strong>{requirement.keywords?.length ? requirement.keywords.join(', ') : 'None added'}</strong></div>
                    </div>
                    {existingOffer ? (
                      <div className="offer-existing-note">
                        <span>You responded · Rs {formatBudget(existingOffer.price)}</span>
                        {existingOffer.status === 'active' ? <button className="text-button" onClick={() => setView('offers')} type="button">Open in My offers</button> : null}
                      </div>
                    ) : activeRequirementId === requirement.id ? (
                      <div className="seller-offer-composer">
                        <OfferForm requirement={requirement} noteLabel="Note" submitLabel="Send response" onCancel={() => setActiveRequirementId('')} onSubmit={(values) => submitNewOffer(requirement, values)} />
                      </div>
                    ) : (
                      <div className="seller-requirement-actions">
                        <button className="button-primary seller-offer-button" onClick={() => { setActionError(''); setActiveRequirementId(requirement.id) }} type="button">I can supply this</button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : view === 'offers' ? (
        <div className="seller-offers-view">
          <div className="seller-board-heading">
            <div>
              <h2>My offers</h2>
              <p>Track your submissions and update active offers while the requirement is open.</p>
            </div>
          </div>
          {offersLoading ? <div className="status-panel" role="status">Loading your offers...</div> : null}
          {!offersLoading && offersError ? <div className="status-panel status-error" role="alert">{offersError}</div> : null}
          {!offersLoading && !offersError && offers.length === 0 ? (
            <div className="seller-empty-state" role="status">
              <h3>No offers submitted yet.</h3>
              <p>Find an open request that matches your categories and make your first offer.</p>
              <button className="button-primary seller-offer-button" onClick={() => setView('requirements')} type="button">Browse requirements</button>
            </div>
          ) : null}
          {!offersLoading && !offersError && offers.length > 0 ? (
            <div className="seller-offer-list">
              {offers.map((offer) => {
                const canManageOffer = offer.status === 'active' && openRequirementIds.has(offer.requirementId)
                const status = offerStatus(offer)
                return (
                  <article className="seller-offer-card" key={offer.id}>
                    <div className="seller-requirement-topline">
                      <span>{offer.requirementCategory || 'Requirement'}</span>
                      <span className={`requirement-status status-${status.key}`}>{status.label}</span>
                    </div>
                    <h3>{offer.requirementTitle}</h3>
                    <div className="seller-offer-facts">
                      <div><span>Your price</span><strong>Rs {formatBudget(offer.price)}</strong></div>
                      <div><span>Delivery</span><strong>{offer.deliveryDays} days</strong></div>
                    </div>
                    <p className="seller-offer-description">{offer.description}</p>
                    {offer.status === 'accepted' && buyerUsers[offer.id] ? (
                      <div className="accepted-buyer-contact">
                        <strong>Buyer contact</strong>
                        <span>{buyerUsers[offer.id].name}</span>
                        <a href={`mailto:${buyerUsers[offer.id].email}`}>{buyerUsers[offer.id].email}</a>
                        <span>{buyerUsers[offer.id].phone || 'Phone not provided'}</span>
                      </div>
                    ) : null}
                    {offer.status === 'accepted' ? (
                      <Link className="deal-confirmed-link" to={`/deal/${offer.id}`}>Deal confirmed · Contact details</Link>
                    ) : null}
                    {editingOfferId === offer.id && canManageOffer ? (
                      <div className="seller-offer-composer">
                        <OfferForm
                          initialValue={offer}
                          requirement={{ id: offer.requirementId, title: offer.requirementTitle }}
                          submitLabel="Save offer"
                          onCancel={() => setEditingOfferId('')}
                          onSubmit={(values) => saveOffer(offer, values)}
                        />
                      </div>
                    ) : null}
                    {canManageOffer && editingOfferId !== offer.id ? (
                      <div className="seller-requirement-actions">
                        <button className="text-button" disabled={offerBusyId === offer.id} onClick={() => setEditingOfferId(offer.id)} type="button">Edit offer</button>
                        <button className="text-button cancel-requirement" disabled={offerBusyId === offer.id} onClick={() => withdrawOffer(offer)} type="button">{offerBusyId === offer.id ? 'Saving...' : 'Withdraw'}</button>
                      </div>
                    ) : null}
                    {offer.status === 'active' && !canManageOffer ? (
                      <p className="offer-closed-note">This requirement is closed or past its deadline; this offer is read-only.</p>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="seller-counter-view">
          <div className="seller-board-heading">
            <div>
              <h2>Counter offers</h2>
              <p>Buyers can counter shortlisted offers. Accepting updates your active offer price.</p>
            </div>
          </div>
          {counterOffersLoading ? <div className="status-panel" role="status">Loading counter-offers...</div> : null}
          {!counterOffersLoading && counterOffersError ? <div className="status-panel status-error" role="alert">{counterOffersError}</div> : null}
          {!offersLoading && offersError ? <div className="status-panel status-error" role="alert">Offer state could not be verified for counter responses.</div> : null}
          {!requirementsLoading && requirementsError ? <div className="status-panel status-error" role="alert">Requirement state could not be verified for counter responses.</div> : null}
          {!counterOffersLoading && !counterOffersError && counterOffers.length === 0 ? (
            <div className="seller-empty-state" role="status">
              <h3>No counter-offers yet.</h3>
              <p>Buyer proposals for your shortlisted offers will appear here.</p>
            </div>
          ) : null}
          {!counterOffersLoading && !counterOffersError && counterOffers.length > 0 ? (
            <div className="seller-offer-list">
              {counterOffers.map((counterOffer) => {
                const currentOffer = offerById.get(counterOffer.offerId)
                const counterContextLoading = offersLoading || requirementsLoading
                const canRespond = counterOffer.status === 'pending'
                  && currentOffer?.status === 'active'
                  && !offersLoading
                  && !offersError
                  && !requirementsLoading
                  && !requirementsError
                  && openRequirementIds.has(counterOffer.requirementId)
                return (
                  <article className="counter-offer-card" key={counterOffer.id}>
                    <div className="seller-requirement-topline">
                      <span>Buyer proposal</span>
                      <span className={`requirement-status status-${counterOffer.status}`}>{counterOffer.status}</span>
                    </div>
                    <h3>{counterOffer.requirementTitle}</h3>
                    <div className="seller-offer-facts">
                      <div><span>Your offer</span><strong>Rs {formatBudget(currentOffer?.price ?? counterOffer.proposedPrice)}</strong></div>
                      <div><span>Buyer proposes</span><strong>Rs {formatBudget(counterOffer.proposedPrice)}</strong></div>
                    </div>
                    {counterOffer.status === 'pending' && counterContextLoading ? (
                      <p className="form-help" role="status">Checking requirement status...</p>
                    ) : counterOffer.status === 'pending' && (offersError || requirementsError) ? null
                    : canRespond ? (
                      <div className="counter-response-actions">
                        <button className="review-button approve-action" disabled={offerBusyId === counterOffer.id} onClick={() => decideCounterOffer(counterOffer, 'accepted')} type="button">
                          {offerBusyId === counterOffer.id ? 'Saving...' : 'Accept price'}
                        </button>
                        <button className="review-button reject-action" disabled={offerBusyId === counterOffer.id} onClick={() => decideCounterOffer(counterOffer, 'declined')} type="button">
                          {offerBusyId === counterOffer.id ? 'Saving...' : 'Decline'}
                        </button>
                      </div>
                    ) : counterOffer.status === 'pending' ? (
                      <p className="offer-closed-note">This counter-offer can no longer be answered.</p>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : null}
        </div>
      )}
      <p className="seller-profile-footnote">Your business categories: {sellerProfile.categories.join(', ') || 'None listed'}</p>
    </section>
  )
}
