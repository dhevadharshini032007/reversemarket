import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RequirementForm from '../components/RequirementForm.jsx'
import { useAuth } from '../context/useAuth.js'
import { parseRequirementSentence } from '../lib/requirementParser.js'
import {
  cancelRequirement,
  createRequirement,
  expireRequirement,
  getRequirementOfferCount,
  getUnreadRequirementOfferCount,
  updateRequirement,
  watchBuyerRequirements,
} from '../lib/requirements.js'

function formatBudget(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeValue(value) { return typeof value?.toMillis === 'function' ? value.toMillis() : Number(value || 0) }

function currentStatus(requirement, now = Date.now()) {
  if (requirement.status === 'open' && timeValue(requirement.expiresAt) <= now) return 'expired'
  return requirement.status
}

export default function BuyerDashboard() {
  const { account } = useAuth()
  const [requirements, setRequirements] = useState([])
  const [offerCounts, setOfferCounts] = useState({})
  const [unreadOfferCounts, setUnreadOfferCounts] = useState({})
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [loadingOfferCounts, setLoadingOfferCounts] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [countError, setCountError] = useState('')
  const [actionError, setActionError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [plainSentence, setPlainSentence] = useState('')
  const [sentenceError, setSentenceError] = useState('')
  const [parsedValues, setParsedValues] = useState(null)
  const [parserRevision, setParserRevision] = useState(0)
  const [editingId, setEditingId] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    if (!account?.uid) return undefined
    let active = true

    const unsubscribe = watchBuyerRequirements(account.uid, (snapshot) => {
      const items = snapshot.docs
        .map((requirementDocument) => requirementDocument.data())
        .sort((left, right) => timeValue(right.createdAt) - timeValue(left.createdAt))
      setRequirements(items)
      setLoading(false)
      setLoadError('')
      setLoadingOfferCounts(true)

      items.forEach((requirement) => {
        if (currentStatus(requirement) === 'expired' && requirement.status === 'open') {
          void expireRequirement(requirement.id).catch(() => {
            if (active) setActionError('A due requirement could not be marked expired.')
          })
        }
      })

      void Promise.all(items.map(async (requirement) => ({
        id: requirement.id,
        count: await getRequirementOfferCount(requirement.id),
        unread: await getUnreadRequirementOfferCount(requirement.id),
      }))).then((entries) => {
        if (active) {
          setOfferCounts(Object.fromEntries(entries.map(({ id, count }) => [id, count])))
          setUnreadOfferCounts(Object.fromEntries(entries.map(({ id, unread }) => [id, unread])))
          setCountError('')
          setLoadingOfferCounts(false)
        }
      }).catch(() => {
        if (active) {
          setCountError('Offer counts could not be loaded.')
          setLoadingOfferCounts(false)
        }
      })
    }, () => {
      setLoading(false)
      setLoadError('Your requirements could not be loaded.')
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [account?.uid])

  useEffect(() => {
    const nextExpiry = requirements
      .filter((requirement) => requirement.status === 'open' && timeValue(requirement.expiresAt) > clockNow)
      .map((requirement) => timeValue(requirement.expiresAt))
      .sort((left, right) => left - right)[0]

    if (nextExpiry === undefined) return undefined

    const delay = Math.min(Math.max(0, nextExpiry - Date.now()), 2147000000)
    const timeout = window.setTimeout(() => {
      const now = Date.now()
      setClockNow(now)
      const dueItems = requirements.filter((requirement) => (
        requirement.status === 'open' && timeValue(requirement.expiresAt) <= now
      ))
      if (dueItems.length > 0) {
        const dueIds = new Set(dueItems.map((requirement) => requirement.id))
        setRequirements((current) => current.map((requirement) => (
          dueIds.has(requirement.id) ? { ...requirement, status: 'expired' } : requirement
        )))
        dueItems.forEach((requirement) => {
          void expireRequirement(requirement.id).catch(() => {
            setActionError('A due requirement could not be marked expired.')
          })
        })
      }
    }, delay)

    return () => window.clearTimeout(timeout)
  }, [requirements, clockNow])

  async function handleCreate(values) {
    await createRequirement(account.uid, values)
    setFormOpen(false)
    setActionError('')
  }

  function openRequirementComposer() {
    setEditingId('')
    setPlainSentence('')
    setSentenceError('')
    setParsedValues(null)
    setParserRevision(0)
    setFormOpen(true)
  }

  function prefillRequirement() {
    if (!plainSentence.trim()) {
      setSentenceError('Describe what you need before filling the form.')
      return
    }
    setParsedValues(parseRequirementSentence(plainSentence))
    setParserRevision((revision) => revision + 1)
    setSentenceError('')
  }

  async function handleUpdate(requirementId, values) {
    setBusyId(requirementId)
    try {
      await updateRequirement(requirementId, values)
      setEditingId('')
      setActionError('')
    } catch (error) {
      setActionError(error.code === 'permission-denied'
        ? 'This requirement can no longer be edited. It may have expired or been cancelled.'
        : 'The requirement could not be updated. Check your connection and try again.')
    } finally {
      setBusyId('')
    }
  }

  async function handleCancel(requirement) {
    const confirmed = window.confirm(`Cancel "${requirement.title}"? Sellers will no longer be able to respond.`)
    if (!confirmed) return

    setBusyId(requirement.id)
    setActionError('')
    try {
      await cancelRequirement(requirement.id)
    } catch {
      setActionError('This requirement could not be cancelled. It may already be closed or expired.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="buyer-dashboard">
      <div className="buyer-heading">
        <div>
          <p className="eyebrow">Buyer workspace</p>
          <h1>My requirements</h1>
          <p className="buyer-intro">Post what you need, then keep every response in one place.</p>
        </div>
        {!formOpen ? (
          <button className="button-primary new-requirement-button" onClick={openRequirementComposer} type="button">
            <span aria-hidden="true">+</span> Post a requirement
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <section className="requirement-composer" aria-labelledby="composer-title">
          <div className="composer-heading">
            <div>
              <p className="eyebrow">New request</p>
              <h2 id="composer-title">What are you looking for?</h2>
            </div>
            <button className="text-button" onClick={() => setFormOpen(false)} type="button">Close</button>
          </div>
          <div className="sentence-parser">
            <label htmlFor="plain-requirement-sentence">Describe your need in one sentence</label>
            <textarea
              id="plain-requirement-sentence"
              onChange={(event) => { setPlainSentence(event.target.value); setSentenceError('') }}
              placeholder="Need folding chairs for an event under Rs 40,000 within 5 days"
              rows={2}
              value={plainSentence}
            />
            {sentenceError ? <p className="form-error" role="alert">{sentenceError}</p> : null}
            <div className="sentence-parser-actions">
              <button className="review-button secondary-action" onClick={prefillRequirement} type="button">Fill form from sentence</button>
              {parsedValues ? <span role="status">Review the filled fields before posting.</span> : null}
            </div>
          </div>
          <RequirementForm key={parserRevision} initialValue={parsedValues} submitLabel="Post requirement" onSubmit={handleCreate} />
        </section>
      ) : null}

      {actionError ? <div className="form-alert buyer-alert" role="alert">{actionError}</div> : null}
      {countError ? <div className="count-alert" role="status">{countError}</div> : null}

      {loading ? <div className="status-panel" role="status">Loading your requirements...</div> : null}
      {!loading && loadError ? <div className="status-panel status-error" role="alert">{loadError}</div> : null}
      {!loading && !loadError && requirements.length === 0 && !formOpen ? (
        <div className="buyer-empty-state" role="status">
          <span className="empty-mark" aria-hidden="true">R</span>
          <h2>No requirements yet.</h2>
          <p>Post your first request and sellers can respond with offers that fit.</p>
          {!formOpen ? <button className="button-primary" onClick={openRequirementComposer} type="button">Post a requirement</button> : null}
        </div>
      ) : null}

      {!loading && !loadError && requirements.length > 0 ? (
        <section className="requirement-list" aria-label="Your requirements">
          {requirements.map((requirement) => {
            const status = currentStatus(requirement, clockNow)
            const canEdit = status === 'open'
            const offerCount = offerCounts[requirement.id]
            return (
              <article className="requirement-item" key={requirement.id}>
                <div className="requirement-item-heading">
                  <div>
                    <div className="requirement-meta">
                      <span className="requirement-category">{requirement.category}</span>
                      <span className={`requirement-status status-${status}`}>{status}</span>
                    </div>
                    <h2>{requirement.title}</h2>
                  </div>
                  <div className="offer-count" aria-label={loadingOfferCounts ? 'Loading offer count' : `${offerCount ?? 'Unavailable'} offers`}>
                    <strong>{loadingOfferCounts ? '—' : offerCount ?? '!'}</strong>
                    <span>{loadingOfferCounts ? 'loading' : offerCount === 1 ? 'response' : 'responses'}</span>
                    {!loadingOfferCounts && unreadOfferCounts[requirement.id] > 0 ? <span className="new-response-badge">New</span> : null}
                  </div>
                </div>

                <div className="requirement-facts">
                  <div><span>Budget</span><strong>Rs {formatBudget(requirement.budget)}</strong></div>
                  <div><span>Deadline</span><strong>{requirement.deadlineDays} days · {formatDate(requirement.expiresAt)}</strong></div>
                  <div><span>Keywords</span><strong>{requirement.keywords?.length ? requirement.keywords.join(', ') : 'None added'}</strong></div>
                </div>

                {editingId === requirement.id ? (
                  <div className="requirement-edit-panel">
                    <h3>Edit requirement</h3>
                    <RequirementForm
                      key={requirement.id}
                      initialValue={requirement}
                      submitLabel="Save changes"
                      onCancel={() => setEditingId('')}
                      onSubmit={(values) => handleUpdate(requirement.id, values)}
                    />
                  </div>
                ) : null}

                <div className="requirement-actions">
                  {requirement.acceptedOfferId ? (
                    <Link className="text-button deal-confirmed-link" to={`/deal/${requirement.acceptedOfferId}`}>Deal confirmed · Contact details</Link>
                  ) : null}
                  {!requirement.acceptedOfferId && offerCount > 0 ? (
                    <Link className="text-button compare-offers-link" to={`/buyer/requirements/${requirement.id}/offers`}>Compare offers</Link>
                  ) : null}
                  {canEdit ? (
                    <>
                      <button className="text-button" disabled={busyId === requirement.id} onClick={() => { setFormOpen(false); setEditingId(requirement.id) }} type="button">Edit</button>
                      <button className="text-button cancel-requirement" disabled={busyId === requirement.id} onClick={() => handleCancel(requirement)} type="button">
                        {busyId === requirement.id ? 'Saving...' : 'Cancel requirement'}
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            )
          })}
        </section>
      ) : null}
    </div>
  )
}
