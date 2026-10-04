import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import SellerMarketplace from './SellerMarketplace.jsx'

export default function SellerDashboard() {
  const { account, sellerProfile, sellerReapplicationPending } = useAuth()
  const status = sellerProfile?.status || 'pending'

  return (
    <div className="placeholder-wrap">
      <section className="seller-dashboard">
        <p className="eyebrow">Seller workspace</p>
        <div className="seller-heading">
          <div>
            <h1>{sellerProfile?.businessName || 'Your seller account'}</h1>
            <p className="seller-account-line">Signed in as {account?.name} · {account?.email}</p>
            {sellerProfile?.productTags?.length ? <p className="seller-product-tags">Products you sell: {sellerProfile.productTags.join(', ')}</p> : null}
          </div>
          {status === 'approved' ? <VerifiedBadge /> : null}
        </div>

        {status === 'pending' ? (
          <div className="seller-status-panel pending-panel" role="status">
            <span className="status-kicker">Application pending</span>
            <h2>Your details are with our review team.</h2>
            <p>You can sign in while your seller application is being reviewed. Seller tools will become available after approval.</p>
          </div>
        ) : null}

        {status === 'approved' ? (
          <SellerMarketplace sellerProfile={sellerProfile} />
        ) : null}

        {status === 'rejected' && sellerReapplicationPending ? (
          <div className="seller-status-panel pending-panel" role="status">
            <span className="status-kicker">Re-application pending</span>
            <h2>Your updated details are back with our review team.</h2>
            <p>Your updated details are submitted. Seller access remains unavailable until the review is complete.</p>
          </div>
        ) : null}

        {status === 'rejected' && !sellerReapplicationPending ? (
          <div className="seller-status-panel rejected-panel">
            <span className="status-kicker">Application needs an update</span>
            <h2>Your application was not approved.</h2>
            <p className="rejection-reason">{sellerProfile?.rejectionReason || 'The review team requested updated details.'}</p>
            <Link className="button-primary reapply-button" to="/seller/reapply">Review details and re-apply</Link>
          </div>
        ) : null}
      </section>
    </div>
  )
}
