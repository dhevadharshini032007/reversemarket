import { useEffect, useState } from 'react'
import { resetDemoData, update, watch } from '../lib/db.js'

export default function AdminQueuePage() {
  const [sellers, setSellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyUid, setBusyUid] = useState('')
  const [rejectingUid, setRejectingUid] = useState('')
  const [reasons, setReasons] = useState({})

  useEffect(() => {
    let active = true

    const loadPendingSellers = async (profiles) => {
      try {
        const pending = profiles.filter((profile) => profile.status === 'pending' || profile.reapplicationPending)
        const rows = await Promise.all(pending.map(async (profile) => {
          const user = profile.user || {}
          return { ...profile, isReapplication: Boolean(profile.reapplicationPending), name: user.name || profile.businessName, email: user.email || '', phone: user.phone || '' }
        }))
        if (active) setSellers(rows)
      } catch {
        if (active) setLoadError('The pending seller queue could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }
    const unsubscribe = watch('sellerProfiles', loadPendingSellers)
    return () => { active = false; unsubscribe() }
  }, [])

  async function approveSeller(seller) {
    setBusyUid(seller.uid)
    setActionError('')
    try {
      await update('sellerProfiles', seller.uid, { status: 'approved', rejectionReason: '', reapplicationPending: false })
      setSellers((current) => current.filter((entry) => entry.uid !== seller.uid))
    } catch {
      setActionError('Approval could not be saved. Check admin permissions and try again.')
    } finally {
      setBusyUid('')
    }
  }

  async function rejectSeller(seller) {
    const reason = reasons[seller.uid]?.trim() || ''
    if (!reason) {
      setActionError('Add a rejection reason before rejecting this application.')
      return
    }

    setBusyUid(seller.uid)
    setActionError('')
    try {
      await update('sellerProfiles', seller.uid, { status: 'rejected', rejectionReason: reason, reapplicationPending: false })
      setSellers((current) => current.filter((entry) => entry.uid !== seller.uid))
      setRejectingUid('')
    } catch {
      setActionError('Rejection could not be saved. Check admin permissions and try again.')
    } finally {
      setBusyUid('')
    }
  }

  async function handleResetDemoData() {
    if (!window.confirm('Restore the original demo users, requirements, and offers? Current local demo data will be replaced.')) return
    await resetDemoData()
    setActionError('')
    setRejectingUid('')
  }

  return (
    <div className="placeholder-wrap admin-wrap">
      <section className="admin-content">
        <p className="eyebrow">Administration</p>
        <div className="admin-heading">
          <div>
            <h1>Seller applications</h1>
            <p>Review the business details and verification ID before making a decision.</p>
          </div>
          <span className="queue-count" aria-label={`${sellers.length} pending applications`}>{sellers.length} pending</span>
          <button className="review-button secondary-action" onClick={handleResetDemoData} type="button">Reset demo data</button>
        </div>

        {actionError ? <div className="form-alert" role="alert">{actionError}</div> : null}
        {loading ? <div className="status-panel" role="status">Loading pending applications...</div> : null}
        {!loading && loadError ? <div className="status-panel status-error" role="alert">{loadError}</div> : null}
        {!loading && !loadError && sellers.length === 0 ? (
          <div className="status-panel empty-queue" role="status">
            <h2>All caught up.</h2>
            <p>There are no pending seller applications to review.</p>
          </div>
        ) : null}

        {!loading && !loadError && sellers.length > 0 ? (
          <div className="review-list">
            {sellers.map((seller) => (
              <article className="review-item" key={seller.uid}>
                <div className="review-title-row">
                  <div>
                    <h2>{seller.businessName}</h2>
                    <p>{seller.name} · {seller.sellerType}</p>
                  </div>
                  <span className="account-status">{seller.isReapplication ? 'Re-application' : 'Pending'}</span>
                </div>
                {seller.isReapplication && seller.rejectionReason ? (
                  <p className="form-help">Previous review note: {seller.rejectionReason}</p>
                ) : null}
                <dl className="seller-details">
                  <div><dt>Email</dt><dd>{seller.email || 'Not provided'}</dd></div>
                  <div><dt>Phone</dt><dd>{seller.phone || 'Not provided'}</dd></div>
                  <div><dt>Location</dt><dd>{seller.location}</dd></div>
                  <div><dt>Categories</dt><dd>{seller.categories?.join(', ') || 'None listed'}</dd></div>
                  <div><dt>Products</dt><dd>{seller.productTags?.join(', ') || 'No product tags'}</dd></div>
                  <div><dt>Verification ID</dt><dd>{seller.idType}: {seller.idNumber}</dd></div>
                  <div className="details-description"><dt>Business description</dt><dd>{seller.description}</dd></div>
                </dl>
                {rejectingUid === seller.uid ? (
                  <div className="reject-form">
                    <label htmlFor={`reason-${seller.uid}`}>Reason for rejection</label>
                    <textarea
                      id={`reason-${seller.uid}`}
                      onChange={(event) => setReasons((current) => ({ ...current, [seller.uid]: event.target.value }))}
                      placeholder="Explain what needs to be corrected."
                      rows={3}
                      value={reasons[seller.uid] || ''}
                    />
                    <div className="review-actions">
                      <button className="review-button secondary-action" disabled={busyUid === seller.uid} onClick={() => setRejectingUid('')} type="button">Cancel</button>
                      <button className="review-button reject-action" disabled={busyUid === seller.uid} onClick={() => rejectSeller(seller)} type="button">
                        {busyUid === seller.uid ? 'Saving...' : 'Confirm rejection'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="review-actions">
                      <button className="review-button approve-action" disabled={busyUid === seller.uid} onClick={() => approveSeller(seller)} type="button">
                      {busyUid === seller.uid ? 'Saving...' : 'Approve seller'}
                    </button>
                      <button className="review-button reject-action" disabled={busyUid === seller.uid} onClick={() => { setActionError(''); setRejectingUid(seller.uid) }} type="button">Reject</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
