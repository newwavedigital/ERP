import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

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
    if (!window.__erp_supabase) {
      window.__erp_supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { storageKey: 'erp_auth' },
      })
    }
    return window.__erp_supabase
  }
  // SSR fallback (not typical in Vite SPA)
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { storageKey: 'erp_auth' } })
}

export const supabase = getClient()
