import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

// ---------------------------------------------------------------------------
// Dev bypass — set VITE_DEV_BYPASS_AUTH=true in .env to skip Google OAuth.
// Never active in production builds (import.meta.env.DEV is false there).
// ---------------------------------------------------------------------------
const DEV_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

const DEV_SESSION = { user: { id: 'dev-00000000-0000-0000-0000-000000000000' } }
const DEV_PROFILE = { id: DEV_SESSION.user.id, full_name: 'Dev User', initials: 'DU', role: 'gp' }

export function AuthProvider({ children }) {
  // undefined = still loading, null = no session
  const [session, setSession] = useState(DEV_BYPASS ? DEV_SESSION : undefined)
  const [profile, setProfile] = useState(DEV_BYPASS ? DEV_PROFILE : null)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, initials, role')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    if (DEV_BYPASS) return  // skip Supabase auth entirely in dev bypass mode

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else setSession(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
        // Log sign-in events only (not TOKEN_REFRESHED, USER_UPDATED, etc.)
        if (event === 'SIGNED_IN') {
          supabase.rpc('log_audit', {
            p_action:        'login',
            p_resource_type: 'session',
            p_resource_id:   session.user.id,
            p_metadata:      { email: session.user.email },
          }).catch(() => {}) // fire-and-forget; never block the auth flow
        }
      } else {
        setProfile(null)
        setSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    if (DEV_BYPASS) return
    // Log the logout before ending the session — auth.uid() needs an active JWT
    try {
      await supabase.rpc('log_audit', {
        p_action:        'logout',
        p_resource_type: 'session',
      })
    } catch { /* non-blocking */ }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session,
      profile,
      loading: session === undefined,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
