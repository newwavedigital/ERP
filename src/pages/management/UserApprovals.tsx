import React, { useState, useEffect } from 'react'
import { Users, CheckCircle, XCircle, Clock, Search, Filter, Mail, Calendar, User, Plus, Edit, Trash2 } from 'lucide-react'
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

type UserApprovalsProps = {
  embedded?: boolean
}

const UserApprovals: React.FC<UserApprovalsProps> = ({ embedded }) => {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({})
  const [roleConfirm, setRoleConfirm] = useState<{ userId: string; fromRole: string; toRole: string } | null>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [isAdmin, setIsAdmin] = useState(false)
  const [adminRoleLoading, setAdminRoleLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<{ email: string; first_name: string; last_name: string; role: string }>({
    email: '',
    first_name: '',
    last_name: '',
    role: 'client',
  })
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null)
  const [editForm, setEditForm] = useState<{ first_name: string; last_name: string; role: string; approval_status: string } | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Available roles for assignment
  const availableRoles = [
    'client',
    'admin', 
    'finance',
    'production_manager',
    'supply_chain_procurement',
    'warehouse',
    'sales_representative'
  ]

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

  const loadIsAdmin = async () => {
    try {
      setAdminRoleLoading(true)
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr || !authData?.user?.id) {
        setIsAdmin(false)
        setCurrentUserId(null)
        return
      }
      setCurrentUserId(authData.user.id)
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle()
      if (profErr) {
        setIsAdmin(false)
        return
      }
      setIsAdmin(String((prof as any)?.role || '').toLowerCase() === 'admin')
    } catch {
      setIsAdmin(false)
      setCurrentUserId(null)
    } finally {
      setAdminRoleLoading(false)
    }
  }

  const invokeAdminUserManagement = async (body: any) => {
    const { data, error } = await supabase.functions.invoke('admin-user-management', { body })
    if (error) {
      const ctx = (error as any)?.context as Response | undefined
      if (ctx) {
        try {
          const json = await ctx.clone().json()
          if (json && typeof json === 'object' && 'error' in json) {
            throw new Error(String((json as any).error))
          }
          throw new Error(JSON.stringify(json))
        } catch {
          try {
            const text = await ctx.clone().text()
            if (text) throw new Error(text)
          } catch {
            // fall through
          }
        }
      }
      throw new Error(error.message || 'Request failed')
    }
    if (data && (data as any).error) throw new Error(String((data as any).error))
    return data
  }

  const confirmRoleChange = async () => {
    if (!roleConfirm) return
    const { userId, fromRole, toRole } = roleConfirm
    try {
      await updateUserRole(userId, toRole)
      setRoleDrafts((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
    } catch {
      setRoleDrafts((prev) => ({ ...prev, [userId]: fromRole }))
    } finally {
      setRoleConfirm(null)
    }
  }

  const cancelRoleChange = () => {
    if (!roleConfirm) return
    const { userId, fromRole } = roleConfirm
    setRoleDrafts((prev) => ({ ...prev, [userId]: fromRole }))
    setRoleConfirm(null)
  }

  // Update user role
  const updateUserRole = async (userId: string, role: string) => {
    try {
      setUpdatingRole(userId)
      if (!isAdmin) throw new Error('Admin only')
      await invokeAdminUserManagement({
        action: 'update_user',
        payload: {
          id: userId,
          role,
        }
      })

      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, role: role, updated_at: new Date().toISOString() }
          : user
      ))
    } catch (error) {
      console.error('Error updating user role:', error)
    } finally {
      setUpdatingRole(null)
    }
  }

  useEffect(() => {
    loadUsers()
    loadIsAdmin()
  }, [])

  useEffect(() => {
    if (!addOpen) {
      setAddError(null)
      setAddSubmitting(false)
      setAddForm({ email: '', first_name: '', last_name: '', role: 'client' })
    }
  }, [addOpen])

  useEffect(() => {
    if (!editOpen) {
      setEditError(null)
      setEditSubmitting(false)
      setEditTarget(null)
      setEditForm(null)
    }
  }, [editOpen])

  useEffect(() => {
    if (!deleteOpen) {
      setDeleteError(null)
      setDeleteSubmitting(false)
      setDeleteTarget(null)
    }
  }, [deleteOpen])

  const visibleUsers = users

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

  const formatRoleName = (role: string) => {
    const r = String(role || '')
      .toLowerCase()
      .trim()

    const mapped = r === 'finance' ? 'procurement' : r

    return mapped
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  return (
    <div className={embedded ? '' : 'p-6 max-w-7xl mx-auto'}>
      {/* Header */}
      {!embedded && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-medium rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-dark">User Approvals</h1>
            </div>
          </div>
        </div>
      )}

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
        {isAdmin && !adminRoleLoading && (
          <div className="px-6 py-4 border-b border-neutral-soft flex items-center justify-end">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow-md"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>
        )}
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-neutral-dark">{(user.full_name && user.full_name.trim()) || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A'}</p>
                            {currentUserId && user.id === currentUserId && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-neutral-soft text-neutral-dark bg-white">You</span>
                            )}
                          </div>
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
                      {isAdmin ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={roleDrafts[user.id] ?? (user.role || 'client')}
                            onChange={(e) => {
                              if (currentUserId && user.id === currentUserId) return
                              const fromRole = String(user.role || 'client')
                              const toRole = e.target.value
                              setRoleDrafts((prev) => ({ ...prev, [user.id]: toRole }))
                              setRoleConfirm({ userId: user.id, fromRole, toRole })
                            }}
                            disabled={updatingRole === user.id || (currentUserId ? user.id === currentUserId : false)}
                            title={currentUserId && user.id === currentUserId ? 'This is the account currently logged in' : undefined}
                            className="text-sm border border-neutral-soft rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-medium focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {availableRoles.map(role => (
                              <option key={role} value={role}>
                                {formatRoleName(role)}
                              </option>
                            ))}
                          </select>
                          {updatingRole === user.id && (
                            <div className="w-4 h-4 border-2 border-primary-medium border-t-transparent rounded-full animate-spin"></div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-dark">{formatRoleName(user.role || 'client')}</span>
                      )}
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
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditTarget(user)
                              setEditForm({
                                first_name: String(user.first_name || ''),
                                last_name: String(user.last_name || ''),
                                role: String(user.role || 'client'),
                                approval_status: String(user.approval_status || 'pending'),
                              })
                              setEditOpen(true)
                            }}
                            className="p-2 text-primary-medium hover:bg-primary-light/10 rounded-lg transition-colors"
                            title="Edit user"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(user)
                              setDeleteOpen(true)
                            }}
                            className="p-2 text-accent-danger hover:bg-accent-danger/10 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {roleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cancelRoleChange}></div>
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-soft/30">
              <div className="text-lg font-semibold text-neutral-dark">Confirm Role Change</div>
            </div>
            <div className="px-6 py-5 text-sm text-neutral-medium">
              Change role from <span className="font-semibold text-neutral-dark">{formatRoleName(roleConfirm.fromRole)}</span> to{' '}
              <span className="font-semibold text-neutral-dark">{formatRoleName(roleConfirm.toRole)}</span>?
            </div>
            <div className="px-6 py-4 border-t border-neutral-soft/30 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancelRoleChange}
                disabled={updatingRole === roleConfirm.userId}
                className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmRoleChange}
                disabled={updatingRole === roleConfirm.userId}
                className="px-4 py-2 rounded-lg bg-primary-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {addOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !addSubmitting && setAddOpen(false)}></div>
          <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-soft/30 flex items-center justify-between">
              <div className="text-lg font-semibold text-neutral-dark">Add User</div>
              <button type="button" className="p-2 rounded-lg hover:bg-neutral-light/40 text-neutral-medium" onClick={() => !addSubmitting && setAddOpen(false)}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-neutral-dark">Email (required)</label>
                <input
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium"
                  placeholder="name@company.com"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-neutral-dark">First Name</label>
                  <input
                    value={addForm.first_name}
                    onChange={(e) => setAddForm((p) => ({ ...p, first_name: e.target.value }))}
                    className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-neutral-dark">Last Name</label>
                  <input
                    value={addForm.last_name}
                    onChange={(e) => setAddForm((p) => ({ ...p, last_name: e.target.value }))}
                    className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium"
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-neutral-dark">Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))}
                  className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-medium"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>{formatRoleName(r)}</option>
                  ))}
                </select>
              </div>
              {addError && (
                <div className="text-sm text-accent-danger">{addError}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-neutral-soft/30 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={addSubmitting}
                className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addSubmitting}
                onClick={async () => {
                  try {
                    setAddSubmitting(true)
                    setAddError(null)
                    const email = addForm.email.trim()
                    if (!email) {
                      setAddError('Email is required')
                      return
                    }
                    const redirect_to = `${window.location.origin}/#/auth/callback`
                    await invokeAdminUserManagement({
                      action: 'create_user',
                      payload: {
                        email,
                        redirect_to,
                        first_name: addForm.first_name.trim() || null,
                        last_name: addForm.last_name.trim() || null,
                        role: addForm.role,
                      }
                    })
                    setAddOpen(false)
                    await loadUsers()
                  } catch (e) {
                    setAddError(e instanceof Error ? e.message : 'Failed to add user')
                  } finally {
                    setAddSubmitting(false)
                  }
                }}
                className="px-4 py-2 rounded-lg bg-primary-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {addSubmitting ? 'Sending Invite…' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && editTarget && editForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !editSubmitting && setEditOpen(false)}></div>
          <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-soft/30 flex items-center justify-between">
              <div className="text-lg font-semibold text-neutral-dark">Edit User</div>
              <button type="button" className="p-2 rounded-lg hover:bg-neutral-light/40 text-neutral-medium" onClick={() => !editSubmitting && setEditOpen(false)}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="text-sm text-neutral-medium">{editTarget.email}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-neutral-dark">First Name</label>
                  <input
                    value={editForm.first_name}
                    onChange={(e) => setEditForm((p) => p ? ({ ...p, first_name: e.target.value }) : p)}
                    className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-neutral-dark">Last Name</label>
                  <input
                    value={editForm.last_name}
                    onChange={(e) => setEditForm((p) => p ? ({ ...p, last_name: e.target.value }) : p)}
                    className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-neutral-dark">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => p ? ({ ...p, role: e.target.value }) : p)}
                  disabled={currentUserId ? editTarget.id === currentUserId : false}
                  title={currentUserId && editTarget.id === currentUserId ? 'This is the account currently logged in' : undefined}
                  className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>{formatRoleName(r)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-neutral-dark">Status</label>
                <select
                  value={editForm.approval_status}
                  onChange={(e) => setEditForm((p) => p ? ({ ...p, approval_status: e.target.value }) : p)}
                  disabled={currentUserId ? editTarget.id === currentUserId : false}
                  title={currentUserId && editTarget.id === currentUserId ? 'This is the account currently logged in' : undefined}
                  className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {editError && (
                <div className="text-sm text-accent-danger">{editError}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-neutral-soft/30 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={editSubmitting}
                className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSubmitting}
                onClick={async () => {
                  try {
                    setEditSubmitting(true)
                    setEditError(null)
                    await invokeAdminUserManagement({
                      action: 'update_user',
                      payload: {
                        id: editTarget.id,
                        first_name: editForm.first_name.trim() || null,
                        last_name: editForm.last_name.trim() || null,
                        role: editForm.role,
                        approval_status: editForm.approval_status,
                      }
                    })
                    setEditOpen(false)
                    await loadUsers()
                  } catch (e) {
                    setEditError(e instanceof Error ? e.message : 'Failed to update user')
                  } finally {
                    setEditSubmitting(false)
                  }
                }}
                className="px-4 py-2 rounded-lg bg-primary-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {editSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && deleteTarget && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleteSubmitting && setDeleteOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-soft/30 flex items-center justify-between">
              <div className="text-lg font-semibold text-neutral-dark">Delete User</div>
              <button type="button" className="p-2 rounded-lg hover:bg-neutral-light/40 text-neutral-medium" onClick={() => !deleteSubmitting && setDeleteOpen(false)}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="text-sm text-neutral-medium">
                This will permanently delete the user from Authentication and remove their profile.
              </div>
              <div className="text-sm font-semibold text-neutral-dark">{deleteTarget.email}</div>
              {deleteError && (
                <div className="text-sm text-accent-danger">{deleteError}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-neutral-soft/30 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteSubmitting}
                className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={async () => {
                  try {
                    setDeleteSubmitting(true)
                    setDeleteError(null)
                    await invokeAdminUserManagement({
                      action: 'delete_user',
                      payload: { id: deleteTarget.id },
                    })
                    setDeleteOpen(false)
                    await loadUsers()
                  } catch (e) {
                    setDeleteError(e instanceof Error ? e.message : 'Failed to delete user')
                  } finally {
                    setDeleteSubmitting(false)
                  }
                }}
                className="px-4 py-2 rounded-lg bg-accent-danger text-white hover:bg-accent-danger/90 disabled:opacity-50"
              >
                {deleteSubmitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserApprovals
