import React, { useMemo, useState } from 'react'
import { Search, Filter, CheckCircle, Download, Package, DollarSign, TrendingUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface CompletedOrder {
  id: string
  orderNumber: string
  customer: string
  product: string
  quantity: number
  completedDate: string
  deliveryDate: string
  total: number
  status: string
  poDate?: string
  shipDate?: string
  location?: string
  paymentTerms?: string
  depositPaid?: boolean
  is_copack?: boolean
}
//dfsafsafsa
const CompletedOrders: React.FC = () => {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const isSalesRepViewOnly = String(currentUserRole || '').toLowerCase() === 'sales_representative'

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'copack' | 'brand'>('brand')

  const STICKY_COMPLETED_KEY = 'erp.completed_orders.sticky_po_ids'

  const readStickyCompletedIds = () => {
    try {
      const raw = localStorage.getItem(STICKY_COMPLETED_KEY)
      const arr = raw ? JSON.parse(raw) : []
      return new Set<string>(Array.isArray(arr) ? arr.map((v) => String(v)) : [])
    } catch {
      return new Set<string>()
    }
  }

  const writeStickyCompletedIds = (ids: Set<string>) => {
    try {
      localStorage.setItem(STICKY_COMPLETED_KEY, JSON.stringify(Array.from(ids)))
    } catch {}
  }

  React.useEffect(() => {
    let active = true
    const loadRole = async () => {
      try {
        if (!user?.id) return
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if (!active) return
        setCurrentUserRole((data as any)?.role ? String((data as any).role) : null)
      } catch {
        if (!active) return
        setCurrentUserRole(null)
      }
    }
    loadRole()
    return () => { active = false }
  }, [user?.id])

  React.useEffect(() => {
    let active = true
    const normalizeStatus = (raw: any) => String(raw || '').trim().toLowerCase()
    const labelStatus = (raw: any) => {
      const s = normalizeStatus(raw)
      if (s === 'completed') return 'Ready to Ship'
      if (s === 'ready_to_ship' || s === 'ready to ship') return 'Ready to Ship'
      if (s === 'partially_shipped' || s === 'partial') return 'Partially Shipped'
      if (s === 'shipped') return 'Shipped'
      if (!s) return '—'
      return String(raw)
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    }

    const fmt = (d: any) => {
      const v = String(d || '').trim()
      if (!v) return ''
      try {
        const dt = new Date(v)
        if (Number.isNaN(dt.getTime())) return v
        return dt.toLocaleDateString()
      } catch {
        return v
      }
    }

    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('purchase_orders')
          .select('id, po_number, customer_name, product_name, quantity, date, requested_ship_date, status, is_copack, location, payment_terms, deposit_paid')
          .order('created_at', { ascending: false })
        if (!active) return
        if (error) throw error
        const rows = Array.isArray(data) ? data : []
        const keep = new Set(['completed', 'ready_to_ship', 'ready to ship', 'partially_shipped', 'partial', 'shipped'])
        const sticky = readStickyCompletedIds()
        let stickyDirty = false

        const mapped: CompletedOrder[] = rows
          .filter((r: any) => {
            const id = String(r?.id || '')
            const st = normalizeStatus(r?.status)
            const inKeep = keep.has(st)
            if (inKeep && id && !sticky.has(id)) {
              sticky.add(id)
              stickyDirty = true
            }
            return (inKeep || (id && sticky.has(id)))
          })
          .map((r: any) => ({
            id: String(r.id),
            orderNumber: String(r.po_number || r.id || ''),
            customer: String(r.customer_name || ''),
            product: String(r.product_name || ''),
            quantity: Number(r.quantity || 0),
            completedDate: fmt(r.date),
            deliveryDate: fmt(r.requested_ship_date),
            total: 0,
            status: labelStatus(r.status),
            poDate: fmt(r.date),
            shipDate: fmt(r.requested_ship_date),
            location: String(r.location || ''),
            paymentTerms: String(r.payment_terms || ''),
            depositPaid: !!r.deposit_paid,
            is_copack: !!r.is_copack,
          }))

        if (stickyDirty) writeStickyCompletedIds(sticky)

        setCompletedOrders(mapped)
      } catch {
        if (!active) return
        setCompletedOrders([])
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    const channel = supabase
      .channel('completed-orders-po')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
        load()
      })
      .subscribe()

    return () => {
      active = false
      try {
        supabase.removeChannel(channel)
      } catch {}
    }
  }, [])

  const filteredOrders = useMemo(() => {
    const q = String(searchTerm || '').toLowerCase()
    const base = completedOrders.filter(order =>
      order.orderNumber.toLowerCase().includes(q) ||
      order.customer.toLowerCase().includes(q) ||
      order.product.toLowerCase().includes(q)
    )
    const tabIsCopack = activeTab === 'copack'
    return base.filter((o: any) => !!o.is_copack === tabIsCopack)
  }, [activeTab, completedOrders, searchTerm])

  const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0)
  const totalQuantity = completedOrders.reduce((sum, order) => sum + order.quantity, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-2">Completed Orders</h1>
              
            </div>
            {!isSalesRepViewOnly && (
              <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center">
                <Download className="h-5 w-5 mr-3" />
                Export Report
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-4 mb-8">
          <div className="inline-flex items-center rounded-lg bg-neutral-light/60 p-1 border border-neutral-soft/60">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md ${activeTab==='copack' ? 'bg-primary-medium text-white shadow' : 'text-neutral-dark hover:bg-white'}`}
              onClick={() => setActiveTab('copack')}
            >
              Co-Packing
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md ${activeTab==='brand' ? 'bg-primary-medium text-white shadow' : 'text-neutral-dark hover:bg-white'}`}
              onClick={() => setActiveTab('brand')}
            >
              Brands
            </button>
          </div>
        </div>

        {/* Enhanced Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-accent-success/20 to-accent-success/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <CheckCircle className="h-7 w-7 text-accent-success" />
              </div>
              <div className="w-2 h-2 bg-accent-success rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Total Completed</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">{completedOrders.length}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-accent-success to-accent-success/40 rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Orders</span>
              </div>
            </div>
          </div>
          
          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-light/30 to-primary-light/15 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <DollarSign className="h-7 w-7 text-primary-medium" />
              </div>
              <div className="w-2 h-2 bg-primary-medium rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Total Revenue</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">${totalRevenue.toFixed(2)}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-primary-medium to-primary-light rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Revenue</span>
              </div>
            </div>
          </div>
          
          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-dark/20 to-primary-dark/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <Package className="h-7 w-7 text-primary-dark" />
              </div>
              <div className="w-2 h-2 bg-primary-dark rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Units Produced</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">{totalQuantity}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-primary-dark to-primary-medium rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Units</span>
              </div>
            </div>
          </div>
          
          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-accent-warning/25 to-accent-warning/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <TrendingUp className="h-7 w-7 text-accent-warning" />
              </div>
              <div className="w-2 h-2 bg-accent-warning rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Avg Order Value</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">${(completedOrders.length ? (totalRevenue / completedOrders.length) : 0).toFixed(2)}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-accent-warning to-accent-warning/40 rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Average</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">
                Search Completed Orders
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-medium" />
                <input
                  type="text"
                  placeholder="Search completed orders..."
                  className="w-full pl-12 pr-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="md:w-64">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">
                <Filter className="h-5 w-5 mr-3 text-primary-medium" />
                Filter & Sort
              </label>
              <button className="w-full px-4 py-4 border border-neutral-soft rounded-xl text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all shadow-sm hover:shadow-md flex items-center justify-between">
                <span className="text-neutral-medium">All</span>
                <Filter className="h-5 w-5 text-neutral-medium" />
              </button>
            </div>
          </div>
        </div>

        {/* Table or Empty State */}
        {loading ? (
          <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="p-16 text-center">
              <p className="text-neutral-medium mb-1">Loading…</p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="px-10 py-8 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-dark mb-2">Completed Orders</h3>
              </div>
            </div>
            <div className="p-16 text-center">
              <p className="text-neutral-medium mb-1">No completed orders found</p>
              <p className="text-sm text-neutral-medium">Orders will appear here when completed.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-base font-semibold text-neutral-dark">Completed Orders</div>
              <div className="px-3 py-1.5 bg-primary-light/10 rounded-xl border border-primary-light/20">
                <span className="text-sm font-semibold text-primary-dark">{filteredOrders.length} Total</span>
              </div>
            </div>
            <div className="space-y-4">
              {filteredOrders.map((o) => (
                <div key={o.id} className="rounded-2xl border border-neutral-soft/40 bg-gradient-to-br from-white to-neutral-light/30 p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between pb-3 border-b border-neutral-soft/60">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-medium">PO Date</div>
                        <div className="text-sm font-semibold text-neutral-dark">{o.poDate || o.completedDate || '-'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-medium">PO #</div>
                        <div className="text-sm font-semibold text-neutral-dark">{o.orderNumber || '-'}</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border bg-neutral-light/40 text-neutral-dark border-neutral-soft/60">{o.status}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-medium">Customer</div>
                      <div className="text-sm font-semibold text-neutral-dark truncate">{o.customer || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-medium">Product</div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-neutral-dark truncate">{o.product || '-'}</div>
                        {o.depositPaid && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Deposit</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-medium">Qty</div>
                      <div className="text-sm font-semibold text-neutral-dark">{Number(o.quantity || 0)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-medium">Ship Date</div>
                      <div className="text-sm font-semibold text-neutral-dark">{o.shipDate || '-'}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                      <span className="font-semibold">Location</span>
                      <span className="opacity-80">{o.location || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                      <span className="font-semibold">Payment Terms</span>
                      <span className="opacity-80">{o.paymentTerms || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompletedOrders
