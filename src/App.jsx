import { useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/useAuth.js'
import AdminQueuePage from './pages/AdminQueuePage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import BuyerDashboard from './pages/BuyerDashboard.jsx'
import BuyerComparisonPage from './pages/BuyerComparisonPage.jsx'
import DealConfirmedPage from './pages/DealConfirmedPage.jsx'
import HomePage from './pages/HomePage.jsx'
import SellerDashboard from './pages/SellerDashboard.jsx'

function dashboardPath(role) {
  return role === 'admin' ? '/admin' : role === 'seller' ? '/seller' : '/buyer'
}

function LoadingState() {
  return <div className="status-panel" role="status">Loading your account...</div>
}

function RoleRoute({ role, children }) {
  const { account, loading, authError } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState />
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (authError || !account) {
    return <div className="status-panel status-error" role="alert">{authError || 'Your account profile could not be loaded.'}</div>
  }
  if (account.role !== role) return <Navigate to={dashboardPath(account.role)} replace />
  return children
}

function PublicRoute({ children }) {
  const { account, loading } = useAuth()
  if (loading) return <LoadingState />
  if (account) return <Navigate to={dashboardPath(account.role)} replace />
  return children
}

function ParticipantRoute({ children }) {
  const { account, loading } = useAuth()
  if (loading) return <LoadingState />
  if (!account) return <Navigate to="/login" replace />
  if (!account || !['buyer', 'seller'].includes(account.role)) return <Navigate to={dashboardPath(account?.role)} replace />
  return children
}

function Navbar() {
  const { account, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
  }

  return (
    <header className="site-header">
      <nav className="navbar" aria-label="Main navigation">
        <Link className="brand" to="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>Reverse<span className="brand-accent">Market</span></span>
        </Link>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className={`menu-toggle${menuOpen ? ' is-open' : ''}`}
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <div className={`nav-links${menuOpen ? ' nav-links-open' : ''}`}>
          <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
          {account ? (
            <>
              <Link to={dashboardPath(account.role)} onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <button className="nav-signout" onClick={handleSignOut} type="button">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
              <Link className="nav-cta" to="/signup" onClick={() => setMenuOpen(false)}>Create account</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<PublicRoute><AuthPage mode="login" /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><AuthPage mode="signup" /></PublicRoute>} />
          <Route path="/buyer" element={<RoleRoute role="buyer"><BuyerDashboard /></RoleRoute>} />
          <Route path="/buyer/requirements/:requirementId/offers" element={<RoleRoute role="buyer"><BuyerComparisonPage /></RoleRoute>} />
          <Route path="/deal/:offerId" element={<ParticipantRoute><DealConfirmedPage /></ParticipantRoute>} />
          <Route path="/seller/reapply" element={<RoleRoute role="seller"><AuthPage mode="reapply" /></RoleRoute>} />
          <Route path="/seller" element={<RoleRoute role="seller"><SellerDashboard /></RoleRoute>} />
          <Route path="/admin" element={<RoleRoute role="admin"><AdminQueuePage /></RoleRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <span>ReverseMarket</span>
        <span>Better buying starts with a clear need.</span>
      </footer>
    </div>
  )
}

export default App
