


import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://qupsgxpaotpotvxpcppn.supabase.co'
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cHNneHBhb3Rwb3R2eHBjcHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MzUxMDYsImV4cCI6MjA3NzQxMTEwNn0.LZKCrZKQN3UM96EZFnnQzd4mHuHz4qBef4anHtnQ2pk'

const supabaseAuthStorageKey = 'sb-qupsgxpaotpotvxpcppn-auth-token'

// Create a singleton client to avoid multiple GoTrueClient instances under HMR
declare global {
  interface Window {
    __erp_supabase?: ReturnType<typeof createClient>
  }
}

const getClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  }
  if (typeof window !== 'undefined') {
    try {
      const legacy = window.localStorage.getItem('erp_auth')
      const current = window.localStorage.getItem(supabaseAuthStorageKey)
      if (legacy && !current) {
        window.localStorage.setItem(supabaseAuthStorageKey, legacy)
        window.localStorage.removeItem('erp_auth')
      }
    } catch {}
    if (!window.__erp_supabase) {
      window.__erp_supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storageKey: supabaseAuthStorageKey,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // we handle it manually in AuthCallback
        },
      })
    }
    return window.__erp_supabase
  }
  // SSR fallback (not typical in Vite SPA)
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: supabaseAuthStorageKey,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}

export const supabase = getClient()
