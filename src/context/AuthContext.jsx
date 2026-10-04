import { useEffect, useState } from 'react'
import AuthContext from './AuthContext.js'
import { clearSession, getSessionUser, initializeDb, watch, watchSession } from '../lib/db.js'
import { get } from '../lib/db.js'

function withoutPassword(user) {
  if (!user) return null
  const account = { ...user }
  delete account.passwordHash
  delete account.passwordSalt
  return account
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ account: null, sellerProfile: null, sellerReapplicationPending: false, loading: true, authError: '' })

  useEffect(() => {
    let active = true
    const refresh = async (user) => {
      if (!active) return
      if (!user) {
        setSession({ account: null, sellerProfile: null, sellerReapplicationPending: false, loading: false, authError: '' })
        return
      }
      const sellerProfile = user.role === 'seller' ? await get('sellerProfiles', user.uid) : null
      if (!active) return
      setSession({
        account: withoutPassword(user),
        sellerProfile,
        sellerReapplicationPending: Boolean(sellerProfile?.reapplicationPending),
        loading: false,
        authError: '',
      })
    }
    initializeDb().then(getSessionUser).then(refresh).catch(() => {
      if (active) setSession({ account: null, sellerProfile: null, sellerReapplicationPending: false, loading: false, authError: 'Your local account could not be loaded.' })
    })
    const unsubscribe = watchSession(refresh)
    const unsubscribeProfiles = watch('sellerProfiles', () => { void getSessionUser().then(refresh) })
    const unsubscribeUsers = watch('users', () => { void getSessionUser().then(refresh) })
    return () => { active = false; unsubscribe(); unsubscribeProfiles(); unsubscribeUsers() }
  }, [])

  async function refreshAccount(user) {
    const current = user || await getSessionUser()
    if (!current) return
    const sellerProfile = current.role === 'seller' ? await get('sellerProfiles', current.uid) : null
    setSession({ account: withoutPassword(current), sellerProfile, sellerReapplicationPending: Boolean(sellerProfile?.reapplicationPending), loading: false, authError: '' })
  }

  async function signOut() {
    clearSession()
  }

  return <AuthContext.Provider value={{ ...session, refreshAccount, signOut }}>{children}</AuthContext.Provider>
}
