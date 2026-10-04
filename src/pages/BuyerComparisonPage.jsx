import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CounterOfferForm from '../components/CounterOfferForm.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { useAuth } from '../context/useAuth.js'
import { acceptRequirementOffer, createCounterOffer, markRequirementResponsesSeen, setOfferShortlisted, watchBuyerCounterOffers } from '../lib/offers.js'
import { get } from '../lib/db.js'
import { calculateBudgetAdvice, formatBudgetAdvice } from '../lib/budgetAdvice.js'
import { summarizeTopTradeOff } from '../lib/tradeOffSummary.js'
import { watchBuyerRequirement, watchRequirementOffers } from '../lib/requirements.js'
import { DEFAULT_WEIGHTS, scoreOffers } from '../lib/scoring.js'

const scoreLabels = [
  ['budget', 'Budget fit'],
  ['delivery', 'Delivery fit'],
  ['relevance', 'Keyword relevance'],
]

function formatBudget(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)
}

function timeValue(value) { return typeof value?.toMillis === 'function' ? value.toMillis() : Number(value || 0) }

function ScoreBar({ label, score }) {
  return (
    <div className="score-row">
      <div className="score-label"><span>{label}</span><strong>{score}</strong></div>
      <div className="score-track" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={score}>
        <span className="score-fill" style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function ScoreBadges({ badges }) {
  if (badges.length === 0) return null
  return (
    <div className="score-badges" aria-label="Offer distinctions">
      {badges.map((badge) => (
        <span className={`score-badge badge-${badge.toLowerCase().replace(' ', '-')}`} key={badge}>{badge}</span>
      ))}
    </div>
  )
}

function ComparisonTable({ offers, canChooseOffer, busyOfferId, onToggleShortlist, onAccept }) {
  return (
    <div className="comparison-table-scroll" role="region" aria-label="Side-by-side offer comparison" tabIndex="0">
      <table className="comparison-table">
        <caption>Offer comparison for this requirement</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            {offers.map((offer, index) => (
              <th scope="col" key={offer.id}>
                <span>{offer.sellerProfile?.businessName || `Offer ${index + 1}`}</span>
                {offer.sellerProfile?.status === 'approved' ? <VerifiedBadge /> : null}
                <ScoreBadges badges={offer.badges} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="table-total-row">
            <th scope="row">Total score</th>
            {offers.map((offer) => <td key={offer.id}><strong>{offer.total}</strong><span className="table-out-of"> / 100</span></td>)}
          </tr>
          <tr>
            <th scope="row">Price</th>
            {offers.map((offer) => <td key={offer.id}>Rs {formatBudget(offer.price)}</td>)}
          </tr>
          <tr>
            <th scope="row">Delivery</th>
            {offers.map((offer) => <td key={offer.id}>{offer.deliveryDays} days</td>)}
          </tr>
          {scoreLabels.map(([key, label]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              {offers.map((offer) => <td key={offer.id}>{offer.scores[key]} / 100</td>)}
            </tr>
          ))}
          <tr>
            <th scope="row">Why</th>
            {offers.map((offer) => <td className="table-why" key={offer.id}>{offer.why}</td>)}
          </tr>
          <tr>
            <th scope="row">Offer details</th>
            {offers.map((offer) => <td className="table-description" key={offer.id}>{offer.description}</td>)}
          </tr>
          <tr>
            <th scope="row">Decision</th>
            {offers.map((offer) => (
              <td key={offer.id}>
                {canChooseOffer ? (
                  <div className="table-decision-actions">
                    <button aria-pressed={offer.shortlisted} className="shortlist-button" disabled={Boolean(busyOfferId)} onClick={() => onToggleShortlist(offer)} type="button">
                      {offer.shortlisted ? 'Shortlisted' : 'Shortlist'}
                    </button>
                    <button className="button-primary accept-offer-button" disabled={Boolean(busyOfferId)} onClick={() => onAccept(offer)} type="button">Accept offer</button>
                  </div>
                ) : offer.status === 'accepted' ? 'Accepted' : offer.status}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function BuyerComparisonPage() {
  const { requirementId } = useParams()
  const navigate = useNavigate()
  const { account } = useAuth()
  const [requirement, setRequirement] = useState(null)
  const [offers, setOffers] = useState([])
  const [sellerProfiles, setSellerProfiles] = useState({})
  const [counterOffers, setCounterOffers] = useState([])
  const [counterOffersLoading, setCounterOffersLoading] = useState(true)
  const [counterOffersError, setCounterOffersError] = useState('')
  const [requirementLoading, setRequirementLoading] = useState(true)
  const [offersLoading, setOffersLoading] = useState(true)
  const [requirementError, setRequirementError] = useState('')
  const [offersError, setOffersError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyOfferId, setBusyOfferId] = useState('')
  const [counterFormOfferId, setCounterFormOfferId] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [view, setView] = useState('cards')
  const [weights, setWeights] = useState(() => ({ ...DEFAULT_WEIGHTS, ...account?.offerWeights }))

  useEffect(() => {
    if (!requirementId || !account?.uid) return undefined
    let active = true
    const unsubscribe = watchBuyerRequirement(requirementId, (snapshot) => {
      if (!active) return
      if (!snapshot.exists() || snapshot.data().buyerId !== account.uid) {
        setRequirementError('This requirement could not be found in your buyer account.')
        setRequirement(null)
      } else {
        setRequirement(snapshot.data())
        setRequirementError('')
      }
      setRequirementLoading(false)
    }, () => {
      if (!active) return
      setRequirementError('This requirement could not be loaded. Check your connection and buyer access.')
      setRequirementLoading(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [requirementId, account?.uid])

  useEffect(() => {
    if (!requirementId || !account?.uid) return undefined
    let active = true
    const unsubscribe = watchRequirementOffers(requirementId, (snapshot) => {
      if (!active) return
      setOffers(snapshot.docs.map((offerDocument) => offerDocument.data()))
      void markRequirementResponsesSeen(requirementId, account?.uid)
      setOffersError('')
      setOffersLoading(false)
    }, () => {
      if (!active) return
      setOffersError('Offers could not be loaded. Please try again.')
      setOffersLoading(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [requirementId, account?.uid])

  useEffect(() => {
    let active = true
    const sellerIds = [...new Set(offers.map((offer) => offer.sellerId))]
    Promise.all(sellerIds.map(async (sellerId) => [sellerId, await get('sellerProfiles', sellerId)]))
      .then((entries) => {
        if (active) setSellerProfiles(Object.fromEntries(entries.filter(([, profile]) => profile)))
      })
    return () => { active = false }
  }, [offers])

  useEffect(() => {
    if (!requirementId || !account?.uid) return undefined
    let active = true
    const unsubscribe = watchBuyerCounterOffers(requirementId, account.uid, (snapshot) => {
      if (!active) return
      setCounterOffers(snapshot.docs.map((counterDocument) => counterDocument.data()))
      setCounterOffersLoading(false)
      setCounterOffersError('')
    }, () => {
      if (active) {
        setCounterOffersLoading(false)
        setCounterOffersError('Counter-offer status could not be refreshed.')
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [requirementId, account?.uid])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  const rankedOffers = scoreOffers(offers, requirement || {}, weights)
    .map((offer) => ({ ...offer, sellerProfile: sellerProfiles[offer.sellerId] }))
  const budgetAdvice = calculateBudgetAdvice(requirement?.budget, offers)
  const tradeOffSummary = summarizeTopTradeOff(rankedOffers)
  const allWeightsZero = Object.values(weights).every((weight) => Number(weight) === 0)
  const canChooseOffer = requirement?.status === 'open'
    && timeValue(requirement.expiresAt) > now
  const canCreateCounter = canChooseOffer && !counterOffersLoading && !counterOffersError

  async function toggleShortlist(offer) {
    setBusyOfferId(offer.id)
    setActionError('')
    try {
      await setOfferShortlisted(offer.id, !offer.shortlisted)
    } catch {
      setActionError('This offer could not be updated. The requirement may have closed or your access may have changed.')
    } finally {
      setBusyOfferId('')
    }
  }

  async function submitCounterOffer(offer, proposedPrice) {
    setBusyOfferId(offer.id)
    setActionError('')
    try {
      await createCounterOffer(offer.id, proposedPrice)
      setCounterFormOfferId('')
    } catch (error) {
      setActionError(error.message === 'COUNTER_ALREADY_PENDING'
        ? 'A counter-offer is already pending for this offer.'
        : 'This counter-offer could not be sent. Confirm the offer is shortlisted and the requirement remains open.')
      throw error
    } finally {
      setBusyOfferId('')
    }
  }

  async function acceptOffer(offer) {
    if (!window.confirm(`Accept Offer ${rankedOffers.findIndex((item) => item.id === offer.id) + 1}? This will close the requirement and mark every other offer not chosen.`)) return
    setBusyOfferId(offer.id)
    setActionError('')
    try {
      await acceptRequirementOffer(requirementId, offer.id)
      navigate(`/deal/${offer.id}`, { replace: true })
    } catch (error) {
      const message = error.message === 'OFFERS_CHANGED'
        ? 'A new offer arrived during acceptance. Refresh the comparison and try again.'
        : error.message === 'COUNTER_OFFER_PENDING'
          ? 'Wait for the seller to answer this counter-offer before accepting the original offer.'
        : error.message === 'REQUIREMENT_CLOSED' || error.message === 'OFFER_UNAVAILABLE'
          ? 'This offer or requirement is no longer available for acceptance.'
          : 'The offer could not be accepted. Please try again.'
      setActionError(message)
    } finally {
      setBusyOfferId('')
    }
  }

  return (
    <div className="comparison-page">
      <Link className="comparison-back-link" to="/buyer">&larr; My requirements</Link>
      {requirementLoading ? <div className="status-panel" role="status">Loading requirement...</div> : null}
      {!requirementLoading && requirementError ? <div className="status-panel status-error" role="alert">{requirementError}</div> : null}
      {!requirementLoading && !requirementError && requirement ? (
        <>
          <header className="comparison-heading">
            <div>
              <p className="eyebrow">{requirement.category}</p>
              <h1>{requirement.title}</h1>
              <div className="comparison-requirement-meta">
                <span>Budget: Rs {formatBudget(requirement.budget)}</span>
                <span>Deadline: {requirement.deadlineDays} days</span>
                <span>{requirement.keywords?.length ? `Keywords: ${requirement.keywords.join(', ')}` : 'No keywords'}</span>
              </div>
              {requirement.details ? <p className="comparison-requirement-details">{requirement.details}</p> : null}
            </div>
            <span className={`requirement-status status-${requirement.status}`}>{requirement.status}</span>
          </header>

          {offersLoading ? <div className="status-panel" role="status">Loading offers...</div> : null}
          {!offersLoading && offersError ? <div className="status-panel status-error" role="alert">{offersError}</div> : null}
          {actionError ? <div className="form-alert" role="alert">{actionError}</div> : null}
          {counterOffersLoading ? <p className="form-help" role="status">Checking counter-offer status...</p> : null}
          {counterOffersError ? <div className="count-alert" role="status">{counterOffersError}</div> : null}
          {budgetAdvice ? (
            <aside className="budget-advice" aria-label="Budget advice">
              <span>Budget advice</span>
              <p>{formatBudgetAdvice(budgetAdvice)}</p>
              <small>Based on {offers.length} active offer{offers.length === 1 ? '' : 's'}.</small>
            </aside>
          ) : null}
          {tradeOffSummary ? (
            <aside className="tradeoff-summary" aria-label="Top offer trade-off">
              <span>Top-offer trade-off</span>
              <p>{tradeOffSummary}</p>
            </aside>
          ) : null}
          {!canChooseOffer && requirement.acceptedOfferId ? (
            <div className="deal-confirmed-banner">
              <span>Deal confirmed</span>
              <Link to={`/deal/${requirement.acceptedOfferId}`}>View contact details</Link>
            </div>
          ) : null}
          {!offersLoading && !offersError && rankedOffers.length === 0 ? (
            <div className="comparison-empty" role="status">
              <h2>No active offers yet.</h2>
              <p>Offers will appear here as sellers respond to this requirement.</p>
            </div>
          ) : null}
          {!offersLoading && !offersError && rankedOffers.length > 0 ? (
            <>
              <div className="comparison-toolbar">
                <div>
                  <p className="eyebrow">Ranked comparison</p>
                  <h2>{rankedOffers.length} {rankedOffers.length === 1 ? 'offer' : 'offers'}</h2>
                </div>
                <div className="comparison-view-switch" role="group" aria-label="Comparison layout">
                  <button aria-pressed={view === 'cards'} onClick={() => setView('cards')} type="button">Cards</button>
                  <button aria-pressed={view === 'table'} onClick={() => setView('table')} type="button">Side-by-side</button>
                </div>
              </div>
              <section className="priority-controls" aria-label="Live ranking priorities">
                <div className="priority-heading">
                  <div>
                    <span className="eyebrow">Live ranking</span>
                    <h3>Set your priorities</h3>
                  </div>
                  <span className="priority-total">Weights {weights.budget}:{weights.delivery}:{weights.relevance}</span>
                </div>
                <div className="priority-sliders">
                  {[
                    ['budget', 'Budget'],
                    ['delivery', 'Delivery'],
                    ['relevance', 'Relevance'],
                  ].map(([key, label]) => (
                    <label className="priority-slider" htmlFor={`priority-${key}`} key={key}>
                      <span>{label}<strong>{weights[key]}</strong></span>
                      <input
                        aria-label={`${label} priority`}
                        id={`priority-${key}`}
                        max="10"
                        min="0"
                        name={key}
                        onChange={(event) => setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))}
                        step="1"
                        type="range"
                        value={weights[key]}
                      />
                    </label>
                  ))}
                </div>
                {allWeightsZero ? <p className="priority-fallback" role="status">All priorities are zero, so default weights are being used.</p> : null}
              </section>
              {view === 'cards' ? (
                <section className="ranked-offer-list" aria-label="Ranked offers">
                  {rankedOffers.map((offer, index) => {
                    const pendingCounter = counterOffers.find((counter) => counter.offerId === offer.id && counter.status === 'pending')
                    return (
                      <article className="ranked-offer-card" key={offer.id}>
                      <div className="ranked-offer-header">
                        <div className="rank-number" aria-label={`Rank ${index + 1}`}>{String(index + 1).padStart(2, '0')}</div>
                        <div className="ranked-offer-title">
                          <span>Seller response</span>
                          <h3>{offer.sellerProfile?.businessName || `Offer ${index + 1}`}</h3>
                          {offer.sellerProfile?.status === 'approved' ? <VerifiedBadge /> : null}
                        </div>
                        <div className="total-score"><strong>{Math.round(offer.total)}</strong><span>match / 100</span></div>
                      </div>
                      <ScoreBadges badges={offer.badges} />
                      <div className="ranked-offer-price-row">
                        <div><span>Price</span><strong>Rs {formatBudget(offer.price)}</strong></div>
                        <div><span>Delivery</span><strong>{offer.deliveryDays} days</strong></div>
                      </div>
                      <p className="offer-why">{offer.why}</p>
                      <div className="score-breakdown">
                        {scoreLabels.map(([key, label]) => <ScoreBar key={key} label={label} score={offer.scores[key]} />)}
                      </div>
                      <p className="ranked-offer-description">{offer.description}</p>
                      {canChooseOffer ? (
                        <div className="comparison-offer-actions">
                          <button
                            aria-pressed={offer.shortlisted}
                            className="shortlist-button"
                            disabled={Boolean(busyOfferId)}
                            onClick={() => toggleShortlist(offer)}
                            type="button"
                          >
                            {offer.shortlisted ? 'Shortlisted' : 'Shortlist'}
                          </button>
                          <button className="button-primary accept-offer-button" disabled={Boolean(busyOfferId)} onClick={() => acceptOffer(offer)} type="button">
                            {busyOfferId === offer.id ? 'Saving...' : 'Accept offer'}
                          </button>
                        </div>
                      ) : null}
                      {canCreateCounter && offer.shortlisted ? (
                        <div className="counter-offer-area">
                          {pendingCounter ? (
                            <p className="counter-pending-note">
                              Counter-offer pending: Rs {formatBudget(pendingCounter.proposedPrice)}
                            </p>
                          ) : counterFormOfferId === offer.id ? (
                            <CounterOfferForm
                              onCancel={() => setCounterFormOfferId('')}
                              onSubmit={(price) => submitCounterOffer(offer, price)}
                            />
                          ) : (
                            <button className="text-button counter-start-button" disabled={Boolean(busyOfferId)} onClick={() => setCounterFormOfferId(offer.id)} type="button">Make counter-offer</button>
                          )}
                        </div>
                      ) : null}
                      </article>
                    )
                  })}
                </section>
              ) : (
                <ComparisonTable
                  offers={rankedOffers}
                  canChooseOffer={canChooseOffer}
                  busyOfferId={busyOfferId}
                  onToggleShortlist={toggleShortlist}
                  onAccept={acceptOffer}
                />
              )}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
