import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const SetPassword: React.FC = () => {
  const navigate = useNavigate()
  const { user, initializing } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initializing) return
    if (!user) navigate('/login', { replace: true })
  }, [initializing, user, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    try {
      setLoading(true)
      const { error: updErr } = await supabase.auth.updateUser({ password })
      if (updErr) throw updErr
      const { error: actErr } = await supabase.functions.invoke('admin-user-management', {
        body: { action: 'activate_user', payload: {} },
      })
      if (actErr) throw actErr
      setMessage('Password set! Redirecting…')
      setTimeout(() => navigate('/admin/dashboard', { replace: true }), 600)
    } catch (e: any) {
      setError(e?.message || 'Failed to set password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-soft">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-neutral-dark mb-2 text-center">Set your password</h1>
        <p className="text-sm text-neutral-medium text-center mb-6">Create a password to activate your account.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-dark">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-dark">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          {error && <div className="text-sm text-accent-danger bg-accent-danger/10 px-4 py-3 rounded-xl">{error}</div>}
          {message && <div className="text-sm text-accent-success bg-accent-success/10 px-4 py-3 rounded-xl">{message}</div>}

          <button
            type="submit"
            disabled={loading || initializing || !user}
            className="w-full px-4 py-2.5 rounded-lg bg-primary-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SetPassword
