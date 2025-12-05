import React, { useEffect, useState } from 'react'
import { CheckCircle, Package, Layers, ShoppingCart, Factory, BarChart3, Shield, Search, UserCircle, Truck, ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PublicHome: React.FC = () => {
  const navigate = useNavigate()
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [form, setForm] = useState<{ first_name: string; last_name: string; company: string }>({ first_name: '', last_name: '', company: '' })
  const [accountDeleted, setAccountDeleted] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    let mounted = true
    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        const { data: p, error: perr } = await supabase
          .from('profiles')
          .select('first_name,last_name,company,role,email')
          .eq('id', data.session.user.id)
          .single()
        if (!mounted) return
        setProfile(p || null)
        setAccountDeleted(!!data.session?.user && (!p || !!perr))
      }
    }
    init()
    const sub = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess)
      if (sess?.user) {
        const { data: p, error: perr } = await supabase
          .from('profiles')
          .select('first_name,last_name,company,role,email')
          .eq('id', sess.user.id)
          .single()
        setProfile(p || null)
        setAccountDeleted(!!sess.user && (!p || !!perr))
      } else {
        setProfile(null)
        setAccountDeleted(false)
      }
    })
    return () => {
      mounted = false
      sub.data.subscription.unsubscribe()
    }
  }, [])

  // Close Account modal with ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSignOut = () => {
    setShowSignOutModal(true)
  }

  const confirmSignOut = async () => {
    setShowSignOutModal(false)
    setRedirecting(true)
    try {
      // Clear local state immediately
      setSession(null)
      setProfile(null)
      setAccountDeleted(false)

      // Clear localStorage
      try { localStorage.removeItem('erp_pending_profile') } catch {}

      // Sign out from Supabase (fire and forget)
      supabase.auth.signOut().catch(() => {})

      // Navigate directly to login without flashing Guest UI
      window.location.replace(`${window.location.origin}/#/login`)
    } catch (error) {
      console.error('Sign out error:', error)
      window.location.replace(`${window.location.origin}/#/login`)
    }
  }

  const liteFeatures = [
    { icon: Package, title: 'Finished Goods Viewer', desc: 'Browse sample finished goods and availability snapshots.' },
    { icon: Layers, title: 'Raw Materials Catalog', desc: 'See example material specs, FEFO dates, and batches.' },
    { icon: ShoppingCart, title: 'Purchasing Showcase', desc: 'Preview PO tracking and supplier performance dashboards.' },
    { icon: Factory, title: 'Production Timeline', desc: 'Explore a sample production schedule and WIP stages.' },
    { icon: BarChart3, title: 'Analytics Preview', desc: 'View read-only KPIs and sample allocation insights.' },
    { icon: Shield, title: 'Role-based Access', desc: 'Client view is read-only. Create an account to unlock actions.' },
  ]

  const [query, setQuery] = useState('')

  const catalog = [
    { id: 'FG-1001', name: 'Premium Sauce 500ml', price: 149, status: 'In Stock', img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1600&auto=format&fit=crop' },
    { id: 'FG-1002', name: 'Spice Mix 250g', price: 99, status: 'Low Stock', img: 'https://images.unsplash.com/photo-1585386959984-a4155223165f?q=80&w=1600&auto=format&fit=crop' },
    { id: 'FG-1003', name: 'Gourmet Oil 1L', price: 199, status: 'In Production', img: 'https://images.unsplash.com/photo-1604908176997-4296a9d3a227?q=80&w=1600&auto=format&fit=crop' },
    { id: 'FG-1004', name: 'Organic Jam 300g', price: 129, status: 'In Stock', img: 'https://images.unsplash.com/photo-1596040033229-162ddea20adf?q=80&w=1600&auto=format&fit=crop' },
  ]

  const filtered = catalog.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.id.toLowerCase().includes(query.toLowerCase()))

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-light">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-medium border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-medium">Signing out…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-light to-white">
      {/* Full-screen account deleted notice */}
      {accountDeleted ? (
        <div className="min-h-screen flex items-center justify-center bg-neutral-soft px-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-soft overflow-hidden">
            <div className="px-8 py-6 border-b border-neutral-soft bg-gradient-to-r from-accent-danger/10 to-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent-danger/20 text-accent-danger flex items-center justify-center">
                  <UserCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xl font-bold text-neutral-dark">Your account has been removed</div>
                  <div className="text-sm text-neutral-medium">Access to ERP System has been revoked</div>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="text-neutral-medium leading-relaxed">
                <p className="mb-4">Your account access has been terminated for one of the following reasons:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-danger mt-2 flex-shrink-0"></span>
                    <span><strong>Administrative action:</strong> Account removed by system administrator</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-danger mt-2 flex-shrink-0"></span>
                    <span><strong>Policy violation:</strong> Account under review for terms of service compliance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-danger mt-2 flex-shrink-0"></span>
                    <span><strong>Account consolidation:</strong> Duplicate or merged account cleanup</span>
                  </li>
                </ul>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => navigate('/login')} className="bg-primary-medium hover:bg-primary-dark text-white px-6 py-3 rounded-full font-semibold">
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-neutral-soft">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 mr-2">
            <div className="w-10 h-10 rounded-lg bg-primary-medium flex items-center justify-center text-white font-bold">ERP</div>
            <span className="text-neutral-dark font-semibold">Client Home</span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-medium">
            <button onClick={() => navigate('/home/catalog')} className="hover:text-primary-medium">Catalog</button>
            <button onClick={() => navigate('/home/purchasing')} className="hover:text-primary-medium">Purchasing</button>
            <button onClick={() => navigate('/home/explore')} className="hover:text-primary-medium">Explore</button>
          </nav>

          {/* Search */}
          <div className="ml-auto flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-medium absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search finished goods..."
                className="w-full pl-9 pr-4 py-2 rounded-full bg-neutral-light border border-neutral-soft text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
          </div>

          {/* Account */}
          <div className="flex items-center gap-2">
            {session?.user ? (
              <>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(v => !v)}
                    className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-neutral-dark rounded-full border border-neutral-soft hover:border-primary-light"
                  >
                    <UserCircle className="w-5 h-5" /> {accountDeleted ? 'Client' : (profile?.first_name ? `${profile.first_name}` : (profile?.email || 'Client'))}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-neutral-soft rounded-xl shadow-xl overflow-hidden z-40">
                      {accountDeleted ? (
                        <button
                          className="w-full text-left px-4 py-3 text-sm text-accent-danger hover:bg-accent-danger/10"
                          onClick={() => { setMenuOpen(false); handleSignOut() }}
                        >
                          Sign Out
                        </button>
                      ) : (
                        <>
                          <button
                            className="w-full text-left px-4 py-3 text-sm hover:bg-neutral-light"
                            onClick={() => {
                              setMenuOpen(false)
                              setForm({
                                first_name: profile?.first_name || '',
                                last_name: profile?.last_name || '',
                                company: profile?.company || '',
                              })
                              setBanner(null)
                              setEditMode(false)
                              setAccountOpen(true)
                            }}
                          >
                            Account Settings
                          </button>
                          <div className="h-px bg-neutral-soft" />
                          <button
                            className="w-full text-left px-4 py-3 text-sm text-accent-danger hover:bg-accent-danger/10"
                            onClick={() => { setMenuOpen(false); handleSignOut() }}
                          >
                            Sign Out
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button title="Read-only client view" className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-neutral-medium rounded-full border border-neutral-soft">
                  <UserCircle className="w-5 h-5" /> Guest
                </button>
                <button onClick={() => navigate('/login')} className="text-neutral-medium hover:text-primary-medium">Sign In</button>
                <button onClick={() => navigate('/login')} className="bg-primary-medium hover:bg-primary-dark text-white px-4 py-2 rounded-full">Create Account</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Account deleted notice */}
      {accountDeleted && (
        <div className="bg-accent-danger/10 border border-accent-danger/30 text-accent-danger mx-auto mt-4 mb-0 rounded-xl max-w-7xl px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-semibold">Your account has been removed</div>
              <div className="text-sm text-accent-danger/90 mt-1">
                Possible reasons: admin-initiated deletion, policy violation review, or account consolidation. You can sign in again or create a new account with the same email.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSignOut} className="bg-primary-medium hover:bg-primary-dark text-white px-4 py-2 rounded-full">Go to Login</button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="py-16 bg-gradient-to-br from-primary-light/10 via-white to-neutral-light">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-dark leading-tight">
              Explore ERP in Read‑Only Mode
            </h1>
            <p className="mt-4 text-lg text-neutral-medium">
              This client view lets you experience the ERP interface with sample data. It’s free to browse – no account required. Upgrade anytime to enable editing, approvals, and integrations.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button onClick={() => document.getElementById('viewer')?.scrollIntoView({behavior:'smooth'})} className="bg-primary-medium hover:bg-primary-dark text-white px-6 py-3 rounded-full">Start Viewing</button>
              <button onClick={() => navigate('/login')} className="border border-neutral-soft hover:border-primary-medium text-neutral-dark px-6 py-3 rounded-full">Sign Up to Unlock</button>
            </div>
            <div className="mt-4 text-sm text-neutral-medium flex items-center gap-3">
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent-success"/>No credit card</span>
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent-success"/>14‑day trial</span>
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent-success"/>Cancel anytime</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary-medium/10 to-primary-light/10">
                <div className="text-sm text-neutral-medium">Allocatable Units</div>
                <div className="text-3xl font-bold text-neutral-dark">1,240</div>
                <div className="text-xs text-accent-success mt-1">+6% this week</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-accent-success/10 to-accent-success/5">
                <div className="text-sm text-neutral-medium">On-Time POs</div>
                <div className="text-3xl font-bold text-neutral-dark">92%</div>
                <div className="text-xs text-neutral-medium mt-1">across 24 suppliers</div>
              </div>
              <div className="col-span-2 p-4 rounded-xl bg-neutral-light">
                <div className="text-sm text-neutral-medium mb-2">This is a read-only preview. Take a tour below.</div>
                <div className="w-full h-2 rounded-full bg-neutral-soft">
                  <div className="h-2 rounded-full bg-primary-medium w-1/2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            <button onClick={()=>navigate('/home/catalog')} className="text-left bg-white rounded-2xl border border-neutral-soft p-6 hover:shadow-xl transition-all">
              <div className="text-xs font-semibold text-primary-medium mb-2">Start here</div>
              <div className="text-xl font-bold text-neutral-dark mb-1">Browse Catalog</div>
              <div className="text-neutral-medium text-sm">See finished goods with pricing and availability.</div>
            </button>
            <button onClick={()=>navigate('/home/purchasing')} className="text-left bg-white rounded-2xl border border-neutral-soft p-6 hover:shadow-xl transition-all">
              <div className="text-xs font-semibold text-primary-medium mb-2">Suppliers</div>
              <div className="text-xl font-bold text-neutral-dark mb-1">Purchasing Overview</div>
              <div className="text-neutral-medium text-sm">PO timeline, budget, and supplier scorecards.</div>
            </button>
            <button onClick={()=>navigate('/home/explore')} className="text-left bg-white rounded-2xl border border-neutral-soft p-6 hover:shadow-xl transition-all">
              <div className="text-xs font-semibold text-primary-medium mb-2">Tour</div>
              <div className="text-xl font-bold text-neutral-dark mb-1">Explore the System</div>
              <div className="text-neutral-medium text-sm">Guided journey across RM → Production → FG.</div>
            </button>
          </div>
        </div>
      </section>

      {/* Sample Catalog (read-only) */}
      <section id="catalog" className="py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-neutral-dark">Sample Catalog</h2>
            <div className="text-sm text-neutral-medium">Read‑only preview</div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-neutral-soft overflow-hidden hover:shadow-xl transition-all">
                <img src={item.img} alt={item.name} className="w-full h-36 object-cover" />
                <div className="p-4">
                  <div className="text-xs text-neutral-medium mb-1">{item.id}</div>
                  <div className="font-semibold text-neutral-dark">{item.name}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-primary-medium font-semibold">₱{item.price}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'In Stock' ? 'bg-accent-success/10 text-accent-success' : item.status === 'Low Stock' ? 'bg-accent-warning/10 text-accent-warning' : 'bg-primary-light/10 text-primary-medium'}`}>{item.status}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button title="Read-only in client view" className="flex-1 bg-neutral-light text-neutral-medium px-3 py-2 rounded-full cursor-not-allowed">Add to Cart</button>
                    <button onClick={() => document.getElementById('purchasing')?.scrollIntoView({behavior:'smooth'})} className="px-3 py-2 rounded-full border border-neutral-soft text-neutral-dark hover:border-primary-light">Details</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Purchasing Showcase */}
      <section id="purchasing" className="py-14 bg-neutral-light/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-neutral-dark">Purchasing Showcase</h2>
            <div className="text-sm text-neutral-medium">Read‑only preview</div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Timeline Card */}
            <div className="bg-white rounded-2xl border border-neutral-soft p-6">
              <div className="flex items-center gap-2 mb-4 text-neutral-dark font-semibold"><ClipboardList className="w-5 h-5"/>Recent POs</div>
              <div className="space-y-4">
                {[
                  { id: 'PO-4421', vendor: 'ABC Foods', status: 'Approved', eta: 'Dec 15' },
                  { id: 'PO-4422', vendor: 'Quality Jars Co', status: 'Pending', eta: 'Dec 20' },
                  { id: 'PO-4423', vendor: 'Spice Partners', status: 'Received', eta: 'Dec 02' },
                ].map((po,i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-2 h-2 mt-2 rounded-full ${po.status==='Approved'?'bg-primary-medium':po.status==='Received'?'bg-accent-success':'bg-accent-warning'}`}></div>
                    <div>
                      <div className="font-medium text-neutral-dark">{po.id} • {po.vendor}</div>
                      <div className="text-xs text-neutral-medium">Status: {po.status} • ETA {po.eta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier scorecard */}
            <div className="bg-white rounded-2xl border border-neutral-soft p-6">
              <div className="flex items-center gap-2 mb-4 text-neutral-dark font-semibold"><Truck className="w-5 h-5"/>Supplier Scorecard</div>
              <div className="space-y-3">
                {[
                  { name: 'ABC Foods', score: 92 },
                  { name: 'Quality Jars Co', score: 84 },
                  { name: 'Spice Partners', score: 88 },
                ].map((s,i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-dark">{s.name}</span>
                      <span className="font-semibold text-primary-medium">{s.score}</span>
                    </div>
                    <div className="w-full h-2 bg-neutral-soft rounded-full mt-1">
                      <div className="h-2 rounded-full bg-primary-medium" style={{width: `${s.score}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Read-only actions */}
            <div className="bg-white rounded-2xl border border-neutral-soft p-6">
              <div className="text-neutral-dark font-semibold mb-4">Quick Actions</div>
              <div className="space-y-3">
                <button title="Read-only in client view" className="w-full px-4 py-3 rounded-full bg-neutral-light text-neutral-medium cursor-not-allowed text-left">Create Purchase Order</button>
                <button title="Read-only in client view" className="w-full px-4 py-3 rounded-full bg-neutral-light text-neutral-medium cursor-not-allowed text-left">Request Supplier Quote</button>
                <button onClick={() => navigate('/login')} className="w-full px-4 py-3 rounded-full bg-primary-medium hover:bg-primary-dark text-white text-left">Sign In to Perform Actions</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Viewer Sections */}
      <section id="viewer" className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-neutral-dark mb-6">What you can explore</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {liteFeatures.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-neutral-soft hover:shadow-xl transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary-medium/10 text-primary-medium flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6" />
                </div>
                <div className="font-semibold text-neutral-dark mb-1">{f.title}</div>
                <div className="text-neutral-medium text-sm">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 bg-gradient-to-r from-primary-dark to-primary-medium rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Ready to use ERP with your data?</div>
              <div className="text-white/80 text-sm">Create an account to enable editing, approvals, and integrations.</div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/login')} className="bg-white text-primary-dark px-5 py-3 rounded-full font-semibold hover:bg-neutral-light">Create Account</button>
              <button onClick={() => navigate('/landing')} className="bg-white/10 hover:bg-white/20 px-5 py-3 rounded-full">Back to Landing</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-neutral-soft bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary-medium text-white flex items-center justify-center font-bold">ERP</div>
                <div className="font-semibold text-neutral-dark">ERP System</div>
              </div>
              <p className="text-neutral-medium">Professional ERP preview for clients and end‑users.</p>
            </div>
            <div>
              <div className="font-semibold text-neutral-dark mb-3">Product</div>
              <ul className="space-y-2 text-neutral-medium">
                <li><button onClick={()=>navigate('/home/catalog')} className="hover:text-primary-medium">Catalog</button></li>
                <li><button onClick={()=>navigate('/home/purchasing')} className="hover:text-primary-medium">Purchasing</button></li>
                <li><button onClick={()=>navigate('/home/explore')} className="hover:text-primary-medium">Explore</button></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-neutral-dark mb-3">Company</div>
              <ul className="space-y-2 text-neutral-medium">
                <li><a className="hover:text-primary-medium">About</a></li>
                <li><a className="hover:text-primary-medium">Careers</a></li>
                <li><a className="hover:text-primary-medium">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 text-xs text-neutral-medium">© 2025 ERP System. Read‑only preview.</div>
        </div>
      </footer>

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
                      <div className="px-4 py-3 rounded-xl bg-neutral-light border border-neutral-soft text-neutral-dark">{profile?.company || '-'}</div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-neutral-medium mb-1">Email</div>
                    <div className="px-4 py-3 rounded-xl bg-neutral-light border border-neutral-soft text-neutral-dark">{profile?.email || session?.user?.email || '-'}</div>
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
                      <button onClick={() => { setEditMode(false); setForm({ first_name: profile?.first_name || '', last_name: profile?.last_name || '', company: profile?.company || '' }) }} className="px-4 py-2 rounded-full border border-neutral-soft text-neutral-dark hover:border-primary-light">Cancel</button>
                      <button disabled={saving} onClick={async () => {
                        setSaving(true)
                        setBanner(null)
                        try {
                          if (!session?.user?.id) throw new Error('No active session')
                          const { error: upErr } = await supabase
                            .from('profiles')
                            .update({ first_name: form.first_name, last_name: form.last_name, company: form.company })
                            .eq('id', session.user.id)
                          if (upErr) throw upErr
                          setProfile({ ...(profile||{}), first_name: form.first_name, last_name: form.last_name, company: form.company })
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
        </>
      )}

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-accent-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCircle className="h-8 w-8 text-accent-danger" />
              </div>
              <h3 className="text-xl font-bold text-neutral-dark mb-2">Sign Out</h3>
              <p className="text-neutral-medium mb-6">
                Are you sure you want to sign out of your account? You'll need to log in again to access your profile and settings.
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

export default PublicHome
