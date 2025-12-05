import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface ApprovalGuardProps {
  children: React.ReactNode
}

const ApprovalGuard: React.FC<ApprovalGuardProps> = ({ children }) => {
  const { user, initializing } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [checkingApproval, setCheckingApproval] = useState(true)

  // Check user approval status
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!user || initializing) {
        setCheckingApproval(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('approval_status, role')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error checking approval status:', error)
          // If profile doesn't exist or error, default to pending
          setApprovalStatus('pending')
          setRole(null)
        } else {
          setApprovalStatus(data?.approval_status || 'pending')
          setRole((data as any)?.role ?? null)
        }
      } catch (error) {
        console.error('Error checking approval status:', error)
        setApprovalStatus('pending')
        setRole(null)
      } finally {
        setCheckingApproval(false)
      }
    }

    checkApprovalStatus()
  }, [user, initializing])

  // Handle redirects based on approval status
  useEffect(() => {
    if (checkingApproval || initializing || !user) return

    const currentPath = location.pathname

    // Bypass approval redirects for admin role
    if ((role || '').toLowerCase() === 'admin') {
      return
    }

    // Don't redirect if already on approval-related pages
    if (currentPath === '/waiting-approval' || currentPath === '/rejected') {
      return
    }

    // Redirect based on approval status
    if (approvalStatus === 'pending') {
      navigate('/waiting-approval', { replace: true })
    } else if (approvalStatus === 'rejected') {
      navigate('/rejected', { replace: true })
    }
    // If approved, let the user continue normally
  }, [approvalStatus, checkingApproval, initializing, user, role, navigate, location.pathname])

  // Show loading while checking
  if (initializing || checkingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-light">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-medium border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-medium">Checking account status...</p>
        </div>
      </div>
    )
  }

  // If no user, let the auth system handle it
  if (!user) {
    return <>{children}</>
  }

  // If user is approved or on approval pages, render children
  if (approvalStatus === 'approved' || 
      (role || '').toLowerCase() === 'admin' ||
      location.pathname === '/waiting-approval' || 
      location.pathname === '/rejected') {
    return <>{children}</>
  }

  // Default fallback (shouldn't reach here due to useEffect redirects)
  return <>{children}</>
}

export default ApprovalGuard
