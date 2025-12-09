import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface ERPLoginFormProps {
  onShowSignUp?: () => void
}

const ERPLoginForm: React.FC<ERPLoginFormProps> = ({ onShowSignUp }) => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      setLoading(true)
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const uid = userRes.user?.id
      if (!uid) throw new Error('No authenticated user found')
      // Fetch profile including optional fields
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('role, first_name, last_name, company')
        .eq('id', uid)
        .single()
      if (profErr) {
        // If profile missing, redirect to unified dashboard; ApprovalGuard will handle gating
        navigate('/admin/dashboard')
        return
      }
      // Try to hydrate missing fields with metadata or pending local cache
      const meta = (userRes.user as any)?.user_metadata || {}
      let pending: any = null
      try { pending = JSON.parse(localStorage.getItem('erp_pending_profile') || 'null') } catch {}
      const patch: Record<string, any> = {}
      if (!prof?.first_name && (meta.first_name || pending?.first_name)) patch.first_name = meta.first_name || pending?.first_name
      if (!prof?.last_name && (meta.last_name || pending?.last_name)) patch.last_name = meta.last_name || pending?.last_name
      if (!prof?.company && (meta.company || pending?.company)) patch.company = meta.company || pending?.company
      if (Object.keys(patch).length) {
        await supabase.from('profiles').update(patch).eq('id', uid)
        try { localStorage.removeItem('erp_pending_profile') } catch {}
      }
      // Redirect all roles to the unified dashboard; ApprovalGuard enforces client approval
      navigate('/admin/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-neutral-dark mb-2">Sign in to ERP System</h1>
        <p className="text-neutral-medium">Welcome back! Please enter your details.</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="text-sm text-accent-danger bg-accent-danger/10 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-dark mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-6 py-4 bg-neutral-light border border-neutral-soft rounded-full text-neutral-dark placeholder-neutral-medium focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent transition-all duration-200"
            placeholder="Enter your email"
            required
          />
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-neutral-dark mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 pr-12 bg-neutral-light border border-neutral-soft rounded-full text-neutral-dark placeholder-neutral-medium focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent transition-all duration-200"
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-neutral-medium hover:text-neutral-dark transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-primary-medium bg-neutral-light border-neutral-soft rounded focus:ring-primary-medium focus:ring-2"
            />
            <span className="ml-2 text-sm text-neutral-medium">Remember me</span>
          </label>
          <a
            href="#"
            className="text-sm text-primary-medium hover:text-primary-dark transition-colors"
          >
            Forgot Password?
          </a>
        </div>

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-medium hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-full transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2"
        >
          {loading ? 'Signing In…' : 'Sign In'}
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-soft"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-neutral-medium">Or login with</span>
          </div>
        </div>

        {/* Social Login Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 py-3 px-6 border border-neutral-soft rounded-full text-neutral-dark hover:bg-neutral-light transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 py-3 px-6 border border-neutral-soft rounded-full text-neutral-dark hover:bg-neutral-light transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Apple
          </button>
        </div>

        {/* Sign Up Link */}
        <div className="text-center mt-6">
          <span className="text-sm text-neutral-medium">
            Don't have an account?{' '}
            <button type="button" onClick={onShowSignUp} className="text-primary-medium hover:text-primary-dark font-medium transition-colors">
              Sign Up now
            </button>
          </span>
        </div>
      </form>
    </div>
  )
}

export default ERPLoginForm
