import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Package, Mail, Phone, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const WaitingApproval: React.FC = () => {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const checkStatus = async () => {
    if (!user) return
    setChecking(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('approval_status')
        .eq('id', user.id)
        .single()
      if (!error) {
        const st = (data?.approval_status as any) || 'pending'
        setStatus(st)
        if (String(st).toLowerCase() === 'approved') {
          navigate('/home', { replace: true })
        }
      }
    } finally {
      setChecking(false)
    }
  }

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@erpsystem.com?subject=Account Approval Status Inquiry'
  }

  // Subscribe to approval status changes for auto-redirect
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let mounted = true
    const init = async () => {
      if (!user) return
      // Initial fetch
      await checkStatus()
      // Realtime subscribe
      channel = supabase.channel('profiles-approval-status')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        }, (payload: any) => {
          if (!mounted) return
          const newStatus = (payload.new?.approval_status as any) || 'pending'
          setStatus(newStatus)
          if (String(newStatus).toLowerCase() === 'approved') {
            navigate('/home', { replace: true })
          }
        }).subscribe()
    }
    init()
    return () => {
      mounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [user])

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light via-white to-primary-light/10">
      {/* Navigation */}
      <nav className="bg-white border-b border-neutral-soft px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-medium rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-neutral-dark">ERP System</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-neutral-medium hover:text-primary-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="max-w-2xl w-full">
          {/* Status Card */}
          <div className="bg-white rounded-3xl shadow-2xl border border-neutral-soft overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-accent-warning/10 to-accent-warning/5 px-8 py-6 border-b border-neutral-soft">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-accent-warning/20 rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 text-accent-warning" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-neutral-dark">Account Pending Approval</h1>
                  <p className="text-neutral-medium">Your registration is being reviewed by our Management Account team</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-24 h-24 bg-accent-warning/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-12 h-12 text-accent-warning animate-pulse" />
                </div>
                <h2 className="text-xl font-semibold text-neutral-dark mb-3">
                  Thank you for registering with ERP System!
                </h2>
                <p className="text-neutral-medium leading-relaxed">
                  Your account has been successfully created and is currently under review. 
                  Our Management Account team will review your registration and approve access to the system.
                </p>
              </div>

              {/* User Info */}
              <div className="bg-neutral-light/50 rounded-2xl p-6 mb-6">
                <h3 className="font-semibold text-neutral-dark mb-4">Registration Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary-medium rounded-full"></div>
                    <span className="text-sm text-neutral-medium">Email:</span>
                    <span className="text-sm font-medium text-neutral-dark">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${status === 'approved' ? 'bg-accent-success' : status === 'rejected' ? 'bg-accent-danger' : 'bg-accent-warning'}`}></div>
                    <span className="text-sm text-neutral-medium">Status:</span>
                    <span className={`text-sm font-medium ${status === 'approved' ? 'text-accent-success' : status === 'rejected' ? 'text-accent-danger' : 'text-accent-warning'}`}>
                      {status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending Approval'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-neutral-medium rounded-full"></div>
                    <span className="text-sm text-neutral-medium">Submitted:</span>
                    <span className="text-sm font-medium text-neutral-dark">
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* What's Next */}
              <div className="bg-primary-light/10 rounded-2xl p-6 mb-8">
                <h3 className="font-semibold text-neutral-dark mb-4 flex items-center gap-2">
                  <div className="w-5 h-5 bg-primary-medium rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                  What happens next?
                </h3>
                <div className="space-y-3 text-sm text-neutral-medium">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary-medium/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary-medium text-xs font-bold">1</span>
                    </div>
                    <p>Our Management Account team will review your registration details</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary-medium/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary-medium text-xs font-bold">2</span>
                    </div>
                    <p>You'll receive an email notification once your account is approved</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary-medium/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary-medium text-xs font-bold">3</span>
                    </div>
                    <p>Log in again to access your ERP dashboard and start managing your operations</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={checkStatus}
                  disabled={checking}
                  className={`flex-1 px-6 py-3 rounded-full font-semibold transition-colors flex items-center justify-center gap-2 text-white ${checking ? 'bg-primary-medium/70 cursor-not-allowed' : 'bg-primary-medium hover:bg-primary-dark'}`}
                >
                  {checking ? (
                    <span className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {checking ? 'Checking…' : 'Check Status'}
                </button>
                <button
                  onClick={handleContactSupport}
                  className="flex-1 border-2 border-neutral-soft hover:border-primary-medium text-neutral-dark hover:text-primary-medium px-6 py-3 rounded-full font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Contact Support
                </button>
              </div>

              {/* Support Info */}
              <div className="mt-8 pt-6 border-t border-neutral-soft">
                <div className="text-center">
                  <p className="text-sm text-neutral-medium mb-4">
                    Need immediate assistance? Contact our support team:
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-neutral-medium">
                      <Mail className="w-4 h-4" />
                      <span>support@erpsystem.com</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-medium">
                      <Phone className="w-4 h-4" />
                      <span>+1 (555) 123-4567</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-medium">
              Approval typically takes 1-2 business days. Thank you for your patience.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WaitingApproval
