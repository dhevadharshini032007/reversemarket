import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { categories } from '../lib/validation.js'

export default function HomePage() {
  const { account } = useAuth()
  if (account) {
    const destination = account.role === 'admin' ? '/admin' : account.role === 'seller' ? '/seller' : '/buyer'
    return <Navigate to={destination} replace />
  }

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">A marketplace that starts with you</p>
          <h1>Say what you need.<br /><span>Let offers come to you.</span></h1>
          <p className="hero-lede">
            ReverseMarket brings buyers and verified local sellers together around clear requirements and thoughtful offers.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" to="/signup">Create an account</Link>
            <Link className="button-secondary" to="/login">Log in</Link>
          </div>
        </div>
        <aside className="hero-note">
          <strong>Need first. Offers next.</strong>
          <p>Post the details that matter and compare offers side by side.</p>
        </aside>
      </section>
      <section className="home-lower" aria-labelledby="category-heading">
        <div>
          <p className="eyebrow">Start with a category</p>
          <h2 id="category-heading">Useful things, services, and everything between.</h2>
          <p>Buyers describe what they need. Sellers respond with an offer that fits.</p>
        </div>
        <div className="category-list" aria-label="Marketplace categories">
          {categories.map((category) => <span key={category}>{category}</span>)}
        </div>
      </section>
    </div>
  )
}
