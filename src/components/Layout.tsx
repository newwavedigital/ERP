import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, Outlet, useNavigate, Navigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Package, 
  Warehouse, 
  Calendar, 
  ShoppingCart, 
  CheckCircle, 
  Library, 
  Users, 
  Truck, 
  MessageCircle, 
  Brain,
  LogOut,
  Menu,
  UserCog,
  Settings2,
  Search,
  Bell,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

//

interface Profile {
  first_name: string
  last_name: string
  email: string
  company?: string
  role: string
  tool_permissions?: Record<string, boolean> | null
}

const Layout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, initializing, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [form, setForm] = useState<{ first_name: string; last_name: string; company: string }>(
    { first_name: '', last_name: '', company: '' }
  )

  // Bootstrap/fetch profile once user is known and stable
  useEffect(() => {
    let active = true
    const run = async () => {
      if (initializing) return
      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('first_name,last_name,email,company,role,tool_permissions')
        .eq('id', user.id)
        .single()
      if (!active) return
      setProfile(data || null)
      setLoading(false)
    }
    run()
    return () => { active = false }
  }, [user, initializing])

  const handleSignOut = () => {
    setShowSignOutModal(true)
  }

  // Close dropdown when clicking outside of the menu container
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!userMenuRef.current) return
      if (target && userMenuRef.current.contains(target)) return
      setUserMenuOpen(false)
    }

    if (userMenuOpen) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [userMenuOpen])

  const confirmSignOut = async () => {
    setShowSignOutModal(false)
    await signOut()
    navigate('/login')
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return 'U'
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  // Navigation sections for better organization
  const navigationSections = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Production Management',
      items: [
        { name: 'Products', path: '/admin/products', icon: Package },
        { name: 'Inventory', path: '/admin/inventory', icon: Warehouse },
        { name: 'Production Schedule', path: '/admin/production-schedule', icon: Calendar },
      ]
    },
    {
      title: 'Order Management',
      items: [
        { name: 'Purchase Orders', path: '/admin/purchase-orders', icon: ShoppingCart },
        { name: 'Completed Orders', path: '/admin/completed-orders', icon: CheckCircle },
      ]
    },
    {
      title: 'Business Relations',
      items: [
        { name: 'Customers', path: '/admin/customers', icon: Users },
        { name: 'Suppliers', path: '/admin/suppliers', icon: Truck },
      ]
    },
    {
      title: 'Tools & Analytics',
      items: [
        { name: 'Content Library', path: '/admin/content-library', icon: Library },
        { name: 'Team Chat', path: '/admin/team-chat', icon: MessageCircle },
        { name: 'AI Insights', path: '/admin/ai-insights', icon: Brain },
      ]
    }
  ]

  const isActive = (path: string): boolean => {
    const current = location.pathname || ''
    // Active when exact match or when current path starts with the item's path (for nested pages)
    return current === path || (path !== '/admin' && current.startsWith(path + '/'))
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-neutral-light/50 via-white to-neutral-light/30">
      {initializing && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-50">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-primary-medium border-t-transparent rounded-full animate-spin"></div>
            <span className="text-neutral-dark font-medium">Loading ERP System...</span>
          </div>
        </div>
      )}

      {/* Account Settings Modal */}
      {accountOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setAccountOpen(false); setEditMode(false) }}></div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-neutral-soft overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-soft flex items-center justify-between bg-gradient-to-r from-primary-light/10 to-white">
                <div>
                  <div className="text-xl font-bold text-neutral-dark">Account Settings</div>
                  <div className="text-xs text-neutral-medium">Manage your profile information</div>
                </div>
                <button onClick={() => { setAccountOpen(false); setEditMode(false) }} className="text-neutral-medium hover:text-neutral-dark">✕</button>
              </div>
              {banner && (
                <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm ${banner.kind==='success'?'text-accent-success bg-accent-success/10':'text-accent-danger bg-accent-danger/10'}`}>{banner.msg}</div>
              )}
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-neutral-medium mb-1">First Name</div>
                    {editMode ? (
                      <input value={form.first_name} onChange={(e)=>setForm({ ...form, first_name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-neutral-light border border-neutral-soft focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    ) : (
                      <div className="px-4 py-3 rounded-xl bg-neutral-light border border-neutral-soft text-neutral-dark">{profile?.first_name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-neutral-medium mb-1">Last Name</div>
                    {editMode ? (
                      <input value={form.last_name} onChange={(e)=>setForm({ ...form, last_name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-neutral-light border border-neutral-soft focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    ) : (
                      <div className="px-4 py-3 rounded-xl bg-neutral-light border border-neutral-soft text-neutral-dark">{profile?.last_name || '-'}</div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-neutral-medium mb-1">Company</div>
                    {editMode ? (
                      <input value={form.company} onChange={(e)=>setForm({ ...form, company: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-neutral-light border border-neutral-soft focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    ) : (
                      <div className="px-4 py-3 rounded-xl bg-neutral-light border border-neutral-soft text-neutral-dark">{(profile as any)?.company || '-'}</div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-neutral-medium mb-1">Email</div>
                    <div className="px-4 py-3 rounded-xl bg-neutral-light border border-neutral-soft text-neutral-dark">{profile?.email || user?.email || '-'}</div>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-end gap-3">
                  {!editMode ? (
                    <>
                      <button onClick={() => { setAccountOpen(false); setEditMode(false) }} className="px-4 py-2 rounded-full border border-neutral-soft text-neutral-dark hover:border-primary-light">Close</button>
                      <button onClick={() => setEditMode(true)} className="px-4 py-2 rounded-full bg-primary-medium text-white hover:bg-primary-dark">Edit Profile</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditMode(false); setForm({ first_name: profile?.first_name || '', last_name: profile?.last_name || '', company: (profile as any)?.company || '' }) }} className="px-4 py-2 rounded-full border border-neutral-soft text-neutral-dark hover:border-primary-light">Cancel</button>
                      <button disabled={saving} onClick={async () => {
                        setSaving(true)
                        setBanner(null)
                        try {
                          if (!user?.id) throw new Error('No active session')
                          const { error: upErr } = await supabase
                            .from('profiles')
                            .update({ first_name: form.first_name, last_name: form.last_name, company: form.company })
                            .eq('id', user.id)
                          if (upErr) throw upErr
                          setProfile({ ...(profile||{}), first_name: form.first_name, last_name: form.last_name, company: form.company } as Profile)
                          setBanner({ kind: 'success', msg: 'Profile updated successfully.' })
                          setEditMode(false)
                        } catch (e: any) {
                          setBanner({ kind: 'error', msg: e?.message || 'Update failed.' })
                        } finally {
                          setSaving(false)
                        }
                      }} className="px-4 py-2 rounded-full bg-primary-medium text-white hover:bg-primary-dark disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {!initializing && !user && <Navigate to="/login" replace />}
      {/* Enhanced Professional Sidebar */}
      <div className={`${collapsed ? 'w-20' : 'w-72'} bg-white border-r border-neutral-soft/40 transition-all duration-500 ease-out flex flex-col`}>
        {/* Modern Header Section */}
        <div className={`px-5 py-4 border-b border-neutral-soft/30 ${collapsed ? 'flex flex-col items-center' : 'flex items-center justify-between'} bg-gradient-to-r from-primary-dark/5 via-white to-primary-medium/5`}>
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="relative group">
                <div className="w-11 h-11 bg-gradient-to-br from-primary-dark to-primary-medium rounded-xl flex items-center justify-center shadow-lg ring-1 ring-primary-light/30 group-hover:shadow-xl transition-all duration-300">
                  <LayoutDashboard className="h-5 w-5 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-success rounded-full border-2 border-white shadow-sm animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-dark tracking-tight">ERP System</h1>
                <p className="text-xs text-neutral-medium font-medium">Manufacturing ERP</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="relative group mb-2">
              <div className="w-11 h-11 bg-gradient-to-br from-primary-dark to-primary-medium rounded-xl flex items-center justify-center shadow-lg ring-1 ring-primary-light/30 group-hover:shadow-xl transition-all duration-300">
                <LayoutDashboard className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-success rounded-full border-2 border-white shadow-sm animate-pulse"></div>
            </div>
          )}
          <button
            aria-label="Toggle navigation"
            onClick={() => setCollapsed((v) => !v)}
            className="group inline-flex items-center justify-center h-9 w-9 rounded-lg bg-neutral-light/60 hover:bg-primary-light/20 border border-neutral-soft/50 hover:border-primary-medium/40 transition-all duration-300 hover:scale-105"
          >
            <Menu className="h-4 w-4 text-neutral-medium group-hover:text-primary-medium transition-colors duration-200" />
          </button>
        </div>
        
        {/* Enhanced Professional Navigation Section */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <div className={`${collapsed ? 'px-2' : 'px-3'}`}>
            {/* Render navigation by sections */}
            {navigationSections.map((section, sectionIndex) => {
              const role = String(profile?.role || '').toLowerCase()
              let sectionItems = section.items
              
              // Filter items based on permissions for clients
              if (role !== 'admin' && !initializing && !loading && profile) {
                let perms: Record<string, boolean> = {}
                const raw = (profile?.tool_permissions as any) ?? {}
                if (typeof raw === 'string') {
                  try { perms = JSON.parse(raw) || {} } catch { perms = {} }
                } else if (raw && typeof raw === 'object') {
                  perms = raw as Record<string, boolean>
                }
                sectionItems = section.items.filter((item) => {
                  return Object.prototype.hasOwnProperty.call(perms, item.name)
                    ? !!perms[item.name]
                    : true
                })
              }
              
              // Don't render empty sections
              if (sectionItems.length === 0) return null
              
              return (
                <div key={section.title} className="mb-4">
                  {/* Section Header */}
                  {!collapsed && (
                    <div className="px-2 mb-2">
                      <h3 className="text-xs font-bold text-neutral-medium/80 uppercase tracking-wider">
                        {section.title}
                      </h3>
                      <div className="mt-1 h-px bg-gradient-to-r from-neutral-soft/60 to-transparent"></div>
                    </div>
                  )}
                  
                  {/* Section Items */}
                  <div className="space-y-0.5">
                    {sectionItems.map((item, itemIndex) => {
                      const Icon = item.icon
                      const globalIndex = sectionIndex * 10 + itemIndex
                      return (
                        <div key={item.path} style={{ animationDelay: `${globalIndex * 20}ms` }} className="animate-fade-in">
                          <Link
                            to={item.path}
                            className={`group relative flex items-center ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2'} text-sm font-medium rounded-lg transition-all duration-300 ${
                              isActive(item.path)
                                ? collapsed
                                  ? 'bg-primary-medium text-white shadow-lg scale-105'
                                  : 'bg-primary-medium/10 text-primary-dark border-l-2 border-primary-medium'
                                : 'text-neutral-600 hover:bg-neutral-light/80 hover:text-neutral-dark'
                            }`}
                          >
                            <div className={`relative flex items-center ${collapsed ? '' : 'mr-2.5'}`}>
                              <Icon className={`h-5 w-5 transition-all duration-300 ${
                                isActive(item.path) 
                                  ? collapsed 
                                    ? 'text-white' 
                                    : 'text-primary-medium' 
                                  : 'text-neutral-500 group-hover:text-neutral-700'
                              }`} />
                              {isActive(item.path) && !collapsed && (
                                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary-medium rounded-full animate-pulse"></div>
                              )}
                            </div>
                            {!collapsed && (
                              <div className="flex-1 flex items-center justify-between min-w-0">
                                <span className="font-medium truncate">{item.name}</span>
                                {isActive(item.path) && (
                                  <div className="w-1.5 h-1.5 bg-primary-medium rounded-full ml-2 flex-shrink-0"></div>
                                )}
                              </div>
                            )}
                            {/* Clean hover effect */}
                            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent to-transparent group-hover:from-neutral-light/20 group-hover:to-neutral-light/10 transition-all duration-300"></div>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            
            {/* Admin-only section */}
            {String(profile?.role || '').toLowerCase() === 'admin' && (
              <div className="mb-4">
                {!collapsed && (
                  <div className="px-2 mb-2">
                    <h3 className="text-xs font-bold text-neutral-medium/80 uppercase tracking-wider">
                      Administration
                    </h3>
                    <div className="mt-1 h-px bg-gradient-to-r from-neutral-soft/60 to-transparent"></div>
                  </div>
                )}
                
                <div className="space-y-0.5">
                  {[
                    { name: 'Management Account', path: '/admin/management/user-approvals', icon: UserCog },
                    { name: 'Tool Permissions', path: '/admin/tool-permissions', icon: Settings2 },
                  ].map((item, index) => {
                    const Icon = item.icon
                    return (
                      <div key={item.path} style={{ animationDelay: `${(100 + index) * 20}ms` }} className="animate-fade-in">
                        <Link
                          to={item.path}
                          className={`group relative flex items-center ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2'} text-sm font-medium rounded-lg transition-all duration-300 ${
                            isActive(item.path)
                              ? collapsed
                                ? 'bg-primary-medium text-white shadow-lg scale-105'
                                : 'bg-primary-medium/10 text-primary-dark border-l-2 border-primary-medium'
                              : 'text-neutral-600 hover:bg-neutral-light/80 hover:text-neutral-dark'
                          }`}
                        >
                          <div className={`relative flex items-center ${collapsed ? '' : 'mr-2.5'}`}>
                            <Icon className={`h-5 w-5 transition-all duration-300 ${
                              isActive(item.path) 
                                ? collapsed 
                                  ? 'text-white' 
                                  : 'text-primary-medium' 
                                : 'text-neutral-500 group-hover:text-neutral-700'
                            }`} />
                            {isActive(item.path) && !collapsed && (
                              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary-medium rounded-full animate-pulse"></div>
                            )}
                          </div>
                          {!collapsed && (
                            <div className="flex-1 flex items-center justify-between min-w-0">
                              <span className="font-medium truncate">{item.name}</span>
                              {isActive(item.path) && (
                                <div className="w-1.5 h-1.5 bg-primary-medium rounded-full ml-2 flex-shrink-0"></div>
                              )}
                            </div>
                          )}
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent to-transparent group-hover:from-neutral-light/20 group-hover:to-neutral-light/10 transition-all duration-300"></div>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>

      </div>

      {/* Main content with top header */}
      <div className="flex-1 flex flex-col">
        {/* Enhanced Top Header */}
        <header className="bg-white/95 backdrop-blur-md border-b border-neutral-soft/30 shadow-sm relative z-30">
          <div className="px-8 py-4 flex items-center justify-between">
            <div className="flex items-center flex-1 max-w-3xl">
              {/* Enhanced Search Bar */}
              <div className="relative flex-1 max-w-lg">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-neutral-medium/70" />
                </div>
                <input
                  type="text"
                  placeholder="Search products, orders, customers..."
                  className="w-full pl-12 pr-6 py-3.5 bg-gradient-to-r from-neutral-light/60 to-neutral-light/40 border border-neutral-soft/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-medium/40 focus:border-primary-medium/60 focus:bg-white transition-all duration-300 text-sm font-medium placeholder:text-neutral-medium/70 shadow-inner hover:shadow-md"
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-medium text-neutral-medium/60 bg-neutral-light/80 border border-neutral-soft/50 rounded-md">
                    ⌘K
                  </kbd>
                </div>
              </div>
            </div>
            
            {/* Enhanced Right Section */}
            <div className="flex items-center space-x-2">
              {/* Enhanced Notifications */}
              <div className="relative">
                <button
                  title="Notifications"
                  className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-neutral-light/70 to-white border border-neutral-soft/60 shadow-sm text-neutral-medium hover:text-primary-medium hover:shadow-md hover:border-primary-medium/40 focus:outline-none focus:ring-2 focus:ring-primary-medium/30 transition-all duration-200 group"
                >
                  <Bell className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                  {/* Count Badge */}
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-accent-danger text-white text-[10px] font-bold rounded-full border-2 border-white shadow-md flex items-center justify-center">
                    3
                  </span>
                </button>
              </div>
              
              {/* Enhanced User Profile with Dropdown */}
              <div className="flex items-center space-x-3 pl-4 ml-2 border-l border-neutral-soft/40">
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-3 group cursor-pointer hover:bg-neutral-light/40 rounded-xl p-2 transition-all duration-200"
                  >
                    <div className="flex-shrink-0 relative">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-dark via-primary-medium to-primary-light rounded-xl flex items-center justify-center shadow-lg ring-2 ring-white group-hover:shadow-xl transition-all duration-300">
                        <span className="text-white text-sm font-bold">
                          {loading ? 'U' : getInitials(profile?.first_name, profile?.last_name)}
                        </span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-accent-success border-2 border-white rounded-full shadow-sm">
                        <div className="w-full h-full bg-accent-success rounded-full animate-pulse"></div>
                      </div>
                    </div>
                    <div className="min-w-0 hidden sm:block">
                      <p className="text-sm font-bold text-neutral-dark truncate group-hover:text-primary-dark transition-colors">
                        {loading ? 'Loading...' : profile ? `${profile.first_name} ${profile.last_name}` : 'Admin User'}
                      </p>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-accent-success rounded-full animate-pulse"></div>
                        <p className="text-xs font-medium text-neutral-medium truncate">
                          {loading ? 'Connecting...' : profile ? `${profile.role} • Online` : 'Admin • Online'}
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  {/* User Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-soft/50 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-3 border-b border-neutral-soft/30 bg-gradient-to-r from-neutral-light/20 to-white">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-primary-dark to-primary-medium rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {loading ? 'U' : getInitials(profile?.first_name, profile?.last_name)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-dark truncate">
                              {loading ? 'Loading...' : profile ? `${profile.first_name} ${profile.last_name}` : 'Admin User'}
                            </p>
                            <p className="text-xs text-neutral-medium truncate">
                              {profile?.email || 'admin@example.com'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            setForm({
                              first_name: profile?.first_name || '',
                              last_name: profile?.last_name || '',
                              company: (profile as any)?.company || ''
                            })
                            setBanner(null)
                            setEditMode(false)
                            setAccountOpen(true)
                          }}
                          className="w-full text-left px-4 py-3 text-sm font-medium text-neutral-dark hover:bg-neutral-light/60 transition-colors duration-200 flex items-center space-x-3"
                        >
                          <UserCog className="w-4 h-4 text-neutral-medium" />
                          <span>Account Settings</span>
                        </button>
                        
                        <div className="h-px bg-neutral-soft/50 mx-2 my-1"></div>
                        
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            handleSignOut()
                          }}
                          className="w-full text-left px-4 py-3 text-sm font-medium text-accent-danger hover:bg-accent-danger/10 transition-colors duration-200 flex items-center space-x-3"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-neutral-light/30">
          <Outlet key={location.pathname} />
        </main>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-accent-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="h-8 w-8 text-accent-danger" />
              </div>
              <h3 className="text-xl font-bold text-neutral-dark mb-2">Sign Out</h3>
              <p className="text-neutral-medium mb-6">
                Are you sure you want to sign out of your admin account? You'll need to log in again to access the dashboard.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignOutModal(false)}
                  className="flex-1 px-6 py-3 bg-neutral-light hover:bg-neutral-soft text-neutral-dark font-semibold rounded-full transition-colors duration-200"
                >
                  No, Stay
                </button>
                <button
                  onClick={confirmSignOut}
                  className="flex-1 px-6 py-3 bg-accent-danger hover:bg-accent-danger/90 text-white font-semibold rounded-full transition-colors duration-200"
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Layout
