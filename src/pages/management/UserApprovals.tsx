import React, { useState, useEffect } from 'react'
import { Users, CheckCircle, XCircle, Clock, Search, Filter, Mail, Calendar, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface UserProfile {
  id: string
  email: string
  full_name?: string
  first_name?: string
  last_name?: string
  company?: string
  role?: string
  approval_status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at?: string
}

const UserApprovals: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [updating, setUpdating] = useState<string | null>(null)

  // Load users from profiles table
  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  // Update user approval status
  const updateApprovalStatus = async (userId: string, status: 'pending' | 'approved' | 'rejected') => {
    try {
      setUpdating(userId)
      const { error } = await supabase
        .from('profiles')
        .update({ 
          approval_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, approval_status: status, updated_at: new Date().toISOString() }
          : user
      ))
    } catch (error) {
      console.error('Error updating approval status:', error)
    } finally {
      setUpdating(null)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Exclude admin accounts from the UI entirely
  const visibleUsers = users.filter(u => (u.role || '').toLowerCase() !== 'admin')

  // Filter users based on search and status (from visible set only)
  const filteredUsers = visibleUsers.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.company?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || user.approval_status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent-success/10 text-accent-success">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent-danger/10 text-accent-danger">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent-warning/10 text-accent-warning">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        )
    }
  }

  const getStatusCount = (status: string) => {
    return visibleUsers.filter(user => user.approval_status === status).length
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary-medium rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-dark">User Approvals</h1>
            <p className="text-neutral-medium">Manage user registration approvals for ERP System access</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-neutral-soft shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-neutral-light rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-neutral-dark" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-dark">{visibleUsers.length}</p>
              <p className="text-sm text-neutral-medium">Total Users</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-neutral-soft shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent-warning/10 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-accent-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-accent-warning">{getStatusCount('pending')}</p>
              <p className="text-sm text-neutral-medium">Pending</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-neutral-soft shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent-success/10 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-accent-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-accent-success">{getStatusCount('approved')}</p>
              <p className="text-sm text-neutral-medium">Approved</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-neutral-soft shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent-danger/10 rounded-xl flex items-center justify-center">
              <XCircle className="w-6 h-6 text-accent-danger" />
            </div>
            <div>
              <p className="text-2xl font-bold text-accent-danger">{getStatusCount('rejected')}</p>
              <p className="text-sm text-neutral-medium">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-neutral-soft p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-medium" />
            <input
              type="text"
              placeholder="Search by email, name, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-medium" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="pl-10 pr-8 py-2 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent bg-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-neutral-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-light/50 border-b border-neutral-soft">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-dark">User</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-dark">Company</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-dark">Role</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-dark">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-dark">Registered</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-dark">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-medium">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary-medium border-t-transparent rounded-full animate-spin"></div>
                      Loading users...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-medium">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-8 h-8 text-neutral-medium/50" />
                      <p>No users found matching your criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-soft hover:bg-neutral-light/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-light/20 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-primary-medium" />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-dark">{(user.full_name && user.full_name.trim()) || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A'}</p>
                          <p className="text-sm text-neutral-medium flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-dark">{user.company || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-dark">{user.role || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(user.approval_status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-neutral-medium">
                        <Calendar className="w-3 h-3" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.approval_status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateApprovalStatus(user.id, 'approved')}
                              disabled={updating === user.id}
                              className="p-2 text-accent-success hover:bg-accent-success/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateApprovalStatus(user.id, 'rejected')}
                              disabled={updating === user.id}
                              className="p-2 text-accent-danger hover:bg-accent-danger/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {user.approval_status !== 'pending' && (
                          <button
                            onClick={() => updateApprovalStatus(user.id, 'pending')}
                            disabled={updating === user.id}
                            className="p-2 text-accent-warning hover:bg-accent-warning/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Reset to Pending"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        {updating === user.id && (
                          <div className="w-4 h-4 border-2 border-primary-medium border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {!loading && filteredUsers.length > 0 && (
        <div className="mt-6 text-center text-sm text-neutral-medium">
          Showing {filteredUsers.length} of {visibleUsers.length} users
        </div>
      )}
    </div>
  )
}

export default UserApprovals
