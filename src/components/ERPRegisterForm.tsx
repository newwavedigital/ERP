import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface ERPRegisterFormProps {
  onShowSignIn?: () => void
}

const ERPRegisterForm: React.FC<ERPRegisterFormProps> = ({ onShowSignIn }) => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // All sign-ups default to client/user role (no role picker UI)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    // Listen for email confirmation events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'erp_email_confirmed' && e.newValue) {
        // Email was confirmed in another tab, show success and switch to sign in
        setMessage('Email confirmed successfully! You can now sign in.')
        setError(null)
        if (onShowSignIn) {
          setTimeout(() => onShowSignIn(), 2000)
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [onShowSignIn])

  const getSiteUrl = () => {
    const raw = (import.meta.env.VITE_SITE_URL as string) || window.location.origin
    return raw.replace(/\/+$/, '')
  }
//FDSAFSA
  const resend = async () => {
    setMessage(null)
    setError(null)
    try {
      setResending(true)
      const redirectTo = `${getSiteUrl()}/#/auth/callback`
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectTo },
      })
      if (resendErr) throw resendErr
      setMessage('Verification email sent again. Please check your inbox.')
    } catch (e: any) {
      setError(e?.message || 'Could not resend verification email')
    } finally {
      setResending(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    try {
      setLoading(true)
      const redirectTo = `${getSiteUrl()}/#/auth/callback`
      // Save pending profile locally in case email confirmation flow prevents immediate insert
      const pending = { first_name: firstName, last_name: lastName, company }
      try { localStorage.setItem('erp_pending_profile', JSON.stringify(pending)) } catch {}

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo, data: pending },
      })
      if (authError) throw authError
      const user = data.user
      if (!user) throw new Error('No user returned by Supabase')

      // If email confirmation is ON, there is no session yet (RLS blocks inserts).
      // The auth trigger will auto-create the profile on user creation.
      // If confirmation is OFF and we do have a session, we can insert immediately.
      if (data.session) {
        const { error: profErr } = await supabase.from('profiles').insert({
          id: user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          company,
          role: 'client',
        })
        if (profErr) throw profErr
        setMessage('Account created! You are signed in.')
      } else {
        setMessage('Account created! Please check your email to verify your address. Your profile will be created automatically after verification.')
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-neutral-dark mb-2">Create your ERP account</h1>
        <p className="text-neutral-medium">Start your 14-day free trial. No credit card required.</p>
      </div>
      {message && <div className="mb-4 text-sm text-accent-success bg-accent-success/10 px-4 py-3 rounded-xl">{message}</div>}
      {error && (
        <div className="mb-4 text-sm text-accent-danger bg-accent-danger/10 px-4 py-3 rounded-xl">
          <div>{error}</div>
          <div className="mt-2">
            <button
              type="button"
              onClick={resend}
              disabled={resending || !email}
              className="text-primary-medium hover:text-primary-dark font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resending ? 'Resending…' : 'Resend verification email'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="First name"
            value={firstName}
            onChange={(e)=>setFirstName(e.target.value)}
            className="w-full px-6 py-4 bg-neutral-light border border-neutral-soft rounded-full text-neutral-dark placeholder-neutral-medium focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent"
            required
          />
          <input
            placeholder="Last name"
            value={lastName}
            onChange={(e)=>setLastName(e.target.value)}
            className="w-full px-6 py-4 bg-neutral-light border border-neutral-soft rounded-full text-neutral-dark placeholder-neutral-medium focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent"
            required
          />
        </div>

        <input
          placeholder="Company (optional)"
          value={company}
          onChange={(e)=>setCompany(e.target.value)}
          className="w-full px-6 py-4 bg-neutral-light border border-neutral-soft rounded-full text-neutral-dark placeholder-neutral-medium focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent"
        />

        <input
          type="email"
          placeholder="Work email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          className="w-full px-6 py-4 bg-neutral-light border border-neutral-soft rounded-full text-neutral-dark placeholder-neutral-medium focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent"
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            className="w-full px-6 py-4 bg-neutral-light border border-neutral-soft rounded-full text-neutral-dark placeholder-neutral-medium focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent"
            required
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e)=>setConfirm(e.target.value)}
            className="w-full px-6 py-4 bg-neutral-light border border-neutral-soft rounded-full text-neutral-dark placeholder-neutral-medium focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent"
            required
          />
        </div>

        {/* Accounts created here are client/user by default */}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-medium hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-full transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2"
        >
          {loading ? 'Creating account…' : 'Create Account'}
        </button>

        <div className="text-center mt-2">
          <span className="text-sm text-neutral-medium">
            Already have an account?{' '}
            <button type="button" onClick={onShowSignIn} className="text-primary-medium hover:text-primary-dark font-medium">Sign In</button>
          </span>
        </div>
      </form>
    </div>
  )
}

export default ERPRegisterForm
