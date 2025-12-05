import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [message, setMessage] = useState<string>('Finalizing sign-in…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // With hash routing, Supabase may return either:
    // 1) PKCE code in query:   #/auth/callback?code=...
    // 2) Tokens in fragment:   #/auth/callback#access_token=...&refresh_token=...
    const fullHash = window.location.hash || ''
    const afterRoute = fullHash.split('#/auth/callback')[1] || ''
    const queryPart = afterRoute.includes('?') ? afterRoute.split('?')[1].split('#')[0] : ''
    const fragPart = afterRoute.includes('#') ? afterRoute.split('#')[1] : ''
    const q = new URLSearchParams(queryPart)
    const f = new URLSearchParams(fragPart)

    const err = q.get('error') || f.get('error')
    const errDesc = q.get('error_description') || f.get('error_description')
    const access_token = f.get('access_token')
    const refresh_token = f.get('refresh_token')
    const token_hash = q.get('token_hash') || f.get('token_hash')
    const type = q.get('type') || f.get('type')
    const email = q.get('email') || f.get('email') || undefined

    // Helper function to redirect properly whether in same tab or new tab
    const redirectToLogin = () => {
      // Set a flag in localStorage to notify other tabs
      try {
        localStorage.setItem('erp_email_confirmed', Date.now().toString())
      } catch (e) {}
      
      // Always try to redirect the current window first
      window.location.replace(`${window.location.origin}/#/login`)
      
      // If this was opened in a new tab, also try to redirect the opener
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.location.href = `${window.location.origin}/#/login`
          setTimeout(() => window.close(), 500)
        } catch (e) {
          // Cross-origin restrictions might prevent this, but the replace above should work
          setTimeout(() => window.close(), 500)
        }
      }
    }

    async function run() {
      try {
        if (err) {
          throw new Error(errDesc || err)
        }
        if (access_token && refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token })
          if (setErr) throw setErr
          setMessage('Signed in! Redirecting to Login…')
          setTimeout(redirectToLogin, 1000)
          return
        }
        // Do not use exchangeCodeForSession here to avoid PKCE verifier mismatch for email links
        // Fallback: verify email using token_hash (legacy/email links)
        if (token_hash && (type === 'signup' || type === 'email')) {
          const { error: vErr } = await supabase.auth.verifyOtp({
            type: (type as any) || 'email',
            token_hash,
            email,
          } as any)
          if (vErr) throw vErr
          setMessage('Email verified. Redirecting to Login…')
          setTimeout(redirectToLogin, 1200)
          return
        }
        throw new Error('No auth parameters found.')
      } catch (e: any) {
        setError(e?.message || 'Link invalid or expired. You can request a new one from Sign Up.')
        setMessage('')
      }
    }

    run()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-soft">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-dark mb-2">Authentication</h1>
        {message && <p className="text-neutral-medium">{message}</p>}
        {error && (
          <div className="mt-3 text-sm text-accent-danger bg-accent-danger/10 px-4 py-3 rounded-xl">
            {error}
            <div className="mt-2">
              <button 
                onClick={() => {
                  window.location.replace(`${window.location.origin}/#/login`)
                  if (window.opener && !window.opener.closed) {
                    try {
                      window.opener.location.href = `${window.location.origin}/#/login`
                      window.close()
                    } catch (e) {
                      // Cross-origin restrictions might prevent this
                    }
                  }
                }}
                className="text-primary-medium hover:text-primary-dark font-medium underline"
              >
                Return to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthCallback
