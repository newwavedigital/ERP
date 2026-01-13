import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  initializing: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(data.session ?? null)
        setUser(data.session?.user ?? null)
      } finally {
        if (mounted) setInitializing(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const s = data.session
      const expiresAtMs = s?.expires_at ? Number(s.expires_at) * 1000 : null

      // If session is missing/expired, don't call the network logout endpoint (often returns 403).
      if (s?.access_token && expiresAtMs && expiresAtMs > Date.now()) {
        try {
          await supabase.auth.signOut({ scope: 'local' } as any)
        } catch {}
      }
    } finally {
      // Always clear local auth storage so refresh/restart won't restore the session.
      try {
        localStorage.removeItem('sb-qupsgxpaotpotvxpcppn-auth-token')
        localStorage.removeItem('erp_auth')
        localStorage.removeItem('erp_last_admin_path')
      } catch {}
      setUser(null)
      setSession(null)
    }
  }

  const value = useMemo(() => ({ user, session, initializing, signOut }), [user, session, initializing])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
