import React, { useEffect, useMemo, useState } from 'react'
import { Shield, Settings, Users, ChevronDown, ChevronUp, RefreshCw, Save, Search, Filter, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type ProfileRow = {
  id: string
  email: string | null
  first_name?: string | null
  last_name?: string | null
  role?: string | null
  tool_permissions?: Record<string, boolean> | null
}

const CLIENT_TABS = [
  'Dashboard',
  'Products',
  'Inventory',
  'Production Schedule',
  'Purchase Orders',
  'Completed Orders',
  'Content Library',
  'Customers',
  'Suppliers',
  'Team Chat',
  'AI Insights',
]

const defaultOn: Record<string, boolean> = CLIENT_TABS.reduce((acc, k) => {
  acc[k] = true
  return acc
}, {} as Record<string, boolean>)

const ToolPermissions: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [defaults, setDefaults] = useState<Record<string, boolean>>(defaultOn)
  const [dbWritable, setDbWritable] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all')

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, role, tool_permissions')
          .eq('role', 'client')
        if (error) throw error
        if (!mounted) return
        setUsers((data as ProfileRow[]) || [])
      } catch (e: any) {
        setDbWritable(false)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [])

  const totals = useMemo(() => CLIENT_TABS.length, [])

  const toggleDefault = (tool: string) => {
    setDefaults((prev) => ({ ...prev, [tool]: !prev[tool] }))
  }

  const userEnabledCount = (u: ProfileRow): number => {
    const merged: Record<string, boolean> = { ...defaults, ...(u.tool_permissions || {}) }
    return CLIENT_TABS.reduce((n, t) => (merged[t] ? n + 1 : n), 0)
  }

  const setUserOverride = (userId: string, tool: string, value: boolean) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, tool_permissions: { ...(u.tool_permissions || {}), [tool]: value } }
          : u
      )
    )
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').toLowerCase()
      const email = (user.email || '').toLowerCase()
      const searchMatch = searchTerm === '' || 
        fullName.includes(searchTerm.toLowerCase()) || 
        email.includes(searchTerm.toLowerCase())
      
      if (!searchMatch) return false
      
      if (filterStatus === 'all') return true
      
      const enabledCount = userEnabledCount(user)
      if (filterStatus === 'enabled') return enabledCount > 0
      if (filterStatus === 'disabled') return enabledCount === 0
      
      return true
    })
  }, [users, searchTerm, filterStatus, userEnabledCount])

  const defaultsEnabledCount = useMemo(() => {
    return CLIENT_TABS.reduce((count, tool) => defaults[tool] ? count + 1 : count, 0)
  }, [defaults])

  const saveAll = async () => {
    if (!dbWritable) return
    try {
      setSaving(true)
      for (const u of users) {
        const { error } = await supabase
          .from('profiles')
          .update({ tool_permissions: u.tool_permissions || {} })
          .eq('id', u.id)
        if (error) throw error
      }
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => setDefaults(defaultOn)

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light via-white to-primary-light/5">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-neutral-soft/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-dark via-primary-medium to-primary-light rounded-2xl flex items-center justify-center shadow-xl ring-2 ring-primary-light/20">
                  <Shield className="w-7 h-7 text-white drop-shadow-sm" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-accent-success rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-neutral-dark bg-gradient-to-r from-neutral-dark to-primary-dark bg-clip-text text-transparent">
                  Tool Permissions
                </h1>
                <p className="text-neutral-medium font-medium">Advanced access control for client tools and features</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={resetDefaults}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-accent-danger hover:text-white hover:bg-accent-danger border border-accent-danger/30 hover:border-accent-danger rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-105"
              >
                <XCircle className="w-4 h-4" />
                Reset Defaults
              </button>
              <button
                disabled={saving || !dbWritable}
                onClick={saveAll}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 ${
                  saving || !dbWritable 
                    ? 'bg-neutral-medium/50 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-primary-medium to-primary-dark hover:from-primary-dark hover:to-primary-medium hover:shadow-xl hover:scale-105'
                }`}
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Alert Banner */}
        {!dbWritable && (
          <div className="bg-gradient-to-r from-accent-warning/10 via-accent-warning/5 to-accent-warning/10 border border-accent-warning/30 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-warning/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-accent-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-accent-warning">Storage Configuration Required</h3>
                <p className="text-sm text-accent-warning/80">Add JSON column 'tool_permissions' to profiles table to persist changes. Currently operating in preview mode only.</p>
              </div>
            </div>
          </div>
        )}

        {/* Default Permissions Section */}
        <div className="bg-white rounded-2xl border border-neutral-soft overflow-hidden">
          <div className="bg-neutral-light/30 px-6 py-4 border-b border-neutral-soft">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-light/20 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-primary-medium" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-dark">Default Tool Permissions</h2>
                  <p className="text-sm text-neutral-medium">Global settings applied to all new client accounts</p>
                </div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 border border-neutral-soft">
                <div className="text-xs text-neutral-medium">Enabled Tools</div>
                <div className="text-base font-semibold text-primary-medium">{defaultsEnabledCount} / {totals}</div>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CLIENT_TABS.map((tool) => (
                <button
                  key={tool}
                  onClick={() => toggleDefault(tool)}
                  className={`rounded-xl border p-3 transition-all duration-200 hover:border-primary-medium ${
                    defaults[tool] 
                      ? 'bg-primary-light/10 border-primary-light' 
                      : 'bg-white border-neutral-soft hover:bg-primary-light/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {defaults[tool] ? (
                        <CheckCircle2 className="w-4 h-4 text-primary-medium" />
                      ) : (
                        <XCircle className="w-4 h-4 text-neutral-medium" />
                      )}
                      <span className="font-medium text-neutral-dark">{tool}</span>
                    </div>
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      defaults[tool] ? 'bg-primary-medium' : 'bg-neutral-soft'
                    }`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                        defaults[tool] ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* User Permissions Section */}
        <div className="bg-white rounded-2xl border border-neutral-soft overflow-hidden">
          <div className="bg-neutral-light/30 px-6 py-4 border-b border-neutral-soft">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-light/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-medium" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-dark">User-Specific Permissions</h2>
                  <p className="text-sm text-neutral-medium">Individual overrides for specific client accounts</p>
                </div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 border border-neutral-soft">
                <div className="text-xs text-neutral-medium">Total Users</div>
                <div className="text-base font-semibold text-primary-medium">{filteredUsers.length}</div>
              </div>
            </div>
            
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-medium" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium/50 focus:border-primary-medium transition-all duration-200"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-medium" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'enabled' | 'disabled')}
                  className="pl-9 pr-8 py-2.5 bg-white border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium/50 focus:border-primary-medium transition-all duration-200 appearance-none cursor-pointer"
                >
                  <option value="all">All Users</option>
                  <option value="enabled">With Access</option>
                  <option value="disabled">No Access</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-primary-medium animate-spin" />
                  <span className="text-neutral-medium">Loading users...</span>
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-neutral-light rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-neutral-medium" />
                </div>
                <h3 className="text-base font-semibold text-neutral-dark mb-1">No Users Found</h3>
                <p className="text-sm text-neutral-medium">No client users match your current search criteria.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((u) => {
                  const full = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'User'
                  const count = userEnabledCount(u)
                  const isOpen = !!expanded[u.id]
                  const hasAccess = count > 0
                  
                  return (
                    <div key={u.id} className="bg-white border border-neutral-soft rounded-xl overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-white ${
                              hasAccess ? 'bg-accent-success' : 'bg-neutral-medium'
                            }`}>
                              {full.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-neutral-dark">{full}</div>
                              <div className="text-sm text-neutral-medium flex items-center gap-2">
                                {u.email}
                                <span className="w-1 h-1 bg-neutral-medium rounded-full"></span>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                  hasAccess 
                                    ? 'bg-accent-success/10 text-accent-success' 
                                    : 'bg-neutral-medium/10 text-neutral-medium'
                                }`}>
                                  {hasAccess ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                  {hasAccess ? 'Has Access' : 'No Access'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs text-neutral-medium">Tools Enabled</div>
                              <div className={`text-lg font-semibold ${hasAccess ? 'text-accent-success' : 'text-neutral-medium'}`}>
                                {count} / {totals}
                              </div>
                            </div>
                            <button
                              onClick={() => setExpanded((e) => ({ ...e, [u.id]: !e[u.id] }))}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-light border border-neutral-soft rounded-lg hover:bg-primary-light/10 hover:border-primary-medium transition-all duration-200"
                            >
                              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              <span className="text-sm font-medium">{isOpen ? 'Collapse' : 'Configure'}</span>
                            </button>
                          </div>
                        </div>
                        
                        {isOpen && (
                          <div className="mt-4 pt-4 border-t border-neutral-soft">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {CLIENT_TABS.map((tool) => {
                                const merged = { ...defaults, ...(u.tool_permissions || {}) }
                                const enabled = !!merged[tool]
                                return (
                                  <button
                                    key={tool}
                                    onClick={() => setUserOverride(u.id, tool, !enabled)}
                                    className={`rounded-lg border p-3 transition-all duration-200 hover:border-primary-medium ${
                                      enabled 
                                        ? 'bg-primary-light/10 border-primary-light' 
                                        : 'bg-white border-neutral-soft hover:bg-primary-light/5'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {enabled ? (
                                          <CheckCircle2 className="w-4 h-4 text-primary-medium" />
                                        ) : (
                                          <XCircle className="w-4 h-4 text-neutral-medium" />
                                        )}
                                        <span className="font-medium text-neutral-dark text-sm">{tool}</span>
                                      </div>
                                      <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                                        enabled ? 'bg-primary-medium' : 'bg-neutral-soft'
                                      }`}>
                                        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition-transform ${
                                          enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                                        }`} />
                                      </div>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ToolPermissions
