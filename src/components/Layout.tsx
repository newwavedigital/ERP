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
  Menu,
  Search,
  Bell,
  LogOut,
  UserCog,
  Users,
  Truck, 
  Brain,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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

  const formatRoleName = (role: any) => {
    const r = String(role || '').toLowerCase().trim()
    const mapped = r === 'finance' ? 'procurement' : r
    return mapped
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (initializing || !user) return
    const p = String(location.pathname || '')
    if (!p.startsWith('/admin')) return
    try {
      localStorage.setItem('erp_last_admin_path', p)
    } catch {}
  }, [location.pathname, initializing, user])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  const confirmSignOut = async () => {
    setShowSignOutModal(false)
    await signOut()
    navigate('/login')
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return 'U'
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  // Flat navigation items in specified order
  const navigationItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Production Schedule', path: '/admin/production-schedule', icon: Calendar },
    { name: 'Purchase Orders', path: '/admin/purchase-orders', icon: ShoppingCart },
    { name: 'Supply Chain & Procurement', path: '/admin/supply-chain-procurement', icon: Truck },
    { name: 'Completed Orders', path: '/admin/completed-orders', icon: CheckCircle },
    { name: 'Inventory', path: '/admin/inventory', icon: Warehouse },
    { name: 'Products', path: '/admin/products', icon: Package },
    { name: 'Suppliers', path: '/admin/suppliers', icon: Truck },
    { name: 'Customers', path: '/admin/customers', icon: Users },
    { name: 'Content Library', path: '/admin/content-library', icon: Library },
    { name: 'AI Insights', path: '/admin/ai-insights', icon: Brain },
  ]

  const isActive = (path: string): boolean => {
    const current = location.pathname || ''
    // Active when exact match or when current path starts with the item's path (for nested pages)
    return current === path || (path !== '/admin' && current.startsWith(path + '/'))
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-neutral-light/50 via-white to-neutral-light/30 overflow-hidden">
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
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
        </div>
      )}
      
      {/* Enhanced Professional Sidebar - Desktop Only */}
      <div className={`${
        // Desktop behavior
        collapsed ? 'w-20' : 'w-72'
      } hidden lg:flex bg-white border-r border-neutral-soft/40 transition-all duration-500 ease-out flex-col`}>
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
                <h1 className="text-xl font-bold text-neutral-dark tracking-tight">Nut House Co-Packing</h1>
                <p className="text-xs text-neutral-medium font-medium">ERP System</p>
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
            {/* Render flat navigation items */}
            {(() => {
              if (initializing || loading || !profile) {
                return (
                  <div className="space-y-2 animate-pulse">
                    <div className={`h-10 ${collapsed ? 'w-10 mx-auto' : 'w-full'} bg-neutral-light/70 rounded-lg`} />
                    <div className={`h-10 ${collapsed ? 'w-10 mx-auto' : 'w-full'} bg-neutral-light/70 rounded-lg`} />
                    <div className={`h-10 ${collapsed ? 'w-10 mx-auto' : 'w-full'} bg-neutral-light/70 rounded-lg`} />
                  </div>
                )
              }

              const role = String(profile?.role || '').toLowerCase()
              let filteredItems = navigationItems
              
              // Filter items based on role-specific access
              if (role === 'procurement' || role === 'finance') {
                // Procurement and Finance roles can only see specific pages
                const allowedPages = [
                  'Supply Chain & Procurement',
                  'Inventory', 
                  'Production Schedule', // view-only
                  'Purchase Orders',
                  'Customers',
                  'Suppliers', // vendors
                  // Note: Shipping not in current navigationItems, would need to be added
                ]
                filteredItems = navigationItems.filter((item) => 
                  allowedPages.includes(item.name)
                )
              } else if (role === 'supply_chain_procurement') {
                // Supply Chain – Procurement (view-only)
                const allowedPages = [
                  'Supply Chain & Procurement',
                  'Inventory',
                  'Production Schedule',
                  'Purchase Orders',
                  'Customers',
                  'Suppliers',
                ]
                filteredItems = navigationItems.filter((item) => allowedPages.includes(item.name))
              } else if (role === 'warehouse') {
                // Warehouse – Inventory, Production Schedule (view-only), Purchase Orders
                const allowedPages = [
                  'Supply Chain & Procurement',
                  'Inventory',
                  'Production Schedule',
                  'Purchase Orders',
                ]
                filteredItems = navigationItems.filter((item) => allowedPages.includes(item.name))
              } else if (role === 'production_manager') {
                // Production – Production Schedule, Purchase Orders
                const allowedPages = [
                  'Production Schedule',
                  'Purchase Orders',
                ]
                filteredItems = navigationItems.filter((item) => allowedPages.includes(item.name))
              } else if (role === 'sales_representative') {
                const allowedPages = [
                  'Dashboard',
                  'Production Schedule',
                  'Purchase Orders',
                  'Completed Orders',
                  'Supply Chain & Procurement',
                  'Inventory',
                  'Products',
                  'Suppliers',
                  'Customers',
                  'Content Library',
                  'AI Insights',
                ]
                filteredItems = navigationItems.filter((item) => allowedPages.includes(item.name))
              } else if (role !== 'admin' && !initializing && !loading && profile) {
                // Other non-admin roles use tool_permissions
                let perms: Record<string, boolean> = {}
                const raw = (profile?.tool_permissions as any) ?? {}
                if (typeof raw === 'string') {
                  try { perms = JSON.parse(raw) || {} } catch { perms = {} }
                } else if (raw && typeof raw === 'object') {
                  perms = raw as Record<string, boolean>
                }
                filteredItems = navigationItems.filter((item) => {
                  return Object.prototype.hasOwnProperty.call(perms, item.name)
                    ? !!perms[item.name]
                    : true
                })
              }
              
              return (
                <div className="space-y-0.5">
                  {filteredItems.map((item, itemIndex) => {
                    const Icon = item.icon
                    return (
                      <div key={item.path} style={{ animationDelay: `${itemIndex * 20}ms` }} className="animate-fade-in">
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
              )
            })()}
            
            {/* Admin-only section */}
            {String(profile?.role || '').toLowerCase() === 'admin' && (
              <div className="mt-4 pt-4 border-t border-neutral-soft/30">
                <div className="space-y-0.5">
                  {[
                    { name: 'Account Management', path: '/admin/management/users', icon: UserCog },
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
      
      {/* Mobile Sidebar */}
      <div className={`${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-neutral-soft/40 transition-transform duration-300 ease-out flex flex-col lg:hidden`}>
        {/* Mobile Header */}
        <div className="px-5 py-4 border-b border-neutral-soft/30 flex items-center justify-between bg-gradient-to-r from-primary-dark/5 via-white to-primary-medium/5">
          <div className="flex items-center space-x-3">
            <div className="relative group">
              <div className="w-11 h-11 bg-gradient-to-br from-primary-dark to-primary-medium rounded-xl flex items-center justify-center shadow-lg ring-1 ring-primary-light/30 group-hover:shadow-xl transition-all duration-300">
                <LayoutDashboard className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-success rounded-full border-2 border-white shadow-sm animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-dark tracking-tight">Nut House Co-Packing</h1>
              <p className="text-xs text-neutral-medium font-medium">ERP System</p>
            </div>
          </div>
          <button
            aria-label="Close mobile menu"
            onClick={() => setMobileMenuOpen(false)}
            className="group inline-flex items-center justify-center h-9 w-9 rounded-lg bg-neutral-light/60 hover:bg-primary-light/20 border border-neutral-soft/50 hover:border-primary-medium/40 transition-all duration-300 hover:scale-105"
          >
            <Menu className="h-4 w-4 text-neutral-medium group-hover:text-primary-medium transition-colors duration-200" />
          </button>
        </div>
        
        {/* Mobile Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <div className="px-3">
            {(() => {
              if (initializing || loading || !profile) {
                return (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-10 w-full bg-neutral-light/70 rounded-lg" />
                    <div className="h-10 w-full bg-neutral-light/70 rounded-lg" />
                    <div className="h-10 w-full bg-neutral-light/70 rounded-lg" />
                  </div>
                )
              }

              const role = String(profile?.role || '').toLowerCase()
              let filteredItems = navigationItems
              
              // Filter items based on role-specific access
              if (role === 'procurement' || role === 'finance') {
                // Procurement and Finance roles can only see specific pages
                const allowedPages = [
                  'Supply Chain & Procurement',
                  'Inventory', 
                  'Production Schedule', // view-only
                  'Purchase Orders',
                  'Customers',
                  'Suppliers', // vendors
                  // Note: Shipping not in current navigationItems, would need to be added
                ]
                filteredItems = navigationItems.filter((item) => 
                  allowedPages.includes(item.name)
                )
              } else if (role === 'supply_chain_procurement') {
                // Supply Chain – Procurement (view-only)
                const allowedPages = [
                  'Supply Chain & Procurement',
                  'Inventory',
                  'Production Schedule',
                  'Purchase Orders',
                  'Customers',
                  'Suppliers',
                ]
                filteredItems = navigationItems.filter((item) => allowedPages.includes(item.name))
              } else if (role === 'warehouse') {
                // Warehouse – Inventory, Production Schedule (view-only), Purchase Orders
                const allowedPages = [
                  'Supply Chain & Procurement',
                  'Inventory',
                  'Production Schedule',
                  'Purchase Orders',
                ]
                filteredItems = navigationItems.filter((item) => allowedPages.includes(item.name))
              } else if (role === 'production_manager') {
                // Production – Production Schedule, Purchase Orders
                const allowedPages = [
                  'Production Schedule',
                  'Purchase Orders',
                ]
                filteredItems = navigationItems.filter((item) => allowedPages.includes(item.name))
              } else if (role === 'sales_representative') {
                const allowedPages = [
                  'Dashboard',
                  'Production Schedule',
                  'Purchase Orders',
                  'Completed Orders',
                  'Supply Chain & Procurement',
                  'Inventory',
                  'Products',
                  'Suppliers',
                  'Customers',
                  'Content Library',
                  'AI Insights',
                ]
                filteredItems = navigationItems.filter((item) => allowedPages.includes(item.name))
              } else if (role !== 'admin' && !initializing && !loading && profile) {
                // Other non-admin roles use tool_permissions
                let perms: Record<string, boolean> = {}
                const raw = (profile?.tool_permissions as any) ?? {}
                if (typeof raw === 'string') {
                  try { perms = JSON.parse(raw) || {} } catch { perms = {} }
                } else if (raw && typeof raw === 'object') {
                  perms = raw as Record<string, boolean>
                }
                filteredItems = navigationItems.filter((item) => {
                  return Object.prototype.hasOwnProperty.call(perms, item.name)
                    ? !!perms[item.name]
                    : true
                })
              }
              
              return (
                <div className="space-y-0.5">
                  {filteredItems.map((item, itemIndex) => {
                    const Icon = item.icon
                    return (
                      <div key={item.path} style={{ animationDelay: `${itemIndex * 20}ms` }} className="animate-fade-in">
                        <Link
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`group relative flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                            isActive(item.path)
                              ? 'bg-primary-medium/10 text-primary-dark border-l-2 border-primary-medium'
                              : 'text-neutral-600 hover:bg-neutral-light/80 hover:text-neutral-dark'
                          }`}
                        >
                          <div className="relative flex items-center mr-2.5">
                            <Icon className={`h-5 w-5 transition-all duration-300 ${
                              isActive(item.path) 
                                ? 'text-primary-medium' 
                                : 'text-neutral-500 group-hover:text-neutral-700'
                            }`} />
                            {isActive(item.path) && (
                              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary-medium rounded-full animate-pulse"></div>
                            )}
                          </div>
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className="font-medium truncate">{item.name}</span>
                            {isActive(item.path) && (
                              <div className="w-1.5 h-1.5 bg-primary-medium rounded-full ml-2 flex-shrink-0"></div>
                            )}
                          </div>
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent to-transparent group-hover:from-neutral-light/20 group-hover:to-neutral-light/10 transition-all duration-300"></div>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            
            {/* Admin-only section for mobile */}
            {String(profile?.role || '').toLowerCase() === 'admin' && (
              <div className="mt-4 pt-4 border-t border-neutral-soft/30">
                <div className="space-y-0.5">
                  {[
                    { name: 'Account Management', path: '/admin/management/users', icon: UserCog },
                  ].map((item, index) => {
                    const Icon = item.icon
                    return (
                      <div key={item.path} style={{ animationDelay: `${(100 + index) * 20}ms` }} className="animate-fade-in">
                        <Link
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`group relative flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                            isActive(item.path)
                              ? 'bg-primary-medium/10 text-primary-dark border-l-2 border-primary-medium'
                              : 'text-neutral-600 hover:bg-neutral-light/80 hover:text-neutral-dark'
                          }`}
                        >
                          <div className="relative flex items-center mr-2.5">
                            <Icon className={`h-5 w-5 transition-all duration-300 ${
                              isActive(item.path) 
                                ? 'text-primary-medium' 
                                : 'text-neutral-500 group-hover:text-neutral-700'
                            }`} />
                            {isActive(item.path) && (
                              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary-medium rounded-full animate-pulse"></div>
                            )}
                          </div>
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className="font-medium truncate">{item.name}</span>
                            {isActive(item.path) && (
                              <div className="w-1.5 h-1.5 bg-primary-medium rounded-full ml-2 flex-shrink-0"></div>
                            )}
                          </div>
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Enhanced Top Header */}
        <header className="bg-white/95 backdrop-blur-md border-b border-neutral-soft/30 shadow-sm relative z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
            {/* Mobile hamburger menu */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-neutral-light/70 to-white border border-neutral-soft/60 shadow-sm text-neutral-medium hover:text-primary-medium hover:shadow-md hover:border-primary-medium/40 focus:outline-none focus:ring-2 focus:ring-primary-medium/30 transition-all duration-200 group"
            >
              <Menu className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
            </button>
            
            <div className="flex items-center flex-1 max-w-3xl ml-4 lg:ml-0">
              {/* Enhanced Search Bar */}
              <div className="relative flex-1 max-w-lg">
                <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-medium/70" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 sm:pl-12 pr-4 sm:pr-6 py-2.5 sm:py-3.5 bg-gradient-to-r from-neutral-light/60 to-neutral-light/40 border border-neutral-soft/60 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-medium/40 focus:border-primary-medium/60 focus:bg-white transition-all duration-300 text-sm font-medium placeholder:text-neutral-medium/70 shadow-inner hover:shadow-md"
                />
                <div className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center">
                  <kbd className="hidden md:inline-flex items-center px-2 py-1 text-xs font-medium text-neutral-medium/60 bg-neutral-light/80 border border-neutral-soft/50 rounded-md">
                    ⌘K
                  </kbd>
                </div>
              </div>
            </div>
            
            {/* Enhanced Right Section */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Enhanced Notifications */}
              <div className="relative hidden sm:block">
                <button
                  title="Notifications"
                  className="relative inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-neutral-light/70 to-white border border-neutral-soft/60 shadow-sm text-neutral-medium hover:text-primary-medium hover:shadow-md hover:border-primary-medium/40 focus:outline-none focus:ring-2 focus:ring-primary-medium/30 transition-all duration-200 group"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-200" />
                  {/* Count Badge */}
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 bg-accent-danger text-white text-[9px] sm:text-[10px] font-bold rounded-full border-2 border-white shadow-md flex items-center justify-center">
                    3
                  </span>
                </button>
              </div>
              
              {/* Enhanced User Profile with Dropdown */}
              <div className="flex items-center space-x-2 sm:space-x-3 pl-2 sm:pl-4 ml-1 sm:ml-2 border-l border-neutral-soft/40">
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 sm:space-x-3 group cursor-pointer hover:bg-neutral-light/40 rounded-xl p-1.5 sm:p-2 transition-all duration-200"
                  >
                    <div className="flex-shrink-0 relative">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary-dark via-primary-medium to-primary-light rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg ring-2 ring-white group-hover:shadow-xl transition-all duration-300">
                        <span className="text-white text-xs sm:text-sm font-bold">
                          {loading ? 'U' : getInitials(profile?.first_name, profile?.last_name)}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0 hidden md:block">
                      <p className="text-sm font-bold text-neutral-dark truncate group-hover:text-primary-dark transition-colors">
                        {loading ? 'Loading...' : profile ? `${profile.first_name} ${profile.last_name}` : 'Admin User'}
                      </p>
                      <div className="flex items-center space-x-2">
                        <p className="text-xs font-medium text-neutral-medium truncate">
                          {loading ? 'Connecting...' : profile ? `${formatRoleName(profile.role)} • Online` : 'Admin • Online'}
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
