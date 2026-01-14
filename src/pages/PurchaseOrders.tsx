import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Plus, X, User, Package, Calendar, FileText, Eye, Pencil, Trash2, MapPin, BadgeCheck, Search, CheckCircle2, Truck, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Status } from '../domain/enums'
import { validatePODraft } from '../rules/po.rules'
import { PO_RULES } from '../config/rules-config'
import SubstituteModal from '../components/SubstituteModal'
import CopackAllocationSummary from '../components/CopackAllocationSummary'
import { useAuth } from '../contexts/AuthContext'

// Temporary global flag for PO Approval Debug Mode
const DEBUG_PO = true

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatStatusLabel(raw?: string | null): string {
  const s = String(raw || '').trim()
  if (!s) return '—'
  const lower = s.toLowerCase()
  if (lower === 'move_to_procurement' || lower === 'move to procurement') return 'Move to Procurement'
  if (lower === 'ready_to_schedule' || lower === 'ready to schedule') return 'Ready to Schedule'
  if (lower === 'ready_to_ship' || lower === 'ready to ship') return 'Completed'
  if (lower === 'on_hold' || lower === 'on hold') return 'On Hold'
  if (lower === 'client_communication_required' || lower === 'client communication required') return 'Client Communication Required'
  if (lower === 'partially_shipped') return 'Partially Shipped'
  // Generic: snake_case -> Title Case
  return s
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function getStatusBadgeClass(raw?: string | null): string {
  const st = String(raw || '').toLowerCase()
  if (st === 'on hold' || st === 'on_hold' || st === 'canceled' || st === 'cancelled') {
    return 'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
  }
  if (st === 'approved' || st === 'allocated' || st === 'submitted' || st === 'shipped') {
    return 'bg-accent-success/10 text-accent-success border-accent-success/30'
  }
  if (st === 'partially_shipped') {
    return 'bg-accent-warning/10 text-accent-warning border-accent-warning/30'
  }
  if (st === 'move_to_procurement' || st === 'move to procurement' || st === 'ready to schedule' || st === 'ready_to_schedule') {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }
  return 'bg-neutral-light/40 text-neutral-dark border-neutral-soft/60'
}

const PurchaseOrders: React.FC = () => {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState<any>(null)
  const [isEditOpen, setIsEditOpen] = useState<any>(null)
  const [isCustomerOpen, setIsCustomerOpen] = useState(false)
  
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const [customers, setCustomers] = useState<Array<{id:string; name:string; credit_hold?: boolean; overdue_balance?: number; credit_limit?: number; current_balance?: number}>>([])
  const [products, setProducts] = useState<Array<{
    id:string;
    name:string;
    is_discontinued?: boolean;
    substitute_sku?: string | null;
    case_qty?: number | null;
    formula?: {
      id: string;
      formula_name: string;
      version?: number | null;
      comments?: string | null;
      customer_id?: string | null;
      standard_yield?: number | null;
      scrap_percent?: number | null;
      items?: Array<{ material_id: string; qty_per_unit: string | null; uom: string | null; percentage: string | null }>;
    } | null;
    meta?: { has_client_supplied?: boolean; all_ops_supplied?: boolean };
  }>>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [rushFilter, setRushFilter] = useState<string>('All')
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [isRushOpen, setIsRushOpen] = useState(false)
  const [extraLines, setExtraLines] = useState<Array<{ id: string; product: string; qty: number }>>([])
  const [toast, setToast] = useState<{ show: boolean; message: string; kind?: 'success' | 'warning' | 'error' }>({ show: false, message: '', kind: 'success' })
  const [isAllocOpen, setIsAllocOpen] = useState(false)
  const [allocSummary, setAllocSummary] = useState<any | null>(null)
  const [allocContext, setAllocContext] = useState<{ is_copack?: boolean; operation_supplies_materials?: boolean } | null>(null)
  const [copackSummary, setCopackSummary] = useState<any | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showSubModal, setShowSubModal] = useState(false)
  const [fefoWarning, setFefoWarning] = useState<any | null>(null)
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null)
  const [pendingLines, setPendingLines] = useState<Array<{ id?: string; product_name: string; quantity?: number }>>([])
  const [showNoFg, setShowNoFg] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentRole, setCurrentRole] = useState<string>('')
  const [createLineOpen, setCreateLineOpen] = useState(false)
  const [createLineName, setCreateLineName] = useState('')
  const [createLineSaving, setCreateLineSaving] = useState(false)
  const [createLineError, setCreateLineError] = useState<string | null>(null)
  
  const canManagePurchaseOrders = useMemo(() => {
    const r = String(currentRole || '').toLowerCase()
    return r === 'admin' || r === 'procurement' || r === 'finance' || r === 'supply_chain' || r === 'warehouse' || r === 'production_manager' || r === 'sales_representative'
  }, [currentRole])

  const canManageProductionLines = useMemo(() => {
    const r = String(currentRole || '').toLowerCase()
    return r === 'admin' || r === 'production_manager'
  }, [currentRole])

  const canViewPurchaseOrders = useMemo(() => {
    const r = String(currentRole || '').toLowerCase()
    return canManagePurchaseOrders || r === 'supply_chain_procurement'
  }, [canManagePurchaseOrders, currentRole])
  const [showBackorderAdvisory, setShowBackorderAdvisory] = useState(false)
  const [viewLines, setViewLines] = useState<Array<{ product_name: string; quantity: number; allocated_qty: number; shortfall_qty: number; status: string }>>([])
  const [viewLoading, setViewLoading] = useState(false)
  const [viewShipments, setViewShipments] = useState<any[]>([])
  const [viewCopackRes, setViewCopackRes] = useState<any[]>([])
  const [viewFormula, setViewFormula] = useState<any | null>(null)
  const [viewFormulaItems, setViewFormulaItems] = useState<any[]>([])
  const [viewPrs, setViewPrs] = useState<Array<{ id: string; item_name: string; required_qty: number; needed_by: string | null; status: string; created_at: string | null; notes?: string | null }>>([])
  const [viewPrLoading, setViewPrLoading] = useState(false)
  const [productionLines, setProductionLines] = useState<Array<{ id: string; name: string }>>([])
  const [asnModalOpen, setAsnModalOpen] = useState(false)
  const [asnData, setAsnData] = useState<any[]>([])
  const [asnPoStatus, setAsnPoStatus] = useState<string | null>(null)
  const [asnLoading, setAsnLoading] = useState(false)
  const [shippedTotals, setShippedTotals] = useState<Record<string, number>>({})
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const [showPriorityModal, setShowPriorityModal] = useState(false)
  const [showPlannerOverride, setShowPlannerOverride] = useState(false)
  const [overridePo, setOverridePo] = useState<any | null>(null)
  const [overrideQty, setOverrideQty] = useState<number>(0)
  const [finishedGoodsData, setFinishedGoodsData] = useState<Record<string, { available_qty: number }>>({})
  const [showAddPaymentTerms, setShowAddPaymentTerms] = useState(false)
  const [showAddSalesRep, setShowAddSalesRep] = useState(false)
  const [newPaymentTerms, setNewPaymentTerms] = useState('')
  const [newSalesRep, setNewSalesRep] = useState('')
  const [isPaymentTermsOpen, setIsPaymentTermsOpen] = useState(false)
  const [isSalesRepOpen, setIsSalesRepOpen] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [addingCustomer, setAddingCustomer] = useState(false)
  // Brand vs Copack list tabs
  const [poTab, setPoTab] = useState<'brand' | 'copack'>('copack')

  const productNamesSet = useMemo(() => {
    const set = new Set<string>()
    ;(products || []).forEach((p: any) => {
      const n = String(p?.name || '').trim().toLowerCase()
      if (n) set.add(n)
    })
    return set
  }, [products])

  const isKnownProductName = (name: string) => {
    const n = String(name || '').trim().toLowerCase()
    if (!n) return false
    return productNamesSet.has(n)
  }

  // Detect products with competing POs (same product across multiple open rows)
  // Only count POs with deposit_paid=true AND rush dates for escalation threshold
  const competingCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const escalationCounts: Record<string, number> = {}
    ;(orders || []).forEach((po: any) => {
      if (po?.is_copack) return // Copack POs do not compete for finished goods priority
      const st = String(po?.status || '').toLowerCase()
      const isPending = st === 'open' || st === 'draft' || !st
      if (!isPending) return
      const key = String(po.product_id || po.product_name || '').trim().toLowerCase()
      if (!key) return
      
      // Count all competing POs
      counts[key] = (counts[key] || 0) + 1
      
      // Count only POs with deposit_paid=true AND rush dates for escalation
      const hasDeposit = !!po.deposit_paid
      const isRush = !!po.is_rush || (po.requested_ship_date && (() => {
        const shipDate = new Date(po.requested_ship_date)
        const days = Math.ceil((shipDate.getTime() - Date.now()) / 86400000)
        return days <= 7 // Rush window days
      })())
      
      if (hasDeposit && isRush) {
        escalationCounts[key] = (escalationCounts[key] || 0) + 1
      }
    })
    return { counts, escalationCounts }
  }, [orders])
  
  const needsEscalation = (po: any) => {
    const key = String(po.product_id || po.product_name || '').trim().toLowerCase()
    return key ? (competingCounts.escalationCounts[key] || 0) >= 3 : false
  }

  // Check if priority scoring should be shown (when 2+ POs compete AND any has deposit paid OR rush date)
  const showsPriorityScore = (po: any) => {
    const key = String(po.product_id || po.product_name || '').trim().toLowerCase()
    if (!key) return false
    
    // Find all POs for this product
    const sameProdPOs = (orders || []).filter((otherPo: any) => {
      if (otherPo?.is_copack) return false
      const st = String(otherPo?.status || '').toLowerCase()
      const isPending = st === 'open' || st === 'draft' || !st
      if (!isPending) return false
      const otherKey = String(otherPo.product_id || otherPo.product_name || '').trim().toLowerCase()
      return otherKey === key
    })
    
    // Must have 2+ POs competing for same product
    if (sameProdPOs.length < 2) return false
    
    // Show priority score if ANY competing PO has deposit paid OR rush date
    return sameProdPOs.some((otherPo: any) => {
      const hasDeposit = !!otherPo.deposit_paid
      const isRush = !!otherPo.is_rush || (otherPo.requested_ship_date && (() => {
        const shipDate = new Date(otherPo.requested_ship_date)
        const days = Math.ceil((shipDate.getTime() - Date.now()) / 86400000)
        return days <= 7 // Rush window days
      })())
      return hasDeposit || isRush
    })
  }

  // Derived shortage indicators for the View modal
  const hasViewShortfall = useMemo(() => (viewLines || []).some(l => Number(l.shortfall_qty || 0) > 0), [viewLines])
  const shortfallQty = useMemo(() => (viewLines || []).reduce((s, l) => s + Number(l.shortfall_qty || 0), 0), [viewLines])

  // Predict allocated qty per PO after applying priority rules per product (brand only; deposit+rush cohort only)
  const predictedAllocatedById = useMemo(() => {
    const map: Record<string, number> = {}
    try {
      // group brand, pending POs by product key
      const groups: Record<string, any[]> = {}
      ;(orders || []).forEach((po:any) => {
        const st = String(po?.status || '').toLowerCase()
        const isPending = st === 'open' || st === 'draft' || !st
        if (!isPending) return
        if (po?.is_copack) return
        const key = String(po.product_name || '').trim().toLowerCase()
        if (!key) return
        // only count deposit + rush cohort for allocation competition
        const rushNow = !!po.is_rush || (po.requested_ship_date && (() => {
          const shipDate = new Date(po.requested_ship_date)
          const days = Math.ceil((shipDate.getTime() - Date.now()) / 86400000)
          return days <= 7
        })())
        if (!(!!po.deposit_paid && rushNow)) return
        if (!groups[key]) groups[key] = []
        groups[key].push(po)
      })

      Object.entries(groups).forEach(([key, list]) => {
        let remaining = Number(finishedGoodsData[key]?.available_qty || 0)
        // priority sort: earliest ship date, deposit first, older created first
        const sorted = [...list].sort((a:any,b:any)=>{
          const ad = new Date(a.requested_ship_date || 0).getTime()
          const bd = new Date(b.requested_ship_date || 0).getTime()
          if (ad !== bd) return ad - bd
          const adep = !!a.deposit_paid ? 1 : 0
          const bdep = !!b.deposit_paid ? 1 : 0
          if (adep !== bdep) return bdep - adep
          const ac = new Date(a.created_at || 0).getTime()
          const bc = new Date(b.created_at || 0).getTime()
          return ac - bc
        })
        sorted.forEach((po:any)=>{
          const need = Number(po.quantity || 0)
          const alloc = Math.max(0, Math.min(remaining, need))
          map[String(po.id)] = alloc
          remaining = Math.max(0, remaining - alloc)
        })
      })
    } catch {}
    return map
  }, [orders, finishedGoodsData])

  // Use predicted allocation and escalation rules to decide if planner conflict should show
  const hasPlannerConflict = (po:any) => {
    if (po?.is_copack) return false
    const st = String(po?.status || '').toLowerCase()
    const isPending = st === 'open' || st === 'draft' || !st
    if (!isPending) return false
    const rushNow = !!po.is_rush || (po.requested_ship_date && (() => {
      const shipDate = new Date(po.requested_ship_date)
      const days = Math.ceil((shipDate.getTime() - Date.now()) / 86400000)
      return days <= 7
    })())
    if (!(!!po.deposit_paid && rushNow)) return false
    if (!needsEscalation(po)) return false
    const alloc = predictedAllocatedById[String(po.id)]
    return typeof alloc === 'number' ? alloc === 0 : false
  }

  // detectConflict removed; using hasPlannerConflict instead for UI gating

  // Show advisory if any risk detected
  useEffect(() => {
    const isBackordered = allocSummary?.status === 'backordered'
    const hasShortage = Number(shortfallQty || 0) > 0
    const viewShortage = hasViewShortfall === true
    setShowBackorderAdvisory(!!(isBackordered || hasShortage || viewShortage))
  }, [allocSummary?.status, shortfallQty, hasViewShortfall])

  // ───────── PO Risk Banner helpers
  type BannerKind = 'HOLD' | 'BACKORDER' | 'SHORTAGE' | 'RISK' | null
  function getPOBannerStatus(list: any[]): BannerKind {
    if (!Array.isArray(list) || list.length === 0) return null
    // Highest priority first
    if (list.some((o) => String(o.status || '').toLowerCase() === 'on_hold' || String(o.status || '').toLowerCase() === 'on hold')) return 'HOLD'
    if (list.some((o) => String(o.status || '').toLowerCase() === 'backordered')) return 'BACKORDER'
    if (list.some((o) => {
      const st = String(o.status || '').toLowerCase()
      return st === 'partial' || st === 'partially_shipped'
    })) return 'SHORTAGE'
    if (list.some((o) => {
      const row: any = o || {}
      const creditHold = row.customer_credit_hold === true
      const overLimit = Number(row.current_balance || 0) > Number(row.credit_limit || 0)
      const overdueOverLimit = Number(row.overdue_balance || 0) > Number(row.credit_limit || 0)
      const riskFlag = !!row.risk_flag
      return riskFlag || creditHold || overLimit || overdueOverLimit
    })) return 'RISK'
    return null
  }

  function renderPOBanner() {
    const kind = getPOBannerStatus(orders)
    if (!kind) return null
    const map: Record<Exclude<BannerKind, null>, { cls: string; title: string; desc: string }> = {
      HOLD: {
        cls: 'border-red-300 bg-red-50 text-red-800',
        title: 'On Hold',
        desc: 'This PO is currently on hold due to rule validation.'
      },
      BACKORDER: {
        cls: 'border-amber-300 bg-amber-50 text-amber-900',
        title: 'Backorder',
        desc: 'This PO has a backorder. Some items have insufficient finished goods.'
      },
      SHORTAGE: {
        cls: 'border-orange-300 bg-orange-50 text-orange-900',
        title: 'Shortage',
        desc: 'This PO has allocation shortages.'
      },
      RISK: {
        cls: 'border-yellow-300 bg-yellow-50 text-yellow-900',
        title: 'Risk',
        desc: 'This PO is flagged as risk based on rule validation.'
      }
    }
    const meta = map[kind]
    return (
      <div className={`w-full mb-6`}>
        <div className={`w-full rounded-lg border px-4 py-3 shadow-sm ${meta.cls} transition-opacity duration-300 ease-out`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5"><AlertTriangle className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-semibold">{meta.title}</div>
              <div className="text-sm opacity-90">{meta.desc}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // (removed) canShipPartial helper — superseded by explicit status + allow_partial_ship rules

  // Alias with requested name to keep handlers simple
  async function shipPOPartial(poId: string) {
    await shipPartialPO(poId)
  }

  // Small helper to refresh POs
  async function refreshPOs() {
    const { data: poRows } = await supabase
      .from('purchase_orders')
      .select('*, risk_flag')
      .order('created_at', { ascending: false })
    const list = poRows ?? []

    // Auto-recompute status/risk per latest customer financials
    const next: any[] = []
    for (const po of list as any[]) {
      const cust: any = (customers || []).find((c: any) => c.id === po.customer_id) || null
      const creditHold = !!cust?.credit_hold
      const limit = Number(cust?.credit_limit ?? 0)
      const overLimit = Number(cust?.current_balance ?? 0) > limit
      const overdueOverLimit = Number(cust?.overdue_balance ?? 0) > limit

      let desiredStatus: string | null = null
      let desiredRisk = false
      if (creditHold) {
        desiredStatus = 'On Hold'
        desiredRisk = true
      } else if (overLimit || overdueOverLimit) {
        desiredStatus = 'Risk'
        desiredRisk = true
      }

      const shouldUpdate = (
        (desiredStatus && po.status !== desiredStatus) ||
        (!!po.risk_flag !== desiredRisk)
      )

      if (shouldUpdate) {
        try {
          await supabase
            .from('purchase_orders')
            .update({ status: desiredStatus ?? po.status, risk_flag: desiredRisk })
            .eq('id', po.id)
        } catch {}
        next.push({ ...po, status: desiredStatus ?? po.status, risk_flag: desiredRisk })
      } else {
        next.push(po)
      }
    }

    setOrders(next)

    // Pull ASN shipped totals per PO to drive UI button visibility
    if (list.length > 0) {
      const ids = list.map((r: any) => String(r.id))
      const { data: asnRows } = await supabase
        .from('asn')
        .select('po_id, shipped_qty')
        .in('po_id', ids)
      const totals: Record<string, number> = {}
      ;(asnRows || []).forEach((r: any) => {
        const pid = String(r.po_id)
        totals[pid] = (totals[pid] || 0) + Number(r.shipped_qty || 0)
      })
      setShippedTotals(totals)

      // Pull finished goods availability for conflict detection (do not filter by exact names to avoid whitespace mismatches)
      const { data: fgRows } = await supabase
        .from('finished_goods')
        .select('product_name, available_qty')
      const fgData: Record<string, { available_qty: number }> = {}
      ;(fgRows || []).forEach((r: any) => {
        const key = String(r.product_name || '').trim().toLowerCase()
        if (!key) return
        fgData[key] = { available_qty: Number(r.available_qty || 0) }
      })
      setFinishedGoodsData(fgData)
    } else {
      setShippedTotals({})
      setFinishedGoodsData({})
    }
  }

  void shipPO

  // Handlers requested
  const handleReadyToShip = async (poId: string) => {
    try {
      // Keep existing backend flow: mark Ready-to-Ship, not full ship here
      await markReadyToShip(poId)
      setToast({ show: true, message: 'Marked Ready to Ship', kind: 'success' })
      await refreshPOs()
    } catch (e) {
      setToast({ show: true, message: 'Failed to mark Ready to Ship', kind: 'error' })
    }
  }

  const handleApproveCompletedPo = async (poId: string) => {
    try {
      const res = await runRpc('allocate_brand_po_finished_first', poId)
      if (res.status === 'error') {
        setToast({ show: true, message: res.message || 'Allocation failed', kind: 'error' })
        return
      }
      setToast({ show: true, message: 'Approved: allocation updated (finished goods first).', kind: 'success' })
      await refreshPOs()
    } catch (e: any) {
      setToast({ show: true, message: e?.message || 'Allocation failed', kind: 'error' })
    }
  }

  const handleShipPartial = async (poId: string) => {
    try {
      await shipPOPartial(poId)
      setToast({ show: true, message: 'Partial shipment created', kind: 'success' })
      await refreshPOs()
    } catch (e) {
      setToast({ show: true, message: 'Failed to create partial shipment', kind: 'error' })
    }
  }

  void handleReadyToShip
  void handleShipPartial
  void shipPOPartial

  // Ship remaining handler: ship ONLY the true remaining qty
  const handleShipRemaining = async (poId: string) => {
    try {
      // Load ordered qty and product info
      const { data: poRow } = await supabase
        .from('purchase_orders')
        .select('quantity, product_name')
        .eq('id', poId)
        .maybeSingle()

      const ordered = Number((poRow as any)?.quantity ?? 0)
      const productName = (poRow as any)?.product_name || ''

      // Sum already shipped from ASN
      const { data: asns } = await supabase
        .from('asn')
        .select('shipped_qty')
        .eq('po_id', poId)

      const shipped = Array.isArray(asns)
        ? asns.reduce((sum, r: any) => sum + Number(r?.shipped_qty ?? 0), 0)
        : 0

      const remaining = Math.max(0, ordered - shipped)
      if (remaining <= 0) {
        setToast({ show: true, message: 'Nothing remaining to ship.', kind: 'warning' })
        return
      }

      // Check finished goods availability
      const { data: fgRow } = await supabase
        .from('finished_goods')
        .select('available_qty')
        .eq('product_name', productName)
        .maybeSingle()

      const availableQty = Number((fgRow as any)?.available_qty ?? 0)
      if (availableQty < remaining) {
        setToast({ 
          show: true, 
          message: `Insufficient stock. Available: ${availableQty}, Required: ${remaining}`, 
          kind: 'error' 
        })
        return
      }

      // 1) Re-allocate from finished goods to ensure latest availability
      await runRpc('allocate_brand_po_finished_first', poId)

      // 2) Cap per-line allocated_qty so the total equals the remaining balance
      const { data: lines } = await supabase
        .from('purchase_order_lines')
        .select('id, allocated_qty, product_name')
        .eq('purchase_order_id', poId)
        .order('created_at', { ascending: true })

      let left = remaining
      const updates: Array<{ id: string; allocated_qty: number; product_name?: string }> = []
      const perProductShip: Record<string, number> = {}
      ;(lines || []).forEach((ln: any) => {
        const cur = Number(ln?.allocated_qty ?? 0)
        const pname = String(ln?.product_name || '')
        if (left <= 0) {
          updates.push({ id: String(ln.id), allocated_qty: 0, product_name: pname })
        } else {
          const take = Math.min(cur, left)
          updates.push({ id: String(ln.id), allocated_qty: take, product_name: pname })
          if (pname) perProductShip[pname] = (perProductShip[pname] || 0) + take
          left -= take
        }
      })

      if (updates.length > 0) {
        // Apply updates individually (row-level updates)
        await Promise.all(
          updates.map(u =>
            supabase.from('purchase_order_lines').update({ allocated_qty: u.allocated_qty }).eq('id', u.id)
          )
        )
      }

      // 3) Update PO status to partially_shipped
      await supabase.from('purchase_orders').update({
        status: 'partially_shipped'
      }).eq('id', poId)

      // 4) Create ASN entry for only the remaining quantity
      const { error: asnError } = await supabase
        .from('asn')
        .insert({
          po_id: poId,
          shipped_qty: remaining,
          asn_number: `ASN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${poId.slice(-6)}-REMAINING`
        })
      
      if (asnError) throw asnError

      // 5) Adjust FG available_qty per product by shipped amount (RPC already reduces reserved)
      await Promise.all(
        Object.entries(perProductShip).map(async ([product_name, qty]) => {
          if (!product_name || !qty) return
          const { data: fgRow } = await supabase
            .from('finished_goods')
            .select('id, available_qty')
            .eq('product_name', product_name)
            .maybeSingle()
          const fgId = (fgRow as any)?.id
          const avail = Number((fgRow as any)?.available_qty ?? 0)
          if (fgId) {
            const newAvail = Math.max(0, avail - Number(qty))
            await supabase.from('finished_goods').update({ available_qty: newAvail }).eq('id', fgId)
          }
        })
      )

      // 6) If fully shipped now, mark PO as submitted and clear backorder
      const { data: asnsAfter } = await supabase
        .from('asn')
        .select('shipped_qty')
        .eq('po_id', poId)
      const shippedAfter = Array.isArray(asnsAfter)
        ? asnsAfter.reduce((s, r: any) => s + Number(r?.shipped_qty ?? 0), 0)
        : 0
      if (shippedAfter >= ordered) {
        await supabase
          .from('purchase_orders')
          .update({ status: 'On Hold', backorder_eta: null, backorder_qty: 0 })
          .eq('id', poId)
      }

      setToast({ show: true, message: `Shipped remaining qty (${remaining}).`, kind: 'success' })
      await refreshPOs()
    } catch (e) {
      setToast({ show: true, message: 'Failed to ship remaining items', kind: 'error' })
    }
  }

  // Planner Override Functions
  const openPlannerOverride = (po: any) => {
    setOverridePo(po)
    setOverrideQty(po.allocated_qty || 0)
    setShowPlannerOverride(true)
  }

  const closePlannerOverride = () => {
    setShowPlannerOverride(false)
    setOverridePo(null)
    setOverrideQty(0)
  }

  const applyOverride = async (poId: string, qty: number) => {
    try {
      const timestamp = new Date().toLocaleString()
      const oldComments = overridePo?.comments || ''
      const newComments = `${oldComments}\n[Escalation] ${timestamp} — Planner override applied: Manual allocation set to ${qty}`
      
      await supabase
        .from('purchase_orders')
        .update({ 
          allocated_qty: qty,
          comments: newComments
        })
        .eq('id', poId)
      
      setToast({ show: true, message: 'Manual override applied successfully', kind: 'success' })
      closePlannerOverride()
      await refreshPOs()
    } catch (e) {
      setToast({ show: true, message: 'Failed to apply override', kind: 'error' })
    }
  }

  const markClientCommunication = async (poId: string) => {
    try {
      const timestamp = new Date().toLocaleString()
      const oldComments = overridePo?.comments || ''
      const newComments = `${oldComments}\n[Escalation] ${timestamp} — Marked for client communication: Waiting for customer approval on shortfall`
      
      await supabase
        .from('purchase_orders')
        .update({ 
          comments: newComments,
          status: 'Client Communication Required'
        })
        .eq('id', poId)
      
      setToast({ show: true, message: 'Marked for client communication', kind: 'success' })
      closePlannerOverride()
      await refreshPOs()
    } catch (e) {
      setToast({ show: true, message: 'Failed to mark for client communication', kind: 'error' })
    }
  }

  // Ship Partial RPC function
  async function shipPartialPO(poId: string) {
    try {
      const { error } = await supabase.rpc('fn_ship_po_partial', {
        p_po_id: poId,
      })
      if (error) throw error

      setToast({ show: true, message: 'Partial shipment created successfully!', kind: 'success' })

      const { data: poRows } = await supabase
        .from('purchase_orders')
        .select('*, risk_flag')
        .order('created_at', { ascending: false })
      setOrders(poRows ?? [])
    } catch (err) {
      console.error(err)
      setToast({ show: true, message: 'Failed to create partial shipment.', kind: 'error' })
    }
  }

  // Close dropdown when clicking outside or pressing escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't close if clicking inside the dropdown or on the menu button
      if (target.closest('.dropdown-menu') || target.closest('.menu-button')) {
        return;
      }
      setOpenMenuId(null);
    }
    
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null)
      }
    }

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [openMenuId])
  // Debug state per PO
  const [debugMap, setDebugMap] = useState<Record<string, any>>({})
  const [lastApprovedId, setLastApprovedId] = useState<string | null>(null)
  const [allocLines, setAllocLines] = useState<Array<{ product_name: string; quantity: number; allocated_qty: number; shortfall_qty: number; status: string }>>([])
  // Bundle/KIT packaging rule state
  const [isBundleBlocked, setIsBundleBlocked] = useState(false)
  const [bundleBlockInfo, setBundleBlockInfo] = useState<{ title: string; message: string; missing: Array<{ material?: string; product_name?: string; shortfall_qty?: number }> } | null>(null)
  const [form, setForm] = useState({
    date: '',
    customer: '',
    customer_id: '',
    po_number: '',
    product: '',
    requestedShipDate: '',
    ship_date: '',
    quantity: '',
    caseQty: '',
    paymentTerms: '',
    salesRepresentative: '',
    additionalPackaging: '',
    status: 'On Hold',
    comments: '',
    location: '',
    is_copack: false,
    client_materials_required: false,
    operation_supplies_materials: false,
    deposit_paid: false,
    lines: [] as Array<{ sku?: string; product_name: string; qty: number; is_discontinued?: boolean; substitute_sku?: string | null }>
  })

  const getTodayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const fetchProductionLines = async () => {
    const { data } = await supabase.from('production_lines').select('id, line_name').order('line_name', { ascending: true })
    try {
      const list = (data ?? []).map((r: any) => ({ id: String(r.id), name: String(r.line_name || '') }))
      setProductionLines(list)
    } catch {}
  }
  const [productSuggestOpen, setProductSuggestOpen] = useState(false)
  const [extraSuggestId, setExtraSuggestId] = useState<string | null>(null)
  const productSuggestRef = useRef<HTMLDivElement>(null)
  const extraSuggestRef = useRef<HTMLDivElement>(null)
  const lastCopackAutoSourceProductRef = useRef<string>('')

  const customerRef = useRef<HTMLDivElement>(null)
  const locationRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const paymentTermsRef = useRef<HTMLDivElement>(null)
  const salesRepRef = useRef<HTMLDivElement>(null)

  const rushRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setIsCustomerOpen(false)
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) setIsLocationOpen(false)
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setIsStatusOpen(false)
      if (rushRef.current && !rushRef.current.contains(e.target as Node)) setIsRushOpen(false)
      if (paymentTermsRef.current && !paymentTermsRef.current.contains(e.target as Node)) setIsPaymentTermsOpen(false)
      if (salesRepRef.current && !salesRepRef.current.contains(e.target as Node)) setIsSalesRepOpen(false)
      if (productSuggestRef.current && !productSuggestRef.current.contains(e.target as Node)) setProductSuggestOpen(false)
      if (extraSuggestRef.current && !extraSuggestRef.current.contains(e.target as Node)) setExtraSuggestId(null)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
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
        setCurrentRole(String((data as any)?.role || ''))
      } catch {
        if (!active) return
        setCurrentRole('')
      }
    }
    loadRole()
    return () => { active = false }
  }, [user])

  const productSuggestions = useMemo(() => {
    const q = String(form.product || '').trim().toLowerCase()
    if (!q) return []
    const list = (products || []).filter((p: any) => String(p?.name || '').toLowerCase().includes(q))
    return list.slice(0, 8)
  }, [form.product, products])

  const extraSuggestions = useMemo(() => {
    const q = String((extraSuggestId ? (extraLines.find(x => x.id === extraSuggestId)?.product || '') : '')).trim().toLowerCase()
    if (!q) return []
    const list = (products || []).filter((p: any) => String(p?.name || '').toLowerCase().includes(q))
    return list.slice(0, 8)
  }, [extraSuggestId, extraLines, products])

  // Load purchase_order_lines when View modal opens
  useEffect(() => {
    const loadLines = async () => {
      try {
        setViewLoading(true)
        setViewLines([])
        if (!isViewOpen?.id) { setViewLoading(false); return }
        const { data, error } = await supabase
          .from('purchase_order_lines')
          .select('product_name, quantity, allocated_qty, shortfall_qty, status')
          .eq('purchase_order_id', String(isViewOpen.id))
          .order('created_at', { ascending: true })
        if (!error && Array.isArray(data)) {
          setViewLines(data.map((r: any) => ({
            product_name: String(r.product_name || ''),
            quantity: Number(r.quantity || 0),
            allocated_qty: Number(r.allocated_qty || 0),
            shortfall_qty: Number(r.shortfall_qty || 0),
            status: String(r.status || ''),
          })))
        }
      } finally { setViewLoading(false) }
    }
    loadLines()
  }, [isViewOpen?.id])

  // Local Copack components (ensure they are defined before return and in component scope)
  const CopackAllocatedMaterials: React.FC<{ data: any[] }> = ({ data }) => (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-neutral-dark">Allocated Raw Materials (Client-Supplied)</h3>
      <div className="border border-neutral-soft/40 rounded-xl bg-neutral-light/20">
        <div className="px-4 py-3 border-b border-neutral-soft/40 flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Client Materials Allocation</span>
        </div>
        {(!Array.isArray(data) || data.length === 0) ? (
          <div className="px-4 py-4 text-xs text-neutral-medium">No client-supplied materials were allocated for this PO.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-neutral-light/40 border-b border-neutral-soft/40">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">Material Name</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">Reserved Qty</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">Reservation Date</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r:any, i:number) => (
                  <tr key={r.id || i} className="border-t border-neutral-soft/30">
                    <td className="px-4 py-2 text-sm text-neutral-dark">{r.product_name || '-'}</td>
                    <td className="px-4 py-2 text-sm text-right">{r.qty ?? 0}</td>
                    <td className="px-4 py-2 text-sm text-neutral-dark">{(() => { try { return new Date(r.created_at).toLocaleString() } catch { return r.created_at || '-' } })()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )

  const CopackBOMMaterials: React.FC<{ data: any[]; poQty: number; formulaName?: string; opsMode?: boolean }>
    = ({ data, poQty, formulaName, opsMode }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-dark">{opsMode ? 'Operations Materials Used' : 'Client Materials Used'}</h3>
        {formulaName && <div className="text-xs px-2 py-1 rounded-lg border border-neutral-soft text-neutral-dark bg-white">Formula: {formulaName}</div>}
      </div>
      <div className="border border-neutral-soft/40 rounded-xl bg-neutral-light/20">
        <div className="px-4 py-3 border-b border-neutral-soft/40 flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Bill of Materials</span>
        </div>
        {(!Array.isArray(data) || data.length === 0) ? (
          <div className="px-4 py-4 text-xs text-neutral-medium">No material BOM found for this copack product.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-neutral-light/40 border-b border-neutral-soft/40">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">Material</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">Per Unit Usage</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">Total Required</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">UOM</th>
                </tr>
              </thead>
              <tbody>
                {data.map((fi:any, i:number) => {
                  const name = fi?.inventory_materials?.product_name || '-'
                  const per = Number(fi?.qty_per_unit || 0)
                  const uom = fi?.uom || ''
                  const total = per * Number(poQty || 0)
                  return (
                    <tr key={fi.id || i} className="border-t border-neutral-soft/30">
                      <td className="px-4 py-2 text-sm text-neutral-dark">{name}</td>
                      <td className="px-4 py-2 text-sm text-neutral-dark">{per} {uom}</td>
                      <td className="px-4 py-2 text-sm text-right">{total}</td>
                      <td className="px-4 py-2 text-sm text-neutral-dark">{uom}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
  // Load Copack-specific data when viewing a Copack PO
  useEffect(() => {
    const loadCopack = async () => {
      try {
        setViewCopackRes([])
        setViewFormula(null)
        setViewFormulaItems([])
        if (!isViewOpen?.id || !isViewOpen?.is_copack) return
        const poId = String(isViewOpen.id)
        // 1) Copack reservations for this PO (active only). Allow broader bucket naming just in case.
        const { data: res } = await supabase
          .from('inventory_reservations')
          .select(`id, po_id, line_id, product_name, bucket, sku, qty, created_at, batch_id, material_id, status, is_consumed,
                   inventory_materials:inventory_materials!fk_res_material ( id, product_name )`)
          .eq('po_id', poId)
          .or('bucket.eq.copack_materials,bucket.eq.copack,bucket.eq.client_materials,bucket.eq.copack_client')
        setViewCopackRes(res || [])
        // 2) Formula by formula_name (match product name)
        const productName = String(isViewOpen.product_name || '').trim()
        let formula: any = null
        if (productName) {
          const { data: f, error: fErr } = await supabase
            .from('formulas')
            .select('id, formula_name, version')
            .ilike('formula_name', productName)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle()
          formula = fErr ? null : (f as any)
        }
        setViewFormula(formula)
        // 3) Formula items + inventory material names (explicit FK alias for reliability)
        if (formula?.id) {
          const { data: items } = await supabase
            .from('formula_items')
            .select(`
              id,
              qty_per_unit,
              uom,
              inventory_materials:inventory_materials!formula_items_material_id_fkey ( id, product_name )
            `)
            .eq('formula_id', formula.id)
          setViewFormulaItems(items || [])
        }
      } catch {}
    }
    loadCopack()
  }, [isViewOpen?.id, isViewOpen?.is_copack, isViewOpen?.product_id, isViewOpen?.product_name])

  // Close View modal on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsViewOpen(null)
    }
    if (isViewOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isViewOpen])

  // Load shipments when View modal opens
  useEffect(() => {
    const loadShipments = async () => {
      try {
        setViewShipments([])
        if (!isViewOpen?.id) return
        const poId = String(isViewOpen.id)
        // Ensure po_line_id belongs to this PO
        const { data: pol } = await supabase
          .from('purchase_order_lines')
          .select('id')
          .eq('purchase_order_id', poId)
        const lineIds = Array.isArray(pol) ? pol.map((r:any)=> String(r.id)) : []
        if (lineIds.length === 0) { setViewShipments([]); return }
        const { data, error } = await supabase
          .from('shipments')
          .select('id, po_id, po_line_id, shipped_qty, shipment_date, eta, status, notes')
          .eq('po_id', poId)
          .in('po_line_id', lineIds)
          .order('shipment_date', { ascending: true })
        if (!error && Array.isArray(data)) setViewShipments(data)
      } catch {}
    }
    loadShipments()
  }, [isViewOpen?.id])

  // Realtime: auto-refresh lines, shipments, and PRs for this PO
  useEffect(() => {
    if (!isViewOpen?.id) return
    const poId = String(isViewOpen.id)

    const refreshLines = async () => {
      try {
        const { data } = await supabase
          .from('purchase_order_lines')
          .select('product_name, quantity, allocated_qty, shortfall_qty, status')
          .eq('purchase_order_id', poId)
          .order('created_at', { ascending: true })
        setViewLines((data || []).map((r: any) => ({
          product_name: String(r.product_name || ''),
          quantity: Number(r.quantity || 0),
          allocated_qty: Number(r.allocated_qty || 0),
          shortfall_qty: Number(r.shortfall_qty || 0),
          status: String(r.status || ''),
        })))
      } catch {}
    }

    const refreshShipments = async () => {
      try {
        const { data: pol } = await supabase
          .from('purchase_order_lines')
          .select('id')
          .eq('purchase_order_id', poId)
        const lineIds = Array.isArray(pol) ? pol.map((r:any)=> String(r.id)) : []
        if (lineIds.length === 0) { setViewShipments([]); return }
        const { data } = await supabase
          .from('shipments')
          .select('id, po_id, po_line_id, shipped_qty, shipment_date, eta, status, notes')
          .eq('po_id', poId)
          .in('po_line_id', lineIds)
          .order('shipment_date', { ascending: true })
        setViewShipments(data || [])
      } catch {}
    }

    const refreshPrs = async () => {
      try {
        const { data: batches } = await supabase
          .from('production_batches')
          .select('id')
          .eq('source_po_id', poId)
        const batchIds: string[] = Array.isArray(batches) ? batches.map((b: any) => String(b.id)) : []

        const { data: prByPo } = await supabase
          .from('purchase_requisitions')
          .select('id, item_name, required_qty, needed_by, status, created_at, notes')
          .eq('po_id', poId)
          .order('created_at', { ascending: false })

        let prByBatch: any[] = []
        if (batchIds.length > 0) {
          const { data: pr2 } = await supabase
            .from('purchase_requisitions')
            .select('id, item_name, required_qty, needed_by, status, created_at, notes')
            .in('batch_id', batchIds)
            .order('created_at', { ascending: false })
          prByBatch = Array.isArray(pr2) ? pr2 : []
        }

        let all: any[] = [...(prByPo || []), ...prByBatch]
        if (all.length === 0) {
          const { data: prByNotes } = await supabase
            .from('purchase_requisitions')
            .select('id, item_name, required_qty, needed_by, status, created_at, notes')
            .ilike('notes', `%${poId}%`)
            .order('created_at', { ascending: false })
          if (Array.isArray(prByNotes)) all = [...all, ...prByNotes]
        }
        const seen = new Set<string>()
        const uniq = all.filter((r: any) => { const id = String(r.id); if (seen.has(id)) return false; seen.add(id); return true })
        setViewPrs(uniq.map((r: any) => ({
          id: String(r.id),
          item_name: String(r.item_name || ''),
          required_qty: Number(r.required_qty || 0),
          needed_by: r.needed_by || null,
          status: String(r.status || 'Open'),
          created_at: r.created_at || null,
          notes: r.notes || null,
        })))
      } catch {}
    }

    const channel = supabase
      .channel(`po_view_${poId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_order_lines', filter: `purchase_order_id=eq.${poId}` }, () => { refreshLines() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments', filter: `po_id=eq.${poId}` }, () => { refreshShipments() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_batches', filter: `source_po_id=eq.${poId}` }, () => { refreshPrs() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_requisitions' }, (payload: any) => {
        const row: any = payload?.new || payload?.old || {}
        const byPo = String(row?.po_id || '') === poId
        const byNotes = typeof row?.notes === 'string' && row.notes.includes(poId)
        const byBatch = !!row?.batch_id
        if (byPo || byNotes || byBatch) refreshPrs()
      })
      .subscribe()

    return () => { try { supabase.removeChannel(channel) } catch {} }
  }, [isViewOpen?.id])

  // Load related purchase_requisitions when View modal opens
  useEffect(() => {
    const loadPrs = async () => {
      try {
        setViewPrLoading(true)
        setViewPrs([])
        if (!isViewOpen?.id) { setViewPrLoading(false); return }
        const poId = String(isViewOpen.id)
        // Find batches created from this PO
        const { data: batches } = await supabase
          .from('production_batches')
          .select('id')
          .eq('source_po_id', poId)

        const batchIds: string[] = Array.isArray(batches) ? batches.map((b: any) => String(b.id)) : []

        // Query 1: PRs directly linked to this PO (do not filter by status to avoid case/value mismatches)
        const { data: prByPo, error: errPo } = await supabase
          .from('purchase_requisitions')
          .select('id, item_name, required_qty, needed_by, status, created_at, notes')
          .eq('po_id', poId)
          .order('created_at', { ascending: false })

        // Query 2: PRs linked via batches created from this PO
        let prByBatch: any[] = []
        if (batchIds.length > 0) {
          const { data: pr2 } = await supabase
            .from('purchase_requisitions')
            .select('id, item_name, required_qty, needed_by, status, created_at, notes')
            .in('batch_id', batchIds)
            .order('created_at', { ascending: false })
          prByBatch = Array.isArray(pr2) ? pr2 : []
        }

        let all: any[] = []
        if (!errPo) all = [...(prByPo || []), ...prByBatch]

        // Fallback 1: search by notes containing poId
        if (all.length === 0) {
          const { data: prByNotes } = await supabase
            .from('purchase_requisitions')
            .select('id, item_name, required_qty, needed_by, status, created_at, notes')
            .ilike('notes', `%${poId}%`)
            .order('created_at', { ascending: false })
          if (Array.isArray(prByNotes)) all = [...all, ...prByNotes]
        }

        // Fallback 2: search by notes containing any batch id
        if (all.length === 0 && batchIds.length > 0) {
          for (const bid of batchIds) {
            const { data: prByBatchNotes } = await supabase
              .from('purchase_requisitions')
              .select('id, item_name, required_qty, needed_by, status, created_at, notes')
              .ilike('notes', `%${bid}%`)
              .order('created_at', { ascending: false })
            if (Array.isArray(prByBatchNotes)) all = [...all, ...prByBatchNotes]
          }
        }

        // Deduplicate and set
        const seen = new Set<string>()
        const uniq = all.filter((r: any) => { const id = String(r.id); if (seen.has(id)) return false; seen.add(id); return true })
        setViewPrs(uniq.map((r: any) => ({
          id: String(r.id),
          item_name: String(r.item_name || ''),
          required_qty: Number(r.required_qty || 0),
          needed_by: r.needed_by || null,
          status: String(r.status || 'Open'),
          created_at: r.created_at || null,
          notes: r.notes || null,
        })))
      } finally {
        setViewPrLoading(false)
      }
    }
    loadPrs()
  }, [isViewOpen?.id])

  const statusDescription = (st: string) => {
    const s = String(st || '').toLowerCase()
    if (s === 'draft') return 'Draft: not yet submitted or approved.'
    if (s === 'open') return 'Open: awaiting approval and allocation.'
    if (s === 'approved') return 'Approved: ready for stock allocation.'
    if (s === 'allocated') return 'Allocated: finished goods reserved for this order.'
    if (s === 'backordered') return 'Backordered: insufficient finished goods; pending production or replenishment.'
    if (s === 'on hold') return 'On Hold: blocked due to credit hold or rule validation.'
    if (s === 'closed') return 'Closed: fulfilled and completed.'
    if (s === 'canceled') return 'Canceled: the order has been canceled.'
    return '—'
  }

  // (removed duplicate hasViewShortfall; computed earlier near top with shortfallQty)

  // (removed) viewCopackAllocRows memo was unused after switching Copack table to viewLines
  // Pre-approval check: discontinued + substitutes
  const handleApproveClick = async (po: any) => {
    try {
      // Front-end priority validation
      // Rule applies ONLY to Brand POs (is_copack === false)
      if (!po?.is_copack) {
        // Refetch latest POs and evaluate only BRAND pending POs
        const { data: allPos } = await supabase
          .from('purchase_orders')
          .select('id, requested_ship_date, deposit_paid, created_at, status, is_copack')
          .order('created_at', { ascending: false })
        const list = Array.isArray(allPos) ? allPos : []
        
        // Pending + brand-only
        const pendingBrand = list.filter((p: any) => {
          const status = String(p.status || '').toLowerCase()
          const pending = status === 'open' || status === 'draft' || !status
          return pending && !p.is_copack
        })
        
        const sorted = [...pendingBrand].sort((a: any, b: any) => {
          const ad = new Date(a.requested_ship_date || 0).getTime()
          const bd = new Date(b.requested_ship_date || 0).getTime()
          if (ad !== bd) return ad - bd // earlier ship date first
          const adep = !!a.deposit_paid ? 1 : 0
          const bdep = !!b.deposit_paid ? 1 : 0
          if (adep !== bdep) return bdep - adep // deposit first
          const ac = new Date(a.created_at || 0).getTime()
          const bc = new Date(b.created_at || 0).getTime()
          return ac - bc // older first
        })
        const top = sorted[0]
        if (top && String(top.id) !== String(po.id)) {
          setShowPriorityModal(true)
          return
        }
      }

      // Load PO lines
      const { data: lines, error } = await supabase
        .from('purchase_order_lines')
        .select('id, product_name, quantity')
        .eq('purchase_order_id', po.id)
      if (error) throw error
      const poLines = (lines || []) as Array<{ id: string; product_name: string; quantity?: number }>

      // Detect discontinued
      const discontinuedItems = poLines.filter(l => {
        const prod = productsIndex[l.product_name]
        return !!prod?.is_discontinued
      })

      if (discontinuedItems.length === 0) {
        await approveAndAllocate(po) // pass full PO
        setToast({ show: true, message: po.is_copack ? 'PO approved successfully.' : 'PO approved successfully. THEN allocate by priority score.', kind: 'success' })
        return
      }

      const needsSubstitute = discontinuedItems.some(l => !(productsIndex[l.product_name]?.substitute_sku))
      if (needsSubstitute) {
        setToast({ show: true, message: PO_RULES.MESSAGES.discontinued, kind: 'error' })
        return
      }

      // Show modal to apply substitutes
      setPendingApproveId(String(po.id))
      setPendingLines(poLines)
      setShowSubModal(true)
    } catch (e: any) {
      setToast({ show: true, message: e?.message || 'Failed to prepare approval', kind: 'error' })
    }
  }

  const applySubstitutesAndApprove = async () => {
    if (!pendingApproveId) { setShowSubModal(false); return }
    try {
      // Update discontinued lines with substitutes
      const applied: string[] = []
      for (const l of pendingLines) {
        const prod = productsIndex[l.product_name]
        if (prod?.is_discontinued && prod?.substitute_sku) {
          applied.push(String(prod.substitute_sku))
          const { error } = await supabase
            .from('purchase_order_lines')
            .update({ product_name: prod.substitute_sku })
            .eq('id', l.id as string)
          if (error) throw error
        }
      }
      if (applied.length) setToast({ show: true, message: `Substitute applied: ${applied.join(', ')}`, kind: 'success' })
      setShowSubModal(false)
      setPendingLines([])
      const id = pendingApproveId
      setPendingApproveId(null)
      // find the full PO object so we can decide RPC by is_copack
      const poObj = (orders || []).find((o:any) => String(o.id) === String(id)) || { id }
      await approveAndAllocate(poObj)
      setToast({ show: true, message: poObj.is_copack ? 'PO approved successfully.' : 'PO approved successfully. THEN allocate by priority score.', kind: 'success' })
    } catch (e: any) {
      setToast({ show: true, message: e?.message || 'Failed to apply substitutes', kind: 'error' })
    }
  }

  const productsIndex = useMemo(() => {
    const idx: Record<string, any> = {}
    products.forEach(p => {
      const key = (p as any).sku || p.name
      if (key) idx[key] = p
    })
    return idx
  }, [products])

  // RPC response typing (subset)
  type AllocationSummary = { status?: string; total_shortfall?: number; lines?: any[] }
  // Normalize various allocation RPC payloads to CopackAllocationSummary shape
  const normalizeCopackSummary = (raw: any, poId: string) => {
    let src = Array.isArray(raw?.lines)
      ? raw.lines
      : Array.isArray(raw?.lines_materials)
        ? raw.lines_materials
        : []
    // Fallback: scan any array-valued fields for material-like rows
    if (src.length === 0 && raw && typeof raw === 'object') {
      const arrays = Object.values(raw).filter(Array.isArray) as any[]
      const candidates = arrays.flat().filter((r: any) => r && (r.material_name || r.material || r.name))
      if (candidates.length) src = candidates
    }
    const lines = src.map((ln: any) => {
      const required = Number(ln.required_qty ?? ln.required ?? ln.required_total ?? 0)
      const allocated = Number(ln.allocated_qty ?? ln.allocated ?? 0)
      const shortfall = Number(ln.shortfall_qty ?? ln.shortfall ?? Math.max(0, required - allocated))
      const isClient = !!(ln.is_client_material ?? ln.is_client ?? (typeof ln.client_inventory !== 'undefined'))
      return {
        po_line_id: String(ln.po_line_id ?? ln.line_id ?? ''),
        product: String(ln.product ?? ln.product_name ?? ''),
        material_id: String(ln.material_id ?? ln.id ?? ''),
        material_name: String(ln.material_name ?? ln.material ?? ln.name ?? '-'),
        required_qty: required,
        allocated_qty: allocated,
        shortfall_qty: shortfall,
        is_client_material: isClient,
      }
    })
    const total_required = lines.reduce((s: number, l: any) => s + Number(l.required_qty || 0), 0)
    const total_allocated = lines.reduce((s: number, l: any) => s + Number(l.allocated_qty || 0), 0)
    const total_shortfall = lines.reduce((s: number, l: any) => s + Number(l.shortfall_qty || 0), 0)
    const status = String(raw?.status || (total_shortfall > 0 ? 'backordered' : 'allocated')).toLowerCase()
    return {
      po_id: String(raw?.po_id || poId),
      status,
      total_required,
      total_allocated,
      total_shortfall,
      lines,
    }
  }

  // When allocation summary opens with backordered status, detect full shortfall and absence of finished_goods
  useEffect(() => {
    const check = async () => {
      try {
        setShowBackorderAdvisory(false)
        const sum: any = allocSummary
        if (!sum || String(sum?.status || '').toLowerCase() !== 'backordered') return
        // Skip FG advisory for Copack or OPS-supplied materials
        if (allocContext?.is_copack || allocContext?.operation_supplies_materials) return
        const lines: any[] = Array.isArray(sum?.lines) ? sum.lines : []
        if (lines.length === 0) return
        const allShortfall = lines.every((ln: any) => Number(ln?.allocated || ln?.allocated_qty || 0) === 0 && Number(ln?.shortfall || ln?.shortfall_qty || 0) > 0)
        if (!allShortfall) return
        const names = Array.from(new Set(lines.map((ln: any) => String(ln?.product || ln?.product_name || '').trim()).filter(Boolean)))
        if (names.length === 0) return
        const { data, error } = await supabase
          .from('finished_goods')
          .select('product_name')
          .in('product_name', names)
        if (error) return
        // Show advisory only if none of the products exist in finished_goods
        const found = new Set((data || []).map((r: any) => String(r.product_name || '')))
        const noneExist = names.every(n => !found.has(n))
        if (noneExist) setShowBackorderAdvisory(true)
      } catch {}
    }
    check()
  }, [allocSummary, allocContext?.is_copack, allocContext?.operation_supplies_materials])

  // substitute hook available if needed

  // Keep form.lines in sync from main product + additional products
  useEffect(() => {
    const lines: Array<{ sku?: string; product_name: string; qty: number; is_discontinued?: boolean; substitute_sku?: string | null }> = []
    const mainQty = Number(form.quantity || 0)
    if (form.product && mainQty > 0) {
      const prod = productsIndex[form.product] || {}
      lines.push({
        sku: (prod as any).sku,
        product_name: form.product,
        qty: mainQty,
        is_discontinued: (prod as any)?.is_discontinued,
        substitute_sku: (prod as any)?.substitute_sku ?? null,
      })
    }
    extraLines.forEach(l => {
      if (l.product && l.qty > 0) {
        const prod = productsIndex[l.product] || {}
        lines.push({
          sku: (prod as any).sku,
          product_name: l.product,
          qty: Number(l.qty || 0),
          is_discontinued: (prod as any)?.is_discontinued,
          substitute_sku: (prod as any)?.substitute_sku ?? null,
        })
      }
    })
    setForm(prev => ({ ...prev, lines }))
  }, [form.product, form.quantity, extraLines, productsIndex])

  useEffect(() => {
    const run = async () => {
      try {
        if (!form.is_copack) return
        const name = String(form.product || '').trim()
        if (!name || !isKnownProductName(name)) return
        if (lastCopackAutoSourceProductRef.current === name) return

        // only auto-set when a source hasn't been selected yet
        const cmr = !!form.client_materials_required
        const ops = !!form.operation_supplies_materials
        if (cmr || ops) {
          lastCopackAutoSourceProductRef.current = name
          return
        }

        // Get latest formula by name
        const { data: formulaRow } = await supabase
          .from('formulas')
          .select('id, version')
          .ilike('formula_name', name)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle()
        const formulaId = formulaRow?.id ? String(formulaRow.id) : null
        if (!formulaId) {
          lastCopackAutoSourceProductRef.current = name
          setForm((prev: any) => ({
            ...prev,
            client_materials_required: false,
            operation_supplies_materials: true,
          }))
          return
        }

        // Inspect formula items material source
        const { data: items } = await supabase
          .from('formula_items')
          .select('id, material_id, inventory_materials:inventory_materials!formula_items_material_id_fkey ( id, is_client_supplied )')
          .eq('formula_id', formulaId)

        const rows = Array.isArray(items) ? items : []
        if (rows.length === 0) {
          lastCopackAutoSourceProductRef.current = name
          setForm((prev: any) => ({
            ...prev,
            client_materials_required: false,
            operation_supplies_materials: true,
          }))
          return
        }

        const anyClient = rows.some((r: any) => {
          const mat = (r as any)?.inventory_materials
          return !!mat?.is_client_supplied
        })

        lastCopackAutoSourceProductRef.current = name
        setForm((prev: any) => ({
          ...prev,
          client_materials_required: anyClient,
          operation_supplies_materials: !anyClient,
        }))
      } catch {
        // do nothing; manual selection remains available
      }
    }
    run()
  }, [form.is_copack, form.product, form.client_materials_required, form.operation_supplies_materials, productsIndex])

  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(() => setToast({ show: false, message: '' }), 3000)
      return () => clearTimeout(t)
    }
  }, [toast.show])
  
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const [
        { data: cData, error: cErr },
        { data: pData, error: pErr },
        { data: oData, error: oErr },
        { data: fData },
        { data: fiData },
        { data: mats },
        { data: linesData }
      ] = await Promise.all([
        supabase.from('customers').select('id, company_name, credit_hold, overdue_balance, credit_limit, current_balance').order('company_name', { ascending: true }),
        supabase.from('products').select('id, product_name, is_discontinued, substitute_sku, case_qty').order('product_name', { ascending: true }),
        supabase.from('purchase_orders').select('*, risk_flag').order('created_at', { ascending: false }),
        supabase.from('formulas').select('id, formula_name, version, created_at, comments, customer_id, standard_yield, scrap_percent'),
        supabase.from('formula_items').select('formula_id, material_id, qty_per_unit, uom, percentage'),
        supabase.from('inventory_materials').select('id, is_client_supplied'),
        supabase.from('production_lines').select('id, line_name').order('line_name', { ascending: true }),
      ])
      if (cErr) setError('Cannot load customers')
      if (!cErr) setCustomers((cData ?? []).map((r: any) => ({ id: String(r.id), name: String(r.company_name ?? ''), credit_hold: !!r.credit_hold, overdue_balance: Number(r.overdue_balance ?? 0), credit_limit: Number(r.credit_limit ?? 0), current_balance: Number(r.current_balance ?? 0) })))
      if (!pErr) {
        const formulas = Array.isArray(fData) ? fData : []
        const items = Array.isArray(fiData) ? fiData : []
        const itemsByFormula = new Map<string, Array<{ material_id: string; qty_per_unit: string | null; uom: string | null; percentage: string | null }>>()
        items.forEach((it: any) => {
          const k = String(it.formula_id || '')
          if (!k) return
          if (!itemsByFormula.has(k)) itemsByFormula.set(k, [])
          itemsByFormula.get(k)!.push({
            material_id: String(it.material_id || ''),
            qty_per_unit: it.qty_per_unit ?? null,
            uom: it.uom ?? null,
            percentage: it.percentage ?? null,
          })
        })
        // pick the latest formula per formula_name (match product_name)
        const byName = new Map<string, any>()
        formulas.forEach((f:any) => {
          const key = String(f.formula_name || '').trim().toLowerCase()
          if (!key) return
          const prev = byName.get(key)
          if (!prev) byName.set(key, f)
          else {
            const va = Number(f.version ?? 0)
            const vb = Number(prev.version ?? 0)
            if (va >= vb) byName.set(key, f)
          }
        })
        const matFlag: Record<string, boolean> = {}
        ;(mats ?? []).forEach((m:any)=> { matFlag[String(m.id)] = !!m.is_client_supplied })
        const mapped = (pData ?? []).map((r:any) => {
          const pid = String(r.id)
          const f = byName.get(String(r.product_name || '').trim().toLowerCase()) || null
          const items = f ? (itemsByFormula.get(String(f.id)) || []) : []
          const hasClient = items.some((it:any)=> matFlag[String(it.material_id)] === true)
          const allOps = items.length > 0 && items.every((it:any)=> matFlag[String(it.material_id)] === false)
          return {
            id: pid,
            name: String(r.product_name ?? ''),
            is_discontinued: !!r.is_discontinued,
            substitute_sku: r.substitute_sku ?? null,
            case_qty: r.case_qty ?? null,
            formula: f ? {
              id: String(f.id),
              product_id: null,
              formula_name: String(f.formula_name || ''),
              version: f.version ?? null,
              comments: f.comments ?? null,
              customer_id: f.customer_id ?? null,
              standard_yield: f.standard_yield ?? null,
              scrap_percent: f.scrap_percent ?? null,
              items,
            } : null,
            meta: { has_client_supplied: hasClient, all_ops_supplied: allOps },
          }
        })
        setProducts(mapped)
      }
      if (!oErr) setOrders(oData ?? [])
      try {
        const list = (linesData ?? []).map((r:any)=> ({ id: String(r.id), name: String(r.line_name || '') }))
        setProductionLines(list)
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  // One-time normalization after customers and orders are loaded
  const didNormalize = useRef(false)
  useEffect(() => {
    if (didNormalize.current) return
    if ((customers?.length || 0) === 0) return
    if ((orders?.length || 0) === 0) return
    didNormalize.current = true
    refreshPOs()
  }, [customers.length, orders.length])


  // validation handled by validatePODraft

  const resetForm = () => {
    setForm({
      date: '',
      customer: '',
      customer_id: '',
      po_number: '',
      product: '',
      requestedShipDate: '',
      ship_date: '',
      quantity: '',
      caseQty: '',
      paymentTerms: '',
      salesRepresentative: '',
      additionalPackaging: '',
      status: 'Open',
      comments: '',
      location: '',
      is_copack: false,
      client_materials_required: false,
      operation_supplies_materials: false,
      deposit_paid: false,
      lines: []
    })
  }

  const saveOrder = async () => {
    setError(null)

    if (!form.is_copack) {
      const mainName = String(form.product || '').trim()
      if (!mainName || !isKnownProductName(mainName)) {
        setToast({ show: true, message: 'Please select a product from the Products list.', kind: 'error' })
        return
      }
      const badExtra = (extraLines || []).find((l) => {
        const n = String(l?.product || '').trim()
        if (!n) return false
        return !isKnownProductName(n)
      })
      if (badExtra) {
        setToast({ show: true, message: 'One or more additional products are not in the Products list. Please select from the suggestions.', kind: 'error' })
        return
      }
    }

    // Build draft payload from UI
    const selectedCustomerId = customers.find(c => c.name === form.customer)?.id || null
    const draft = {
      customer_id: form.customer_id || selectedCustomerId || null,
      ship_date: form.ship_date,
      location: form.location,
      is_copack: !!form.is_copack,
      client_materials_required: !!form.client_materials_required,
      operation_supplies_materials: !!form.operation_supplies_materials,
      lines: (form.lines || []).map(l => ({
        sku: (l as any).sku,
        product_name: l.product_name,
        qty: Number((l as any).qty || 0),
        is_discontinued: (l as any).is_discontinued,
        substitute_sku: (l as any).substitute_sku,
      })),
    }

    // Enforce Copack sourcing strict rules before proceeding
    if (draft.is_copack) {
      const count = (draft.client_materials_required ? 1 : 0) + (draft.operation_supplies_materials ? 1 : 0)
      if (count !== 1) {
        setToast({
          show: true,
          message: count === 0 ? 'Copack orders must select a material source.' : 'Only one material source can be enabled for a Copack order.',
          kind: count === 0 ? 'error' : 'warning'
        })
        return
      }
    }

    const customer = customers.find(c => c.id === draft.customer_id) || null
    let ruleResult: any = null

    // Brand vs Copack validation
    if (draft.is_copack) {
      // Minimal validation for Copack orders: require Quantity and Location only
      const qtyOk = Number(form.quantity || 0) > 0
      const locationOk = !!draft.location
      if (!qtyOk || !locationOk) {
        setToast({ show: true, message: 'For Copack orders, please provide Quantity and Location.', kind: 'error' })
        return
      }
      // Skip brand rule engine for Copack
    } else {
      // VALIDATE AGAINST RULE ENGINE (Brand PO)
      ruleResult = validatePODraft(draft, customer, productsIndex)
      if (!ruleResult.ok) {
        setToast({ show: true, message: ruleResult.errors.join(' '), kind: 'error' })
        return
      }
    }

    // Auto status & risk flag rules
    let status = form.status || 'Draft'
    const creditHold = !!(customer as any)?.credit_hold
    const limit = Number((customer as any)?.credit_limit ?? 0)
    const overLimit = Number((customer as any)?.current_balance ?? 0) > limit
    const overdueOverLimit = Number((customer as any)?.overdue_balance ?? 0) > limit
    let risk_flag = false
    if (creditHold) {
      status = 'On Hold'
      risk_flag = true
    } else if (overLimit || overdueOverLimit) {
      // Credit hold is false but exceeds limit/overdue → mark as Risk
      status = 'Risk'
      risk_flag = true
    }

    // Business rule: once a purchase is submitted, it starts as On Hold
    if (!isEditOpen && String(status || '').toLowerCase() === 'open') {
      status = 'On Hold'
    }
    if (String(status || '').toLowerCase() === 'submitted') {
      status = 'On Hold'
    }

    let is_rush = false
    if (ruleResult?.flags?.rush === true) is_rush = true

    setLoading(true)
    try {
      const resolveSub = (name?: string | null) => {
        const n = String(name || '').trim()
        if (!n) return n
        const prod = products.find(p => p.name === n)
        if (prod?.is_discontinued && prod?.substitute_sku) {
          const sub = products.find(p => (p as any).sku === prod.substitute_sku)
          return sub?.name || String(prod.substitute_sku)
        }
        return n
      }

      const resolveSubMeta = (name?: string | null) => {
        const n = String(name || '').trim()
        if (!n) return { name: n, id: null as string | null }
        const prod = products.find(p => p.name === n) || null
        if (prod?.is_discontinued && prod?.substitute_sku) {
          const sub = products.find(p => (p as any).sku === prod.substitute_sku) || null
          return { name: sub?.name || String(prod.substitute_sku), id: (sub as any)?.id || null }
        }
        return { name: n, id: (prod as any)?.id || null }
      }
      const mainProd = products.find(p => p.name === form.product) || null
      const resolved = resolveSubMeta(form.product)
      let po_id: string
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
      const shipDate = draft.is_copack ? (draft.ship_date || form.requestedShipDate || form.date || todayStr) : (draft.ship_date || null)

      if (isEditOpen?.id) {
        // UPDATE existing head
        const { error: upErr } = await supabase
          .from('purchase_orders')
          .update({
            date: form.date || null,
            customer_id: draft.customer_id,
            customer_name: form.customer || (customers.find(c=>c.id===draft.customer_id)?.name || null),
            po_number: form.po_number || null,
            product_id: resolved.id ?? mainProd?.id ?? null,
            product_name: resolved.name || null,
            requested_ship_date: shipDate,
            quantity: form.quantity ? Number(form.quantity) : null,
            case_qty: form.caseQty ? Number(form.caseQty) : null,
            location: draft.location || null,
            status,
            risk_flag,
            deposit_paid: !!form.deposit_paid,
            is_rush,
            is_copack: !!draft.is_copack,
            client_materials_required: !!draft.client_materials_required,
            operation_supplies_materials: !!draft.operation_supplies_materials,
            payment_terms: form.paymentTerms || null,
            sales_representative: form.salesRepresentative || null,
            additional_packaging: form.additionalPackaging || null,
            notes: form.comments || null,
          })
          .eq('id', isEditOpen.id)
        if (upErr) throw upErr
        po_id = String(isEditOpen.id)
      } else {
        // INSERT head
        const { data: poHead, error: headErr } = await supabase
          .from('purchase_orders')
          .insert({
            date: form.date || null,
            customer_id: draft.customer_id,
            customer_name: form.customer || (customers.find(c=>c.id===draft.customer_id)?.name || null),
            po_number: form.po_number || null,
            product_id: resolved.id ?? mainProd?.id ?? null,
            product_name: resolved.name || null,
            requested_ship_date: shipDate,
            quantity: form.quantity ? Number(form.quantity) : null,
            case_qty: form.caseQty ? Number(form.caseQty) : null,
            location: draft.location || null,
            status,
            risk_flag,
            deposit_paid: !!form.deposit_paid,
            is_rush,
            is_copack: !!draft.is_copack,
            client_materials_required: !!draft.client_materials_required,
            operation_supplies_materials: !!draft.operation_supplies_materials,
            payment_terms: form.paymentTerms || null,
            sales_representative: form.salesRepresentative || null,
            additional_packaging: form.additionalPackaging || null,
            notes: form.comments || null,
          })
          .select()
          .single()
        if (headErr) throw headErr
        po_id = String(poHead.id)
      }

      // Replace lines for this PO
      await supabase.from('purchase_order_lines').delete().eq('purchase_order_id', po_id)

      let linesPayload = (draft.lines || []).map(l => ({
        purchase_order_id: po_id,
        product_name: resolveSub(l.product_name),
        quantity: l.qty,
      }))

      // For Copack orders, auto-create a single line from the selected product and quantity
      if (draft.is_copack) {
        const baseName = resolveSub(form.product || mainProd?.name || '')
        const qty = Number(form.quantity || 0)
        linesPayload = [{ purchase_order_id: po_id, product_name: baseName, quantity: qty }]
      }

      if (linesPayload.length === 0) throw new Error('PO must have at least one line.')

      const { error: linesErr } = await supabase
        .from('purchase_order_lines')
        .insert(linesPayload)

      if (linesErr) throw linesErr

      // Show SEPARATE toasts: rush, creditHold, then success
      const queue: Array<{ message: string; kind?: 'success'|'warning'|'error' }> = []
      if (is_rush) queue.push({ message: PO_RULES.MESSAGES.rush, kind: 'warning' })
      if (status === 'On Hold') queue.push({ message: PO_RULES.MESSAGES.creditHold, kind: 'warning' })
      queue.push({ message: isEditOpen ? 'PO updated successfully.' : 'PO created successfully.', kind: 'success' })

      const showQueue = (i = 0) => {
        if (i >= queue.length) return
        setToast({ show: true, message: queue[i].message, kind: queue[i].kind })
        setTimeout(() => showQueue(i + 1), 3200)
      }
      showQueue(0)

      // Refresh orders list
      const { data } = await supabase.from('purchase_orders').select('*, risk_flag').order('created_at', { ascending: false })
      setOrders(data ?? [])
      resetForm()
      setIsAddOpen(false)
      setIsEditOpen(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to save PO.')
    } finally {
      setLoading(false)
    }
  }

  const removeOrder = async (id: string) => {
    setError(null)
    try {
      // Capture affected products BEFORE delete (lines may be cascade-deleted)
      const { data: lines } = await supabase
        .from('purchase_order_lines')
        .select('product_name')
        .eq('purchase_order_id', id)

      const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
      if (error) { setError('Failed to delete order'); return }
      setOrders(orders.filter(o => o.id !== id))
      setToast({ show: true, message: 'Purchase order deleted' })

      // Cleanup FG placeholder rows: if FG.available_qty == 0 and no other active PO lines for the product, delete FG row
      const products = Array.from(new Set((lines ?? []).map((l: any) => String(l.product_name || '').trim()).filter(Boolean)))
      if (products.length) {
        // Find active PO ids (not Canceled/Closed)
        const { data: poRows } = await supabase
          .from('purchase_orders')
          .select('id, status')
        const activeIds = (poRows ?? [])
          .filter((p: any) => {
            const st = String(p.status || '')
            return st !== 'Canceled' && st !== 'Closed'
          })
          .map((p: any) => String(p.id))

        await Promise.all(products.map(async (name) => {
          // Any other active lines for this product?
          let hasOther = false
          if (activeIds.length) {
            const { data: other } = await supabase
              .from('purchase_order_lines')
              .select('id')
              .eq('product_name', name)
              .in('purchase_order_id', activeIds)
              .limit(1)
            hasOther = Array.isArray(other) && other.length > 0
          }
          if (hasOther) return
          // Check FG row and delete if available_qty == 0
          const { data: fg } = await supabase
            .from('finished_goods')
            .select('id, available_qty')
            .eq('product_name', name)
            .limit(1)
          const row = fg?.[0]
          if (row?.id && Number(row.available_qty || 0) === 0) {
            await supabase.from('finished_goods').delete().eq('id', row.id)
          }
        }))
      }
    } catch (e) {
      // non-fatal cleanup errors should not block UI
    }
  }

  // Helper to run RPC with skip/error handling
  const runRpc = async (name: string, poId: string) => {
    const { data, error } = await supabase.rpc(name, { p_po_id: poId })
    if (error) return { status: 'error', message: error.message, data: null }
    const status = (data as any)?.status || (data ? 'ok' : 'ok')
    return { status: String(status).toLowerCase(), message: (data as any)?.message || null, data }
  }

  // Ship PO (full ship) RPC function - used for 'Ready to Ship' rows
  async function shipPO(poId: string) {
    try {
      const { data, error } = await supabase.rpc('fn_ship_po', { p_po_id: poId })
      if (error) throw error

      // If backend returns ASN rows, open the ASN modal immediately
      if ((data as any)?.asn && Array.isArray((data as any).asn) && (data as any).asn.length > 0) {
        setAsnData((data as any).asn)
        setAsnPoStatus('shipped')
        setAsnModalOpen(true)
      }

      setToast({ show: true, message: 'PO shipped successfully!', kind: 'success' })
      await refreshPOs()
    } catch (err: any) {
      const msg = String(err?.message || '')
      const code = err?.code ? String(err.code) : ''
      const details = err?.details ? String(err.details) : ''
      const hint = err?.hint ? String(err.hint) : ''
      console.error('fn_ship_po failed', { msg, code, details, hint, err })
      const isWarehouse = String(currentRole || '').toLowerCase() === 'warehouse'

      // If role was recently changed, JWT claims may be stale. Try refresh session once.
      if (isWarehouse && msg.toLowerCase().includes('only warehouse')) {
        try {
          await supabase.auth.refreshSession()
          const { data: retryData, error: retryErr } = await supabase.rpc('fn_ship_po', { p_po_id: poId })
          if (retryErr) throw retryErr

          if ((retryData as any)?.asn && Array.isArray((retryData as any).asn) && (retryData as any).asn.length > 0) {
            setAsnData((retryData as any).asn)
            setAsnPoStatus('shipped')
            setAsnModalOpen(true)
          }

          setToast({ show: true, message: 'PO shipped successfully!', kind: 'success' })
          await refreshPOs()
          return
        } catch (retryErr: any) {
          const rMsg = String(retryErr?.message || '')
          const rCode = retryErr?.code ? String(retryErr.code) : ''
          const rDetails = retryErr?.details ? String(retryErr.details) : ''
          const rHint = retryErr?.hint ? String(retryErr.hint) : ''
          console.error('Ship retry after refreshSession failed:', { rMsg, rCode, rDetails, rHint, retryErr })
          setToast({
            show: true,
            message: `Failed to ship PO after session refresh. ${rMsg || msg || 'Unknown error'}${rCode ? ` (code: ${rCode})` : ''}`,
            kind: 'error'
          })
          return
        }
      }

      const extra = [details, hint].filter(Boolean).join(' | ')
      setToast({
        show: true,
        message: `Failed to ship PO. ${msg || 'Unknown error'}${code ? ` (code: ${code})` : ''}${extra ? ` — ${extra}` : ''}`,
        kind: 'error'
      })
    }
  }

  // View ASN for shipped orders
  async function viewASN(poId: string) {
    try {
      // Open immediately, then load
      setAsnLoading(true)
      setAsnModalOpen(true)

      const { data, error } = await supabase
        .from('asn')
        .select(`
          id,
          po_id,
          po_line_id,
          asn_number,
          tracking_number,
          carrier,
          shipped_qty,
          created_at,
          customer_id,
          product_name
        `)
        .eq('po_id', poId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = data || []
      setAsnData(rows);
      // Cache shipped total for this PO to drive UI conditions
      const shippedSum = Array.isArray(rows) ? rows.reduce((s: number, r: any) => s + Number(r?.shipped_qty ?? 0), 0) : 0
      setShippedTotals(prev => ({ ...prev, [poId]: shippedSum }))
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: "Failed to load ASN data.", kind: 'error' });
    } finally {
      setAsnLoading(false)
    }
  }

  // Mark PO as Ready to Ship
  async function markReadyToShip(poId: string) {
    try {
      const { error } = await supabase.rpc("fn_mark_ready_to_ship", {
        p_po_id: poId,
      });

      if (error) throw error;

      setToast({ show: true, message: "PO marked as Ready to Ship!", kind: 'success' });

      const { data: poRows } = await supabase
        .from('purchase_orders')
        .select('*, risk_flag')
        .order('created_at', { ascending: false });

      setOrders(poRows ?? []);
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: "Failed to mark Ready to Ship.", kind: 'error' });
    }
  }

  // Approve + Allocate for a single PO (final action)
  const approveAndAllocate = async (po: any) => {
    const poId = String(po.id)
    try {
      setError(null)

      // Load the most recent PO to decide the flow
      const { data: poRow, error: fetchErr } = await supabase
        .from('purchase_orders')
        .select('*, risk_flag')
        .eq('id', poId)
        .maybeSingle()
      if (fetchErr) throw fetchErr
      const poRec: any = poRow || po

      // 1) Mark as approved (idempotent)
      await supabase.from('purchase_orders').update({ status: 'approved' }).eq('id', poId)

          // Debug scratch
      const dbg: any = { po_id: poId, is_copack: !!poRec.is_copack, client_materials_required: !!poRec.client_materials_required, operation_supplies_materials: !!poRec.operation_supplies_materials, allocator_executed: null, trigger_fired: null, batch_created: false, batch_ids: [], sql_notices: [], ts: new Date().toISOString() }
      // Snapshot batches before
      try {
        const { data: beforeB } = await supabase.from('production_batches').select('id').eq('source_po_id', poId)
        dbg._before_batches = (beforeB || []).map((r:any)=>String(r.id))
      } catch {}

   if (!!poRec.is_copack) {
  // COPACK MODE — call the new unified RPC
  const seq = [
    'fn_copack_material_check',
    'allocate_copack_po_operations',        // ✅ NEW main allocator
    'allocate_copack_po_client_materials',  // optional
    'allocate_copack_po_ops_dual_pr'
  ]

  let finalSummary: any = null

  for (const name of seq) {
    const res = await runRpc(name, poId)

    if (res.status === 'error') {
      setToast({ show: true, message: res.message || 'RPC Error', kind: 'error' })
      break
    }

    if (DEBUG_PO)
      dbg.sql_notices.push(`${name}: ${res.status}${res.message ? ` – ${res.message}` : ''}`)

    // capture allocator output
    if (name === 'allocate_copack_po_operations' && res.data) {
      finalSummary = res.data
      if (DEBUG_PO) dbg.allocator_executed = name
    }
  }

  if (DEBUG_PO) dbg.trigger_fired = 'trg_copack_po_on_approve'

  // ─── Bundle/KIT packaging rule: block batch creation when shortfall exists ───
  try {
    const sum = (finalSummary || {}) as AllocationSummary
    const isBundle = ['kit', 'bundle'].includes(String(poRec?.packaging_type || '').toLowerCase())
    const notAllocated = String(sum.status || '').toLowerCase() !== 'allocated'
    const hasShort = Number(sum.total_shortfall || 0) > 0
    if (isBundle && (notAllocated || hasShort)) {
      setIsBundleBlocked(true)
      const missing = Array.isArray(sum.lines) ? sum.lines.filter((l:any)=> Number(l.shortfall_qty||0) > 0) : []
      setBundleBlockInfo({
        title: 'Bundle Packaging Requires Full Materials',
        message: 'This product is a KIT/BUNDLE. All components must be fully available before a Production Order can start.',
        missing: missing.map((m:any)=>({ material: m.material_name || m.product_name, product_name: m.product_name, shortfall_qty: m.shortfall_qty }))
      })
      if (DEBUG_PO) { dbg.bundle_blocked = true; dbg.bundle_missing = Number(sum.total_shortfall || 0) }
      // STOP approval flow
      if (DEBUG_PO) setDebugMap(prev => ({ ...prev, [poId]: dbg }))
      return
    }
  } catch {}

  // Create (or ensure) Copack batch for this PO
  try {
    const batchRes = await runRpc('fn_auto_create_copack_batch_for_po', poId)
    if (DEBUG_PO) dbg.batch_creation = batchRes
    if (batchRes?.status === 'error') {
      console.error('Batch creation failed:', batchRes)
    }
  } catch (err) {
    console.error('Batch creation RPC error:', err)
  }

  // refresh PO list
  const { data: poRows } = await supabase
    .from('purchase_orders')
    .select('*, risk_flag')
    .order('created_at', { ascending: false })

  setOrders(poRows ?? [])

  // summary modal
  setAllocContext({
    is_copack: true,
    operation_supplies_materials: !!poRec.operation_supplies_materials
  })

  const normalized = normalizeCopackSummary(finalSummary || {}, poId)
  setCopackSummary(normalized)
  setLastApprovedId(poId)

  // detect new batches
  try {
    const { data: afterB } = await supabase
      .from('production_batches')
      .select('id')
      .eq('source_po_id', poId)

    const after = (afterB || []).map((r: any) => String(r.id))
    const before = Array.isArray(dbg._before_batches) ? dbg._before_batches : []
    const newOnes = after.filter((id: string) => !before.includes(id))

    if (DEBUG_PO) {
      dbg.batch_created = newOnes.length > 0
      dbg.batch_ids = newOnes
    }
  } catch {}

  if (DEBUG_PO) setDebugMap(prev => ({ ...prev, [poId]: dbg }))

  setToast({
    show: true,
    message: `Allocation result: ${String(finalSummary?.status || 'done')}`,
    kind: finalSummary?.status === 'allocated' ? 'success' : 'warning'
  })

  return
}


      // BRAND MODE — call the single allocation RPC (finished-first)
      const brandSeq = [
        'allocate_brand_po_finished_first',
      ]
      let brandSummary: any = null
      for (const name of brandSeq) {
        const res = await runRpc(name, poId)
        if (res.status === 'error') {
          setToast({ show: true, message: res.message || 'RPC Error', kind: 'error' })
          break
        }

        if ((name === 'allocate_brand_po_finished_first') && res.data) {
          brandSummary = res.data
          // FEFO block: only for BRAND POs (not Copack)
          try {
            const isBrand = !poRec.is_copack && String(poRec.po_type || 'brand').toLowerCase() === 'brand'
            if (isBrand) {
              const result: any = res.data
              if (result?.fefo_block === true || String(result?.status || '').toLowerCase() === 'blocked_fefo') {
                setFefoWarning({
                  expired_lot: result.expired_lot || result.lot_number,
                  exp_date: result.expiry_date,
                  suggest_lot: result.suggested_lot,
                  suggest_expiry: result.suggested_expiry,
                })
                // Open the allocation modal to surface the warning and stop approval flow
                setAllocContext({ is_copack: false, operation_supplies_materials: false })
                setAllocSummary(result)
                setIsAllocOpen(true)
                if (DEBUG_PO) { dbg.fefo_blocked = true }
                if (DEBUG_PO) setDebugMap(prev => ({ ...prev, [poId]: dbg }))
                return
              }
            }
          } catch {}
        }
        if (DEBUG_PO && name === 'allocate_brand_po_finished_first') dbg.allocator_executed = 'allocate_brand_po_finished_first'
      }
      if (DEBUG_PO) dbg.trigger_fired = 'trg_allocate_po_on_approve'

      // Refresh PO list
      const { data: poRows } = await supabase
        .from('purchase_orders')
        .select('*, risk_flag')
        .order('created_at', { ascending: false })
      setOrders(poRows ?? [])

      // Load purchase_order_lines for this PO (for UI display)
      try {
        const { data: pol } = await supabase
          .from('purchase_order_lines')
          .select('product_name, quantity, allocated_qty, shortfall_qty, status')
          .eq('purchase_order_id', poId)
          .order('created_at', { ascending: true })
        const rows = Array.isArray(pol) ? pol.map((r:any)=>({
          product_name: String(r.product_name || ''),
          quantity: Number(r.quantity || 0),
          allocated_qty: Number(r.allocated_qty || 0),
          shortfall_qty: Number(r.shortfall_qty || 0),
          status: String(r.status || '')
        })) : []
        setAllocLines(rows)
      } catch { setAllocLines([]) }

      // Show Brand allocation modal
      setAllocContext({ is_copack: false, operation_supplies_materials: false })
      setAllocSummary(brandSummary || null)
      setLastApprovedId(poId)
      // Detect batches after
      try {
        const { data: afterB } = await supabase.from('production_batches').select('id').eq('source_po_id', poId)
        const after = (afterB || []).map((r:any)=>String(r.id))
        const before = Array.isArray(dbg._before_batches) ? dbg._before_batches : []
        const newOnes = after.filter((id:string)=>!before.includes(id))
        if (DEBUG_PO) { dbg.batch_created = newOnes.length > 0; dbg.batch_ids = newOnes }
      } catch {}
      if (DEBUG_PO) setDebugMap(prev => ({ ...prev, [poId]: dbg }))
      setIsAllocOpen(true)
      setToast({
        show: true,
        message: `Allocation result: ${String((brandSummary as any)?.status || 'done')}`,
        kind: (brandSummary as any)?.status === 'allocated' ? 'success' : 'warning',
      })
    } catch (e: any) {
      setError(e?.message || 'Failed to approve and allocate')
      setToast({ show: true, message: e?.message || 'Allocation failed', kind: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-2 sm:p-4 lg:p-6">
        <span className="hidden" aria-hidden="true">{String(isBundleBlocked)}{bundleBlockInfo?.title || ''}</span>
        {toast.show && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70]">
            <div className={`flex items-center gap-3 bg-white rounded-xl shadow-2xl border px-4 py-3 animate-fade-in ${toast.kind==='error' ? 'border-accent-danger/40' : 'border-neutral-soft/40'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.kind==='error' ? 'bg-accent-danger/10' : 'bg-accent-success/15'}`}>
                <CheckCircle2 className={`h-5 w-5 ${toast.kind==='error' ? 'text-accent-danger' : 'text-accent-success'}`} />
              </div>
              <span className="text-sm font-semibold text-neutral-dark">{toast.message}</span>
            </div>
          </div>
        )}

        {isBundleBlocked && bundleBlockInfo && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setIsBundleBlocked(false); setBundleBlockInfo(null) }} />
            <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-dark">{bundleBlockInfo.title}</h3>
                <button className="p-2" onClick={() => { setIsBundleBlocked(false); setBundleBlockInfo(null) }}><X className="h-5 w-5"/></button>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <p className="text-neutral-dark">{bundleBlockInfo.message}</p>
                {Array.isArray(bundleBlockInfo.missing) && bundleBlockInfo.missing.length > 0 && (
                  <div className="border border-neutral-soft/40 rounded-xl bg-neutral-light/20 overflow-hidden">
                    <div className="px-4 py-2 text-xs font-medium text-neutral-medium uppercase tracking-wide border-b border-neutral-soft/40">Missing Components</div>
                    <ul className="divide-y divide-neutral-soft/40">
                      {bundleBlockInfo.missing.map((m, i) => (
                        <li key={i} className="px-4 py-2 flex items-center justify-between">
                          <span className="text-neutral-dark">{m.material || m.product_name || '-'}</span>
                          <span className="text-neutral-medium text-xs">Shortfall: {Number(m.shortfall_qty || 0)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all"
                    onClick={() => { setIsBundleBlocked(false); setBundleBlockInfo(null) }}
                  >
                    OK – I'll resolve the shortages
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAddCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-neutral-dark mb-4">Add New Customer</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCustomerName.trim() && !addingCustomer) {
                      const v = newCustomerName.trim()
                      setAddingCustomer(true)
                      ;(async () => {
                        try {
                          const { data, error } = await supabase
                            .from('customers')
                            .insert({ company_name: v })
                            .select('id, company_name, credit_hold, overdue_balance, credit_limit, current_balance')
                            .maybeSingle()
                          if (error) throw error
                          const row: any = data || null
                          const id = String(row?.id || '')
                          if (!id) throw new Error('Customer not created')
                          const nextCustomer = {
                            id,
                            name: String(row?.company_name ?? v),
                            credit_hold: !!row?.credit_hold,
                            overdue_balance: Number(row?.overdue_balance ?? 0),
                            credit_limit: Number(row?.credit_limit ?? 0),
                            current_balance: Number(row?.current_balance ?? 0),
                          }
                          setCustomers((prev) => {
                            const dedup = (prev || []).filter((c) => String(c.id) !== String(nextCustomer.id))
                            const merged = [...dedup, nextCustomer]
                            merged.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                            return merged
                          })
                          setForm((prev: any) => ({ ...prev, customer: nextCustomer.name, customer_id: nextCustomer.id }))
                          setShowAddCustomer(false)
                          setNewCustomerName('')
                          setToast({ show: true, message: 'Customer added', kind: 'success' })
                        } catch (err: any) {
                          setToast({ show: true, message: err?.message || 'Failed to add customer', kind: 'error' })
                        } finally {
                          setAddingCustomer(false)
                        }
                      })()
                    }
                  }}
                  className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { if (!addingCustomer) { setShowAddCustomer(false); setNewCustomerName('') } }}
                    className="flex-1 px-4 py-2 border border-neutral-soft rounded-lg text-neutral-dark hover:bg-neutral-light disabled:opacity-50"
                    disabled={addingCustomer}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const v = newCustomerName.trim()
                      if (!v || addingCustomer) return
                      setAddingCustomer(true)
                      try {
                        const { data, error } = await supabase
                          .from('customers')
                          .insert({ company_name: v })
                          .select('id, company_name, credit_hold, overdue_balance, credit_limit, current_balance')
                          .maybeSingle()
                        if (error) throw error
                        const row: any = data || null
                        const id = String(row?.id || '')
                        if (!id) throw new Error('Customer not created')
                        const nextCustomer = {
                          id,
                          name: String(row?.company_name ?? v),
                          credit_hold: !!row?.credit_hold,
                          overdue_balance: Number(row?.overdue_balance ?? 0),
                          credit_limit: Number(row?.credit_limit ?? 0),
                          current_balance: Number(row?.current_balance ?? 0),
                        }
                        setCustomers((prev) => {
                          const dedup = (prev || []).filter((c) => String(c.id) !== String(nextCustomer.id))
                          const merged = [...dedup, nextCustomer]
                          merged.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                          return merged
                        })
                        setForm((prev: any) => ({ ...prev, customer: nextCustomer.name, customer_id: nextCustomer.id }))
                        setShowAddCustomer(false)
                        setNewCustomerName('')
                        setToast({ show: true, message: 'Customer added', kind: 'success' })
                      } catch (err: any) {
                        setToast({ show: true, message: err?.message || 'Failed to add customer', kind: 'error' })
                      } finally {
                        setAddingCustomer(false)
                      }
                    }}
                    disabled={!newCustomerName.trim() || addingCustomer}
                    className="flex-1 px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                  >
                    {addingCustomer ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ASN Modal - System Design Standards */}
        {asnModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setAsnModalOpen(false); setAsnPoStatus(null) }} />
            <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-dark to-primary-medium px-6 py-5 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Shipment Notification</h3>
                      <p className="text-primary-light/80 text-sm">Advanced Shipping Notice (ASN)</p>
                    </div>
                  </div>
                  {asnLoading && (
                    <span className="mr-3 px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/90 border border-white/20">Loading…</span>
                  )}
                  <button 
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors" 
                    onClick={() => { setAsnModalOpen(false); setAsnPoStatus(null) }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-neutral-light/30 flex-1 overflow-y-auto">
                {asnData.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-neutral-soft rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-neutral-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-neutral-dark mb-2">No Shipments Found</h4>
                    <p className="text-neutral-medium">No ASN data available for this purchase order.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {asnData.map((asn, index) => (
                      <div key={asn.id || index} className="bg-white border border-neutral-soft rounded-xl p-6 hover:shadow-lg">
                        {/* Shipment Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            {(() => {
                              // Check if this is a remaining shipment (created from Ship Remaining button)
                              const isRemainingShipment = asn.asn_number && asn.asn_number.includes('REMAINING')
                              // Check if this is a partial shipment (orange)
                              const isPartialShipment = asnPoStatus === 'partially_shipped' && !isRemainingShipment
                              
                              const iconWrapClass = isRemainingShipment
                                ? 'bg-blue-100'  // Blue for remaining shipment
                                : isPartialShipment 
                                  ? 'bg-orange-100'  // Orange for partial shipment
                                  : 'bg-accent-success/10'  // Green for complete shipment
                              
                              const iconClass = isRemainingShipment
                                ? 'text-blue-600'
                                : isPartialShipment 
                                  ? 'text-orange-600'
                                  : 'text-accent-success'
                              
                              return (
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconWrapClass}`}>
                                  <svg className={`w-6 h-6 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                </div>
                              )
                            })()}
                            <div>
                              <h4 className="text-lg font-bold text-neutral-dark">{asn.asn_number || 'ASN-UNKNOWN'}</h4>
                              {(() => {
                                const isRemainingShipment = asn.asn_number && asn.asn_number.includes('REMAINING')
                                const isPartialShipment = asnPoStatus === 'partially_shipped' && !isRemainingShipment
                                
                                const lineClass = isRemainingShipment 
                                  ? 'text-blue-600' 
                                  : isPartialShipment 
                                    ? 'text-orange-600' 
                                    : 'text-neutral-medium'
                                
                                const prefix = isRemainingShipment 
                                  ? 'Remaining Shipment on ' 
                                  : isPartialShipment 
                                    ? 'Partial Shipment on ' 
                                    : 'Shipped on '
                                
                                return (
                                  <p className={`text-sm ${lineClass}`}>
                                    {prefix}{asn.created_at ? new Date(asn.created_at).toLocaleDateString('en-US', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    }) : 'Unknown Date'}
                                  </p>
                                )
                              })()}
                            </div>
                          </div>
                          <div className="text-right">
                            {(() => {
                              const isRemainingShipment = asn.asn_number && asn.asn_number.includes('REMAINING')
                              const isPartialShipment = asnPoStatus === 'partially_shipped' && !isRemainingShipment
                              
                              if (isRemainingShipment) {
                                return (
                                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                    Remaining Shipment
                                  </div>
                                )
                              }
                              
                              if (isPartialShipment) {
                                return (
                                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                                    Partial Shipment
                                  </div>
                                )
                              }
                              
                              return (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent-success/10 text-accent-success border border-accent-success/20">
                                  Shipped
                                </div>
                              )
                            })()}
                          </div>
                        </div>

                        {/* Shipment Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Product Info */}
                          <div className="space-y-3">
                            <h5 className="font-semibold text-neutral-dark text-sm uppercase tracking-wide">Product Details</h5>
                            <div className="bg-neutral-light rounded-xl p-4 border border-neutral-soft/40">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-primary-light/10 rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-primary-medium" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2L3 7v11a1 1 0 001 1h12a1 1 0 001-1V7l-7-5zM10 12a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="font-medium text-neutral-dark">{asn.product_name || 'Unknown Product'}</p>
                                  <p className="text-sm text-neutral-medium">Qty: {Number(asn.shipped_qty || 0).toLocaleString()} units</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Carrier Info */}
                          <div className="space-y-3">
                            <h5 className="font-semibold text-neutral-dark text-sm uppercase tracking-wide">Carrier Information</h5>
                            <div className="bg-neutral-light rounded-xl p-4 border border-neutral-soft/40">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-accent-warning/10 rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-accent-warning" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707L16 7.586A1 1 0 0015.414 7H14z"/>
                                  </svg>
                                </div>
                                <div>
                                  <p className="font-medium text-neutral-dark">{asn.carrier || 'UPS'}</p>
                                  <p className="text-sm text-neutral-medium">Standard Delivery</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Tracking Info */}
                          <div className="space-y-3">
                            <h5 className="font-semibold text-neutral-dark text-sm uppercase tracking-wide">Tracking</h5>
                            <div className="bg-neutral-light rounded-xl p-4 border border-neutral-soft/40">
                              {asn.tracking_number ? (
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-primary-medium/10 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-primary-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="font-mono text-sm font-medium text-primary-medium">{asn.tracking_number}</p>
                                    <button className="text-xs text-primary-light hover:text-primary-medium underline transition-colors">
                                      Track Package →
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-neutral-soft rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-neutral-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-sm text-neutral-medium">Tracking Pending</p>
                                    <p className="text-xs text-neutral-medium/70">Will be available soon</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Timeline */}
                        <div className="mt-6 pt-4 border-t border-neutral-soft/40">
                          <div className="flex items-center space-x-2 text-sm text-neutral-medium">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Created: {asn.created_at ? new Date(asn.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Unknown'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-neutral-soft/40 flex justify-between items-center">
                  <div className="text-sm text-neutral-medium">
                    {asnData.length > 0 && `${asnData.length} shipment${asnData.length !== 1 ? 's' : ''} found`}
                  </div>
                  <button 
                    className="px-6 py-2.5 bg-primary-medium hover:bg-primary-dark text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg"
                    onClick={() => setAsnModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Portal-based Dropdown Menu */}
        {openMenuId && dropdownPosition && createPortal(
          <div 
            className="dropdown-menu fixed w-48 bg-white rounded-xl shadow-2xl border border-neutral-soft/30 z-50"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-2">
              {(() => {
                const currentOrder = orders.find(o => o.id === openMenuId);
                if (!currentOrder) return null;
                
                return (
                  <>
                    {/* View Option */}
                    <button 
                      className="w-full px-4 py-3 text-left text-sm text-neutral-dark hover:bg-neutral-light/60 transition-colors flex items-center space-x-3"
                      onClick={() => {
                        setIsViewOpen(currentOrder);
                        setOpenMenuId(null);
                      }}
                    >
                      <Eye className="h-4 w-4 text-primary-medium" />
                      <span>View Details</span>
                    </button>
                    
                    {/* Edit Option */}
                    {canManagePurchaseOrders && (
                      <button 
                        className="w-full px-4 py-3 text-left text-sm text-neutral-dark hover:bg-neutral-light/60 transition-colors flex items-center space-x-3"
                        onClick={async () => {
                          setIsEditOpen(currentOrder);
                          setIsAddOpen(true);
                          setOpenMenuId(null);
                          // Prefill base form values
                          const fallbackName = currentOrder.customer_name || (customers.find(c=> String(c.id)===String(currentOrder.customer_id))?.name || '');
                          setForm((prev) => ({
                            ...prev,
                            date: currentOrder.date || prev.date,
                            customer: fallbackName,
                            customer_id: currentOrder.customer_id ? String(currentOrder.customer_id) : '',
                            product: currentOrder.product_name || '',
                            requestedShipDate: currentOrder.requested_ship_date || '',
                            ship_date: currentOrder.requested_ship_date || '',
                            quantity: String(currentOrder.quantity || ''),
                            caseQty: String(currentOrder.case_qty || ''),
                            paymentTerms: currentOrder.payment_terms || '',
                            salesRepresentative: currentOrder.sales_representative || '',
                            additionalPackaging: currentOrder.additional_packaging || '',
                            location: currentOrder.location || '',
                            comments: currentOrder.notes || '',
                            is_copack: Boolean(currentOrder.is_copack),
                            po_number: currentOrder.po_number || '',
                            status: currentOrder.status || 'Draft',
                            deposit_paid: !!currentOrder.deposit_paid,
                          }));
                          // Load additional items from purchase_order_items
                          try {
                            const { data: items } = await supabase
                              .from('purchase_order_lines')
                              .select('product_name, quantity')
                              .eq('purchase_order_id', currentOrder.id);
                            const extras = (items ?? [])
                              .filter((it: any) => !(String(it.product_name || '') === String(currentOrder.product_name || '') && Number(it.quantity || 0) === Number(currentOrder.quantity || 0)))
                              .map((it: any) => ({ id: (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`), product: String(it.product_name || ''), qty: Number(it.quantity || 0) }));
                            setExtraLines(extras);
                          } catch {}
                        }}
                            >
                              <Pencil className="h-4 w-4 text-neutral-medium" />
                              <span>Edit Order</span>
                            </button>
                          )}

                          {/* Move to Procurement */}
                          {(['admin', 'finance', 'procurement'].includes(String(currentRole || '').toLowerCase())) && (
                            (() => {
                              const st = String(currentOrder?.status || '').toLowerCase().trim()
                              const disableMove = new Set([
                                'move_to_procurement',
                                'move to procurement',
                                'procurement',
                                'ready_to_schedule',
                                'ready to schedule',
                                'scheduled',
                                'in_progress',
                                'in progress',
                                'qa_hold',
                                'qa hold',
                                'ready_to_ship',
                                'ready to ship',
                                'completed',
                                'allocated',
                                'partial',
                                'partially_shipped',
                                'shipped',
                                'submitted',
                              ]).has(st)
                              return (
                            <button
                              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center space-x-3 ${disableMove ? 'text-neutral-medium cursor-not-allowed opacity-60' : 'text-neutral-dark hover:bg-neutral-light/60'}`}
                              onClick={async () => {
                                if (disableMove) return
                                try {
                                  await supabase
                                    .from('purchase_orders')
                                    .update({ status: 'move_to_procurement' })
                                    .eq('id', currentOrder.id)
                                  setOpenMenuId(null)
                                  await refreshPOs()
                                  navigate('/admin/supply-chain-procurement')
                                } catch (e: any) {
                                  setToast({ show: true, message: e?.message || 'Failed to move to procurement', kind: 'error' })
                                  setOpenMenuId(null)
                                }
                              }}
                              disabled={disableMove}
                              title={disableMove ? 'Already in Procurement/Shipping stage' : 'Move to Procurement'}
                            >
                              <Truck className={`h-4 w-4 ${disableMove ? 'text-neutral-medium' : 'text-primary-medium'}`} />
                              <span>Move to Procurement</span>
                            </button>
                              )
                            })()
                          )}
                    
                    {/* Divider */}
                    <div className="border-t border-neutral-soft/40 my-1"></div>
                    
                    {/* Delete Option */}
                    {canManagePurchaseOrders && (
                      <button 
                        className="w-full px-4 py-3 text-left text-sm text-accent-danger hover:bg-accent-danger/5 transition-colors flex items-center space-x-3"
                        onClick={() => {
                          setOpenMenuId(null);
                          setDeleteTarget(currentOrder);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-accent-danger" />
                        <span>Delete Order</span>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>,
          document.body
        )}

        {/* No Finished Goods Modal */}
        {showNoFg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowNoFg(false)}></div>
            <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <h2 className="text-xl font-semibold text-neutral-dark">No Finished Goods Available</h2>
                <p className="text-sm text-neutral-medium mt-1">This purchase order cannot be allocated because the product is not yet produced.</p>
              </div>
              <div className="p-6 flex items-center justify-end gap-3">
                <button className="px-4 py-2 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all" onClick={() => setShowNoFg(false)}>Close</button>
                <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow" onClick={() => { setShowNoFg(false); navigate('/production-schedule') }}>Create Production Schedule</button>
              </div>
            </div>
          </div>
        )}

        {isAllocOpen && allocSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setIsAllocOpen(false); setFefoWarning(null) }}></div>
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <h2 className="text-2xl font-semibold text-neutral-dark">Allocation Summary</h2>
                <p className="text-sm text-neutral-medium mt-1">Status: {String(allocSummary?.status || '')}</p>
                {false && (() => {
                  const use = (lastApprovedId && debugMap[String(lastApprovedId)])
                    || (isViewOpen?.id && debugMap[String(isViewOpen.id)])
                    || null
                  return use ? (
                    <div className="mt-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 text-xs">
                      <div><span className="font-semibold">Allocator executed:</span> {use.allocator_executed || '-'}</div>
                      <div><span className="font-semibold">Trigger:</span> {use.trigger_fired || '-'}</div>
                      <div><span className="font-semibold">Batch auto-create:</span> {use.batch_created ? 'YES' : 'NO'}</div>
                      {Array.isArray(use.batch_ids) && use.batch_ids.length > 0 && (
                        <div className="mt-1"><span className="font-semibold">Batch IDs:</span> {use.batch_ids.join(', ')}</div>
                      )}
                      {Array.isArray(use.sql_notices) && use.sql_notices.length > 0 && (
                        <div className="mt-2">
                          <div className="font-semibold">Raw SQL Notices:</div>
                          <div className="max-h-28 overflow-auto rounded bg-neutral-900 text-neutral-100 p-2 mt-1">
                            {use.sql_notices.map((ln:string, i:number)=> (
                              <pre key={i} className="text-[11px] leading-4 whitespace-pre-wrap">{ln}</pre>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null
                })()}
              </div>
              <div className="p-6">
                {/* Copack materials table */}
                {Array.isArray(allocSummary?.lines_materials) && allocSummary.lines_materials.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-neutral-dark mb-2">Materials Allocation</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-neutral-light/40 border-b border-neutral-soft/50">
                            <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Material</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider">Required</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider">Client Inventory</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider">Allocated</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider">Shortfall</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-soft/20">
                          {allocSummary.lines_materials.map((ln:any, i:number)=> (
                            <tr key={i} className="group">
                              <td className="px-6 py-3 text-sm text-neutral-dark">{ln.material || ln.material_name || '-'}</td>
                              <td className="px-6 py-3 text-sm text-right">{ln.required ?? ln.required_qty ?? 0}</td>
                              <td className="px-6 py-3 text-sm text-right">{ln.client_inventory ?? 0}</td>
                              <td className="px-6 py-3 text-sm text-right">{ln.allocated ?? 0}</td>
                              <td className={`px-6 py-3 text-sm text-right ${Number(ln.shortfall || 0) > 0 ? 'text-amber-700 font-semibold' : ''}`}>{ln.shortfall ?? 0}</td>
                              <td className="px-6 py-3 text-sm">{ln.status || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {showBackorderAdvisory && !(allocContext?.is_copack || allocContext?.operation_supplies_materials) && (
                  <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-semibold">No finished goods available for this product.</div>
                      <div>Please create a production schedule.</div>
                    </div>
                    <button onClick={() => { setIsAllocOpen(false); navigate('/production-schedule') }} className="ml-4 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white text-sm font-medium">
                      Go to Production Schedule
                    </button>
                  </div>
                )}
                {Array.isArray(allocSummary?.errors) && allocSummary.errors.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg border border-accent-danger/30 bg-accent-danger/5 text-accent-danger text-sm">
                    {allocSummary.errors.map((e: any, i: number) => (
                      <div key={i}>{typeof e === 'string' ? e : (e?.error || JSON.stringify(e))}</div>
                    ))}
                  </div>
                )}

                {fefoWarning && (
                  <div className="p-4 mb-3 rounded-lg border border-red-400 bg-red-50 text-red-700">
                    <h3 className="font-bold text-red-800">FEFO Blocked — Expired Lot Detected</h3>

                    <p className="mt-2 text-sm">
                      Allocation cannot proceed because the selected Finished Goods lot 
                      expires before the requested ship date.
                    </p>

                    <div className="mt-3 text-sm leading-6">
                      <p><strong>Expired Lot:</strong> {fefoWarning.expired_lot}</p>
                      <p><strong>Expiry Date:</strong> {fefoWarning.exp_date}</p>

                      {fefoWarning.suggest_lot && (
                        <>
                          <p className="mt-3"><strong>Suggested FEFO Lot:</strong> {fefoWarning.suggest_lot}</p>
                          <p><strong>Suggested Expiry:</strong> {fefoWarning.suggest_expiry}</p>
                        </>
                      )}
                    </div>

                    <p className="mt-4 text-xs italic">
                      Please update Finished Goods inventory or assign a lot that is valid for the ship date.
                    </p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Ordered</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Allocated</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Shortfall</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-soft/20">
                      {allocLines.map((ln, idx) => (
                        <tr key={idx} className="group">
                          <td className="px-6 py-3 text-sm text-neutral-dark">{ln.product_name || '—'}</td>
                          <td className="px-6 py-3 text-sm">{ln.quantity}</td>
                          <td className="px-6 py-3 text-sm">{ln.allocated_qty}</td>
                          <td className="px-6 py-3 text-sm">{ln.shortfall_qty}</td>
                          <td className="px-6 py-3 text-sm">{ln.status}</td>
                        </tr>
                      ))}
                      {allocLines.length === 0 && (
                        <tr>
                          <td className="px-6 py-3 text-sm text-neutral-medium" colSpan={5}>No purchase order lines found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end">
                  <button className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all" onClick={() => { setIsAllocOpen(false); setAllocContext(null); setFefoWarning(null) }}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Substitute Modal */}
        <SubstituteModal
          open={showSubModal}
          items={pendingLines.map(l=>({ product_name: l.product_name }))}
          productsIndex={productsIndex}
          onUseSubstitute={applySubstitutesAndApprove}
          onCancel={()=>{ setShowSubModal(false); setPendingLines([]); setPendingApproveId(null) }}
        />

        {showAddPaymentTerms && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-neutral-dark mb-4">Add New Payment Terms</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter new payment terms"
                  value={newPaymentTerms}
                  onChange={(e) => setNewPaymentTerms(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPaymentTerms.trim()) {
                      const v = newPaymentTerms.trim()
                      setForm((prev: any) => ({ ...(prev || {}), paymentTerms: v }))
                      setShowAddPaymentTerms(false)
                      setNewPaymentTerms('')
                    }
                  }}
                  className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowAddPaymentTerms(false); setNewPaymentTerms('') }}
                    className="flex-1 px-4 py-2 border border-neutral-soft rounded-lg text-neutral-dark hover:bg-neutral-light"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const v = newPaymentTerms.trim()
                      if (!v) return
                      setForm((prev: any) => ({ ...(prev || {}), paymentTerms: v }))
                      setShowAddPaymentTerms(false)
                      setNewPaymentTerms('')
                    }}
                    disabled={!newPaymentTerms.trim()}
                    className="flex-1 px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAddSalesRep && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-neutral-dark mb-4">Add New Sales Representative</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter new sales representative"
                  value={newSalesRep}
                  onChange={(e) => setNewSalesRep(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSalesRep.trim()) {
                      const v = newSalesRep.trim()
                      setForm((prev: any) => ({ ...(prev || {}), salesRepresentative: v }))
                      setShowAddSalesRep(false)
                      setNewSalesRep('')
                    }
                  }}
                  className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowAddSalesRep(false); setNewSalesRep('') }}
                    className="flex-1 px-4 py-2 border border-neutral-soft rounded-lg text-neutral-dark hover:bg-neutral-light"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const v = newSalesRep.trim()
                      if (!v) return
                      setForm((prev: any) => ({ ...(prev || {}), salesRepresentative: v }))
                      setShowAddSalesRep(false)
                      setNewSalesRep('')
                    }}
                    disabled={!newSalesRep.trim()}
                    className="flex-1 px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Copack Allocation (dual PR) modal */}
        {copackSummary && (
          <CopackAllocationSummary summary={copackSummary} onClose={() => setCopackSummary(null)} />
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-2">Purchase Orders</h1>
              
            </div>
            {canManagePurchaseOrders && (
              <button onClick={() => { setIsEditOpen(null); setForm((prev:any)=>({ ...(prev||{}), is_copack: poTab==='copack' })); resetForm(); setForm((prev:any)=>({ ...(prev||{}), is_copack: poTab==='copack' })); setExtraLines([]); setIsAddOpen(true) }} className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center">
                <Plus className="h-5 w-5 mr-3" />
                Add Purchase Order
              </button>
            )}
            {!canViewPurchaseOrders && (
              <div className="text-sm text-neutral-medium">
                Access restricted to authorized roles only.
              </div>
            )}
          </div>
        </div>

      {/* PO Risk Banner */}
      {renderPOBanner()}

      {/* Search and Filter */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1 max-w-md">
            <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">Search POs</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-medium" />
              <input
                type="text"
                placeholder="Search customer or product..."
                className="w-full pl-12 pr-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium"
                value={search}
                onChange={(e)=>setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 flex-shrink-0">
            <label className="flex items-center text-sm font-semibold text-neutral-dark">
              <Search className="h-5 w-5 mr-3 text-primary-medium" />
              Filter & Sort
            </label>
            <div className="flex gap-3">
              <div className="relative" ref={statusRef}>
                <button
                  type="button"
                  onClick={()=>setIsStatusOpen(v=>!v)}
                  className="flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white transition-all shadow-sm hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:shadow-md w-[180px]"
                >
                  <span className={statusFilter==='All' ? 'text-neutral-medium' : 'text-neutral-dark'}>
                    {statusFilter === 'All' ? 'All Statuses' : statusFilter}
                  </span>
                  <span className="ml-2 text-neutral-medium">▼</span>
                </button>
                {isStatusOpen && (
                  <div className="absolute left-0 right-0 z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                    {(['All', ...Object.values(Status)] as string[]).map((opt) => (
                      <button key={opt} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${statusFilter===opt ? 'bg-neutral-light' : ''}`} onClick={()=>{ setStatusFilter(opt); setIsStatusOpen(false) }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={rushRef}>
                <button
                  type="button"
                  onClick={()=>setIsRushOpen(v=>!v)}
                  className="flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white transition-all shadow-sm hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:shadow-md w-[140px]"
                >
                  <span className={rushFilter==='All' ? 'text-neutral-medium' : 'text-neutral-dark'}>
                    {rushFilter}
                  </span>
                  <span className="ml-2 text-neutral-medium">▼</span>
                </button>
                {isRushOpen && (
                  <div className="absolute left-0 right-0 z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                    {['All','Rush Only','Non-Rush'].map(opt => (
                      <button key={opt} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${rushFilter===opt ? 'bg-neutral-light' : ''}`} onClick={()=>{ setRushFilter(opt); setIsRushOpen(false) }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table (redesigned as cards) */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-6">
        {/* Local tabs row just above the list */}
        <div className="mb-4 flex items-center justify-start">
          <div className="inline-flex items-center rounded-lg bg-neutral-light/60 p-1 border border-neutral-soft/60">
            <button
              className={`px-3 py-1.5 text-sm rounded-md ${poTab==='copack' ? 'bg-primary-medium text-white shadow' : 'text-neutral-dark hover:bg-white'}`}
              onClick={() => setPoTab('copack')}
            >
              Co-Packing
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-md ${poTab==='brand' ? 'bg-primary-medium text-white shadow' : 'text-neutral-dark hover:bg-white'}`}
              onClick={() => setPoTab('brand')}
            >
              Brands
            </button>
          </div>
        </div>
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
          {loading ? (
            <div className="p-12 text-center text-neutral-medium">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-neutral-medium">No purchase orders yet</div>
          ) : (
            <div className="space-y-4">
              {(() => {
                // First filter the orders
                const filteredOrders = orders.filter((o:any)=>{
                  const hit = (o.customer_name||'').toLowerCase().includes(search.toLowerCase()) || (o.product_name||'').toLowerCase().includes(search.toLowerCase())
                  const statusOk = statusFilter==='All' ? true : o.status===statusFilter
                  const rushOk = rushFilter==='All' ? true : rushFilter==='Rush Only' ? !!o.is_rush : !o.is_rush
                  return hit && statusOk && rushOk
                })
                
                // Create a sorted copy for priority ranking (don't mutate original)
                const sortedForPriority = [...filteredOrders].sort((a: any, b: any) => {
                  const ad = new Date(a.requested_ship_date || 0).getTime()
                  const bd = new Date(b.requested_ship_date || 0).getTime()
                  if (ad !== bd) return ad - bd // earlier ship date first
                  const adep = !!a.deposit_paid ? 1 : 0
                  const bdep = !!b.deposit_paid ? 1 : 0
                  if (adep !== bdep) return bdep - adep // deposit first
                  const ac = new Date(a.created_at || 0).getTime()
                  const bc = new Date(b.created_at || 0).getTime()
                  return ac - bc // older first
                })
                
                const filtered = sortedForPriority.filter((o:any) => (!!o.is_copack) === (poTab === 'copack'))
                return filtered.map((o:any) => {
                  const orderedQty = Number(o.quantity ?? 0)
                  const shippedSum = shippedTotals[String(o.id)] ?? null
                  const statusClass = getStatusBadgeClass(o.status)
                  
                  // Find this PO's priority rank in the sorted list
                  const brandQueue = sortedForPriority.filter((p:any) => !p.is_copack)
                  const priorityRank = brandQueue.findIndex((p:any) => p.id === o.id) + 1
                  const depositPaid = !!o.deposit_paid
                  return (
                    <div key={o.id} className="rounded-2xl border border-neutral-soft/40 bg-gradient-to-br from-white to-neutral-light/30 p-5 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between pb-3 border-b border-neutral-soft/60">
                        <div className="flex items-start gap-4">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                              <div className="text-[11px] uppercase tracking-wide text-neutral-medium">PO Date</div>
                              <div className="text-sm font-semibold text-neutral-dark">{formatDate(o.date)}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-[11px] uppercase tracking-wide text-neutral-medium">PO #</div>
                              <div className="text-sm font-semibold text-neutral-dark">{o.po_number || '-'}</div>
                            </div>
                          </div>
                          {showsPriorityScore(o) && !o.is_copack && (
                            <div className="space-y-1">
                              <div className="text-[11px] uppercase tracking-wide text-neutral-medium">Priority Score</div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-primary-100 text-primary-700 border border-primary-200">
                                  #{priorityRank}
                                </span>
                                {depositPaid && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
                                    PRIORITY
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${statusClass}`}>{formatStatusLabel(o.status)}</span>
                          {o.is_rush && !o.is_copack && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">RUSH</span>
                          )}
                          <button 
                            className="menu-button p-2 text-neutral-medium hover:text-primary-medium rounded-md transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDropdownPosition({
                                top: rect.top + window.scrollY,
                                left: rect.left + window.scrollX - 200
                              });
                              setOpenMenuId(openMenuId === o.id ? null : o.id);
                            }}
                            title="Actions"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className={`pt-4 grid grid-cols-1 ${o.is_copack ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6`}>
                        <div className="space-y-1">
                          <label className="flex items-center text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">
                            <User className="h-4 w-4 mr-2 text-primary-medium" /> Customer
                          </label>
                          <div className="text-sm font-semibold text-neutral-dark">{o.customer_name || o.customer_id}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="flex items-center text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">
                            <Package className="h-4 w-4 mr-2 text-primary-medium" /> Product
                          </label>
                          <div className="text-sm text-neutral-dark flex items-center gap-2">
                            <span className="font-medium">{o.product_name || o.product_id}</span>
                            {o.is_copack && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">COPACK</span>
                            )}
                            {o.deposit_paid && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Deposit</span>
                            )}
                            {showsPriorityScore(o) && !o.is_copack && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Competing</span>
                            )}
                            {o.is_copack && (
                              <div className="ml-4 flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary-medium" />
                                <span className="text-[11px] uppercase tracking-wide text-neutral-medium">Qty</span>
                                <span className="text-sm font-semibold text-neutral-dark">{Number(o.quantity ?? 0)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                          {!o.is_copack && (
                            <div className="md:border-l md:pl-4 border-neutral-soft/60">
                              <label className="flex items-center text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">
                                <Package className="h-4 w-4 mr-2 text-primary-medium" /> Qty
                              </label>
                              <div className="text-sm font-semibold text-neutral-dark">{Number(o.quantity ?? 0)}</div>
                            </div>
                          )}
                          {!o.is_copack && (
                            <div className="md:border-l md:pl-4 border-neutral-soft/60">
                              <label className="flex items-center text-[11px] font-semibold text-neutral-medium uppercase tracking-wide">
                                <Calendar className="h-4 w-4 mr-2 text-primary-medium" /> Ship Date
                              </label>
                              <div className="text-sm font-semibold text-neutral-dark">{o.requested_ship_date || '—'}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PO Meta Row */}
                      <div className={`mt-3 grid grid-cols-1 ${o.is_copack ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-3 text-[11px] text-neutral-dark`}>
                        <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                          <span className="font-semibold">Allocated</span>
                          <span className="opacity-80">{Number(o.allocated_qty ?? 0)} / {Number(o.quantity ?? 0)}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                          <span className="font-semibold">Backorder</span>
                          <span className="opacity-80">{Number(o.backorder_qty ?? 0)}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                          <span className="font-semibold">Location</span>
                          <span className="opacity-80">{o.location || '—'}</span>
                        </div>
                        {!o.is_copack && (
                          <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                            <span className="font-semibold">Payment Terms</span>
                            <span className="opacity-80">{o.payment_terms || '—'}</span>
                          </div>
                        )}
                      </div>

                      {String(o.status) === 'partially_shipped' && Number(o.backorder_qty ?? 0) > 0 && !!o.backorder_eta && (
                        <div className="mt-3 text-[11px] text-neutral-medium">Backorder ETA: {formatDate(o.backorder_eta as any)}</div>
                      )}
                      
                      {/* Conflict Banner */}
                      {(() => {
                        const hasConflict = hasPlannerConflict(o)
                        if (!hasConflict) return null
                        
                        return (
                          <div className="w-full p-3 rounded-lg bg-red-50 text-red-700 text-xs mt-3 border border-red-200">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 mt-0.5" />
                              <div>
                                <div className="font-semibold text-red-800">Allocation Conflict</div>
                                <div className="mt-0.5">
                                  Insufficient finished goods to fulfill this order after the priority rules were applied. Required: {o.quantity} — Allocated: {o.allocated_qty || 0}
                                  {o.has_conflict && (
                                    <span className="ml-2 text-red-600 font-bold">⚠ Planner Needed</span>
                                  )}
                                </div>
                                <div className="text-xs text-red-700 mt-1">Shortfall: {o.quantity - (o.allocated_qty || 0)} units</div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                      <div className="mt-6 pt-4 border-t border-neutral-soft/60 flex items-center justify-end">
                        <div className="flex items-center gap-8">
                          <div className="flex items-center gap-2">
                            {!o.is_copack && (o.status === "Shipped" || String(o.status).toLowerCase() === 'submitted') && (
                              <button
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent-success hover:bg-accent-success/90 text-white shadow-sm transition-all"
                                onClick={() => { setOpenMenuId(null); setAsnPoStatus('shipped'); viewASN(o.id) }}
                              >
                                <Eye className="h-4 w-4" />
                                View ASN
                              </button>
                            )}
                            {!o.is_copack && String(o.status || '').toLowerCase() === 'completed' && (
                              <button
                                className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold border shadow-sm bg-white border-neutral-soft text-neutral-dark hover:border-primary-medium hover:text-primary-medium"
                                onClick={() => { setOpenMenuId(null); handleApproveCompletedPo(String(o.id)) }}
                                title="Approve (allocate finished goods first)"
                              >
                                Approve
                              </button>
                            )}
                            {(o.status === "Open" || !o.status) && (() => {
                              const hasConflict = hasPlannerConflict(o)
                              const isDisabled = !!fefoWarning || hasConflict
                              const disabledReason = fefoWarning ? 'FEFO warning active' : hasConflict ? 'Cannot auto-allocate. Escalation to Planner is required.' : ''
                              
                              return (
                                <button
                                  className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold border shadow-sm ${isDisabled ? 'text-neutral-medium bg-neutral-light/40 cursor-not-allowed border-neutral-soft' : 'bg-white border-neutral-soft text-neutral-dark hover:border-primary-medium hover:text-primary-medium'}`}
                                  onClick={() => { setOpenMenuId(null); handleApproveClick(o) }}
                                  title={disabledReason || "Approve & Allocate"}
                                  disabled={isDisabled}
                                >
                                  Approve
                                </button>
                              )
                            })()}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {!o.is_copack && (() => {
                              const st = String(o.status || '').toLowerCase().trim()
                              const isAllocated = st === 'allocated'
                              const isPartial = st === 'partial' || st === 'partially_shipped'
                              const isReadyToShip = st === 'ready_to_ship' || st === 'ready to ship'
                              const inShippingFlow = isAllocated || isPartial || isReadyToShip
                              if (!inShippingFlow) return null

                              const role = String(currentRole || '').toLowerCase()
                              const canAllocate = role === 'admin' || role === 'procurement' || role === 'finance' || role === 'supply_chain' || role === 'warehouse'
                              const allocatedQty = Number((o as any)?.allocated_qty ?? 0)
                              const requiredQty = Number((o as any)?.quantity ?? 0)
                              const needsAllocation = isReadyToShip && (Number.isFinite(requiredQty) && requiredQty > 0 ? allocatedQty < requiredQty : allocatedQty <= 0)

                              return (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {(isAllocated || isPartial) && (
                                    <span className="text-xs text-neutral-medium">Ship this PO from the Shipping tab.</span>
                                  )}
                                  {canAllocate && needsAllocation && (
                                    <button
                                      className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold border shadow-sm bg-white border-neutral-soft text-neutral-dark hover:border-primary-medium hover:text-primary-medium"
                                      onClick={() => { setOpenMenuId(null); handleApproveCompletedPo(String(o.id)) }}
                                      title="Approve (allocate first)"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  {(isAllocated || isPartial) && (
                                    <button
                                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary-medium hover:bg-primary-dark text-white shadow-sm transition-all"
                                      onClick={() => { setOpenMenuId(null); navigate('/admin/supply-chain-procurement?tab=shipping') }}
                                      title="Go to Shipping"
                                    >
                                      <Truck className="h-4 w-4" /> Go to Shipping
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                            {!o.is_copack && String(o.status) === 'partially_shipped' && (
                              <button
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent-warning hover:bg-accent-warning/90 text-white shadow-sm transition-all"
                                onClick={() => { setOpenMenuId(null); setAsnPoStatus('partially_shipped'); viewASN(o.id) }}
                              >
                                <Eye className="h-4 w-4" /> View ASN
                              </button>
                            )}
                            {!o.is_copack && String(o.status) === 'partially_shipped' && (
                              // Show Ship Remaining only if there's remaining quantity to ship
                              (shippedSum === null ? Number(o.backorder_qty ?? 0) > 0 : shippedSum < orderedQty)
                            ) && (
                              <button
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary-medium hover:bg-primary-dark text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-medium/40"
                                onClick={() => handleShipRemaining(String(o.id))}
                              >
                                <Truck className="h-4 w-4" />
                                Ship Remaining
                              </button>
                            )}
                            {!o.is_copack && String(o.status) === 'partially_shipped' && (
                              shippedSum !== null ? shippedSum >= orderedQty : Number(o.backorder_qty ?? 0) === 0
                            ) && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-accent-success/10 text-accent-success border border-accent-success/20">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                              </span>
                            )}
                            {!o.is_copack && (() => {
                              const hasConflict = hasPlannerConflict(o)
                              if (!hasConflict) return null
                              
                              return (
                                <button
                                  className="px-3.5 py-2 bg-yellow-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-yellow-700 transition-colors"
                                  onClick={() => openPlannerOverride(o)}
                                >
                                  Planner Override
                                </button>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>

        {isDeleteOpen && deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => { if (!deleting) { setIsDeleteOpen(false); setDeleteTarget(null) } }}></div>
            <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <h2 className="text-2xl font-semibold text-neutral-dark">Delete Purchase Order</h2>
                <p className="text-sm text-neutral-medium mt-1">This action cannot be undone.</p>
              </div>
              <div className="p-8">
                <p className="text-neutral-dark">Are you sure you want to delete this order{deleteTarget?.customer_name ? ` for "${deleteTarget.customer_name}"` : ''}{deleteTarget?.product_name ? ` - ${deleteTarget.product_name}` : ''}?</p>
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all disabled:opacity-60"
                    onClick={() => { if (!deleting) { setIsDeleteOpen(false); setDeleteTarget(null) } }}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-5 py-2.5 rounded-xl bg-accent-danger text-white font-semibold hover:opacity-90 shadow-md disabled:opacity-60"
                    onClick={async () => {
                      if (!deleteTarget?.id || deleting) return
                      setDeleting(true)
                      await removeOrder(deleteTarget.id)
                      setIsDeleteOpen(false)
                      setDeleteTarget(null)
                      setDeleting(false)
                    }}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setIsAddOpen(false); setIsEditOpen(null); setExtraLines([]); }}></div>
            <div className="relative z-10 w-full max-w-3xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">{isEditOpen ? 'Update Purchase Order' : (form.is_copack ? 'Allocate Copack Materials (Raw + Packaging)' : 'Add Brand Purchase Order')}</h2>
                </div>
                <button onClick={() => { setIsAddOpen(false); setIsEditOpen(null); setExtraLines([]); }} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={(e) => { e.preventDefault(); saveOrder() }}
                  className="p-8 space-y-6"
                >
                  {form.customer_id && (customers.find(c => c.id === form.customer_id)?.credit_hold ||
                    Number(customers.find(c => c.id === form.customer_id)?.overdue_balance || 0) > 0) && (
                    <div className="mb-3 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                      Customer has credit issues. This PO will be set to <b>On Hold</b>.
                    </div>
                  )}

                  {form.ship_date && (() => {
                    const d = new Date(form.ship_date)
                    const days = Math.ceil((d.getTime() - Date.now()) / 86400000)
                    return days <= PO_RULES.RUSH_WINDOW_DAYS
                  })() && (
                    <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                      Rush Order detected. Approval or rush handling is required.
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <Calendar className="h-4 w-4 mr-2 text-primary-medium" />
                        Date Submitted
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                        value={form.date}
                        min={getTodayStr()}
                        max={getTodayStr()}
                        onChange={(e) => {
                          const today = getTodayStr()
                          const next = e.target.value
                          setForm({ ...form, date: next === today ? next : today })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <Calendar className="h-4 w-4 mr-2 text-primary-medium" />
                        Requested Ship Date
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                        value={form.requestedShipDate}
                        min={getTodayStr()}
                        onChange={(e) => {
                          const today = getTodayStr()
                          const next = e.target.value
                          const clamped = next && next < today ? today : next
                          setForm({ ...form, requestedShipDate: clamped, ship_date: clamped })
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <User className="h-4 w-4 mr-2 text-primary-medium" />
                        Customer
                      </label>
                      <div className="relative" ref={customerRef}>
                        <button type="button" onClick={()=>setIsCustomerOpen(v=>!v)} className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light">
                          <span className={form.customer? 'text-neutral-dark':'text-neutral-medium'}>{form.customer || 'Select Customer'}</span>
                          <span className="ml-2 text-neutral-medium">▼</span>
                        </button>
                        {isCustomerOpen && (
                          <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                            {customers.map(c => (
                              <button key={c.id} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${form.customer===c.name?'bg-neutral-light':''}`} onClick={()=>{setForm({...form, customer:c.name, customer_id: c.id}); setIsCustomerOpen(false)}}>{c.name}{(c.credit_hold || (c.overdue_balance??0)>0)? ' • On Hold Risk' : ''}</button>
                            ))}
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-primary-medium hover:text-primary-dark hover:bg-neutral-light"
                              onClick={() => { setNewCustomerName(''); setShowAddCustomer(true); setIsCustomerOpen(false) }}
                            >
                              + Add Customer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">PO #</label>
                      <input
                        type="text"
                        placeholder="Enter PO #"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                        value={form.po_number}
                        onChange={(e) => setForm({ ...form, po_number: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Products section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <Package className="h-4 w-4 mr-2 text-primary-medium" />
                        Products
                        {form.is_copack && (() => {
                          const n = String(form.product || '').trim()
                          if (!n) return null
                          if (!isKnownProductName(n)) return null
                          return (
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${form.client_materials_required ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                            {form.client_materials_required ? 'CLIENT' : 'OPS'}
                          </span>
                          )
                        })()}
                      </label>
                      {!form.is_copack && (
                        <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-primary-medium text-primary-medium hover:bg-primary-light/20" onClick={()=> setExtraLines(prev=> [...prev, { id: `extra-${Date.now()}`, product: '', qty: 0 }])}>
                          + Add Product
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-neutral-soft rounded-lg bg-neutral-light/20">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Product</label>
                        <div className="relative" ref={productSuggestRef}>
                          <input
                            type="text"
                            placeholder="Product name"
                            className="w-full px-3 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                            value={form.product}
                            onFocus={() => setProductSuggestOpen(true)}
                            onChange={(e)=>{ setForm({...form, product:e.target.value}); setProductSuggestOpen(true) }}
                            onBlur={() => {
                              const n = String(form.product || '').trim()
                              if (!n) return
                              if (!isKnownProductName(n)) {
                                setForm((prev: any) => ({ ...prev, product: '' }))
                                setToast({ show: true, message: 'Please select a product from the Products list.', kind: 'warning' })
                              }
                            }}
                          />
                          {productSuggestOpen && productSuggestions.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full bg-white border border-neutral-soft rounded-lg shadow-lg overflow-hidden">
                              {productSuggestions.map((p: any) => (
                                <button
                                  key={String(p.id)}
                                  type="button"
                                  onMouseDown={(ev) => ev.preventDefault()}
                                  onClick={() => {
                                    setForm((prev: any) => ({
                                      ...prev,
                                      product: String(p.name || ''),
                                      caseQty: (p.case_qty != null && String(p.case_qty) !== 'null') ? String(p.case_qty) : prev.caseQty,
                                    }))
                                    setProductSuggestOpen(false)
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-neutral-light/40 transition-colors"
                                >
                                  <div className="text-sm font-medium text-neutral-dark truncate">{String(p.name || '')}</div>
                                  <div className="text-xs text-neutral-medium truncate">Formula: {String(p.formula?.formula_name || '—')}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Quantity</label>
                        <input type="number" placeholder="0" className="w-full px-3 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.quantity} onChange={(e)=>setForm({...form, quantity:e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Case Qty</label>
                        <input type="number" placeholder="0" className="w-full px-3 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.caseQty} onChange={(e)=>setForm({...form, caseQty:e.target.value})} />
                      </div>
                    </div>

                    {!form.is_copack && (
                      extraLines.length===0 ? (
                        <div className="text-xs text-neutral-medium border border-dashed border-neutral-soft rounded-lg p-3">No additional products added. Click "+ Add Product" to add more products to this order.</div>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-auto">
                          {extraLines.map((l)=> (
                            <div key={l.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 border border-neutral-soft rounded-lg bg-white">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Product</label>
                                <div className="relative" ref={extraSuggestId === l.id ? extraSuggestRef : undefined}>
                                  <input
                                    type="text"
                                    placeholder="Product name"
                                    className="w-full px-3 py-2 border border-neutral-soft rounded-lg"
                                    value={l.product}
                                    onFocus={() => setExtraSuggestId(l.id)}
                                    onChange={(e)=> {
                                      setExtraLines(prev=> prev.map(x=> x.id===l.id? {...x, product:e.target.value}: x))
                                      setExtraSuggestId(l.id)
                                    }}
                                    onBlur={() => {
                                      const n = String(l.product || '').trim()
                                      if (!n) return
                                      if (!isKnownProductName(n)) {
                                        setExtraLines(prev=> prev.map(x=> x.id===l.id? {...x, product: ''}: x))
                                        setToast({ show: true, message: 'Please select a product from the Products list.', kind: 'warning' })
                                      }
                                    }}
                                  />
                                  {extraSuggestId === l.id && extraSuggestions.length > 0 && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-neutral-soft rounded-lg shadow-lg overflow-hidden">
                                      {extraSuggestions.map((p: any) => (
                                        <button
                                          key={String(p.id)}
                                          type="button"
                                          onMouseDown={(ev) => ev.preventDefault()}
                                          onClick={() => {
                                            setExtraLines(prev=> prev.map(x=> x.id===l.id? {...x, product: String(p.name || '')}: x))
                                            setExtraSuggestId(null)
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-neutral-light/40 transition-colors"
                                        >
                                          <div className="text-sm font-medium text-neutral-dark truncate">{String(p.name || '')}</div>
                                          <div className="text-xs text-neutral-medium truncate">Formula: {String(p.formula?.formula_name || '—')}</div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Quantity</label>
                                <input type="number" placeholder="0" className="w-full px-3 py-2 border border-neutral-soft rounded-lg" value={l.qty} onChange={(e)=> setExtraLines(prev=> prev.map(x=> x.id===l.id? {...x, qty:Number(e.target.value)}: x))} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Case Qty</label>
                                <input type="number" placeholder="0" className="w-full px-3 py-2 border border-neutral-soft rounded-lg" />
                              </div>
                              <div className="col-span-1 flex justify-end pt-5">
                                <button type="button" className="p-2 text-accent-danger hover:bg-red-50 rounded-md" onClick={()=> setExtraLines(prev=> prev.filter(x=> x.id!==l.id))}>🗑️</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>

                  {/* Additional Packaging field - after Products section */}
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">Additional Packaging</label>
                    <textarea
                      placeholder="Additional packaging requirements or notes..."
                      className="w-full min-h-[80px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light resize-none"
                      value={form.additionalPackaging}
                      onChange={(e)=>setForm({...form, additionalPackaging: e.target.value})}
                    />
                  </div>


                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <MapPin className="h-4 w-4 mr-2 text-primary-medium" />
                        Location
                      </label>
                      <div className="relative" ref={locationRef}>
                        <button type="button" onClick={()=>setIsLocationOpen(v=>!v)} className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light">
                          <span className={form.location? 'text-neutral-dark':'text-neutral-medium'}>{form.location || 'Select Location'}</span>
                          <span className="ml-2 text-neutral-medium">▼</span>
                        </button>
                        {isLocationOpen && (
                          <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                            {productionLines.length === 0 ? (
                              <div className="px-4 py-2 text-sm text-neutral-medium">
                                {canManageProductionLines ? 'No production lines found' : 'Wait for Production Manager to create room lines'}
                              </div>
                            ) : (
                              productionLines.map((ln) => (
                                <button
                                  key={ln.id}
                                  type="button"
                                  className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${form.location===ln.name?'bg-neutral-light':''}`}
                                  onClick={()=>{setForm({...form, location: ln.name}); setIsLocationOpen(false)}}
                                >
                                  {ln.name}
                                </button>
                              ))
                            )}
                            {productionLines.length === 0 && canManageProductionLines && (
                              <button
                                type="button"
                                className="w-full text-left px-4 py-2 text-primary-medium hover:text-primary-dark hover:bg-neutral-light"
                                onClick={() => {
                                  setCreateLineError(null)
                                  setCreateLineName('')
                                  setCreateLineOpen(true)
                                  setIsLocationOpen(false)
                                }}
                              >
                                + Create Production Line
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Payment Terms</label>
                      <div className="relative" ref={paymentTermsRef}>
                        <button
                          type="button"
                          onClick={() => setIsPaymentTermsOpen((v) => !v)}
                          className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                        >
                          <span className={form.paymentTerms ? 'text-neutral-dark' : 'text-neutral-medium'}>
                            {form.paymentTerms || 'Select Payment Terms'}
                          </span>
                          <span className="ml-2 text-neutral-medium">▼</span>
                        </button>
                        {isPaymentTermsOpen && (
                          <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                            <div className="px-3 py-2 text-xs text-neutral-medium">Select Payment Terms</div>
                            {[
                              'Pay In Advance',
                              '50% Down & 50% DOR',
                              '50% Down & Net 15',
                              'Net 15',
                              'Net 30',
                              'Net 60',
                              'Net 90',
                            ].map((t) => (
                              <button
                                key={t}
                                type="button"
                                className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${form.paymentTerms===t ? 'bg-neutral-light' : ''}`}
                                onClick={() => { setForm({ ...form, paymentTerms: t }); setIsPaymentTermsOpen(false) }}
                              >
                                {t}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-primary-medium hover:text-primary-dark hover:bg-neutral-light"
                              onClick={() => { setNewPaymentTerms(''); setShowAddPaymentTerms(true); setIsPaymentTermsOpen(false) }}
                            >
                              + Add New Payment Terms
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Sales Representative</label>
                      <div className="relative" ref={salesRepRef}>
                        <button
                          type="button"
                          onClick={() => setIsSalesRepOpen((v) => !v)}
                          className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                        >
                          <span className={form.salesRepresentative ? 'text-neutral-dark' : 'text-neutral-medium'}>
                            {form.salesRepresentative || 'Select Sales Representative'}
                          </span>
                          <span className="ml-2 text-neutral-medium">▼</span>
                        </button>
                        {isSalesRepOpen && (
                          <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                            <div className="px-3 py-2 text-xs text-neutral-medium">Select Sales Representative</div>
                            {['Carol', 'Henry', 'Ezekiel', 'Edwin'].map((t) => (
                              <button
                                key={t}
                                type="button"
                                className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${form.salesRepresentative===t ? 'bg-neutral-light' : ''}`}
                                onClick={() => { setForm({ ...form, salesRepresentative: t }); setIsSalesRepOpen(false) }}
                              >
                                {t}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-primary-medium hover:text-primary-dark hover:bg-neutral-light"
                              onClick={() => { setNewSalesRep(''); setShowAddSalesRep(true); setIsSalesRepOpen(false) }}
                            >
                              + Add New Sales Representative
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Status</label>
                      <select className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.status} onChange={(e)=>setForm({...form, status:e.target.value})}>
                        {[Status.Draft, Status.Submitted, Status.Approved, Status.Allocated, Status.Backordered, { value: 'ready_to_ship', label: 'Completed' }, 'partially_shipped', 'shipped', Status.OnHold, Status.Canceled].map((s: any) => {
                          if (typeof s === 'string') return <option key={s} value={s}>{s}</option>
                          return <option key={String(s.value)} value={String(s.value)}>{String(s.label)}</option>
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Deposit Paid toggle - FINAL FIELD */}
                  <div className="flex items-center justify-between py-3">
                    <label className="text-sm text-neutral-dark">Deposit Paid?</label>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev: any) => ({ ...prev, deposit_paid: !prev.deposit_paid }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        form.deposit_paid ? 'bg-primary-medium' : 'bg-neutral-soft'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          form.deposit_paid ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>




                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="submit" className="px-5 py-2.5 rounded-lg bg-primary-dark hover:bg-primary-medium text-white font-semibold shadow-sm">
                      {isEditOpen? 'Update Order' : 'Create Order'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        {isViewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setIsViewOpen(null)}></div>
            <div className="relative z-10 w-full max-w-6xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-neutral-soft/30 overflow-hidden flex flex-col">
              {/* ERP Premium Title Header */}
              <div className="relative flex items-center justify-between px-10 py-7 
                  bg-gradient-to-r from-neutral-50 via-primary-light/20 to-primary-light/10
                  backdrop-blur-md border-b border-neutral-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]
                  rounded-t-2xl">

                {/* Left Section */}
                <div className="flex flex-col">
                  <h2 className="text-2xl font-semibold text-neutral-800 tracking-tight leading-tight">
                    {isViewOpen?.is_copack ? 'Copack Order Details' : 'Purchase Order Details'}
                  </h2>

                  <p className="text-sm text-neutral-500 leading-snug mt-1">
                    {isViewOpen?.is_copack ? 'Order Information • Materials Allocation' : 'Order Information • Line Items • Shipments • Materials'}
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setIsViewOpen(null)}
                  className="p-2.5 rounded-xl hover:bg-neutral-200/70 text-neutral-500 
                    hover:text-neutral-900 transition-all duration-300 shadow-sm
                    hover:shadow-md hover:scale-105 active:scale-95"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="flex-1 overflow-auto">
                <div className="p-8">
                  {/* Enhanced Order Information Card */}
                  <div className="mb-8 bg-white rounded-3xl border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
                    {/* Header Section */}
                    <div className="relative bg-gradient-to-r from-slate-50 via-neutral-50 to-slate-50/80 border-b border-neutral-200/60 px-6 py-5">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500/10 to-primary-600/20 rounded-2xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 tracking-tight">{isViewOpen?.is_copack ? 'Copack Order Information' : 'Order Information'}</h3>
                          <p className="text-sm text-slate-500 mt-0.5">{isViewOpen?.is_copack ? 'Materials allocation and status' : 'Purchase order details and status'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                            <User className="h-4 w-4 mr-2 text-primary-medium" /> Customer
                          </label>
                          <div className="text-neutral-dark font-semibold">{isViewOpen.customer_name || isViewOpen.customer_id || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                            <Package className="h-4 w-4 mr-2 text-primary-medium" /> Product
                          </label>
                          <div className="text-neutral-dark">{isViewOpen.product_name || isViewOpen.product_id || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                            <Package className="h-4 w-4 mr-2 text-primary-medium" /> Quantity
                          </label>
                          <div className="text-neutral-dark font-medium">{isViewOpen.quantity || '—'}</div>
                        </div>
                        {!isViewOpen?.is_copack && (
                          <div className="space-y-1">
                            <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                              <Calendar className="h-4 w-4 mr-2 text-primary-medium" /> Ship Date
                            </label>
                            <div className="text-neutral-dark">{isViewOpen.requested_ship_date || '—'}</div>
                          </div>
                        )}
                        {isViewOpen?.is_copack && (
                          <div className="space-y-1">
                            <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                              Copack Material Source
                            </label>
                            <div className="text-neutral-dark font-medium">
                              {isViewOpen.client_materials_required ? 'Client-supplied materials' : (isViewOpen.operation_supplies_materials ? 'Operations supplies materials' : '—')}
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                            <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" /> Status
                          </label>
                          <div>
                            {(() => {
                              const st = String(isViewOpen.status || '').toLowerCase()
                              const statusClass = (st === 'on hold' || st === 'canceled')
                                ? 'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
                                : (st === 'approved' || st === 'allocated')
                                  ? 'bg-accent-success/10 text-accent-success border-accent-success/30'
                                  : (st === 'partially_shipped')
                                    ? 'bg-accent-warning/10 text-accent-warning border-accent-warning/30'
                                    : 'bg-neutral-light/40 text-neutral-dark border-neutral-soft/60'
                              return (
                                <div className="space-y-1">
                                  <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${statusClass}`}>
                                    {isViewOpen.status || '—'} {isViewOpen.is_copack && (<span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">COPACK</span>)}
                                  </span>
                                  <div className="text-[11px] text-neutral-medium">
                                    {isViewOpen?.is_copack
                                      ? (String(isViewOpen.status).toLowerCase()==='allocated'
                                          ? 'Allocated: materials reserved from inventory; ready for production.'
                                          : statusDescription(isViewOpen.status))
                                      : statusDescription(isViewOpen.status)}
                                  </div>
                                  
                                  {/* Conflict Tag in Modal */}
                                  {(() => {
                                    const hasConflict = hasPlannerConflict(isViewOpen)
                                    if (!hasConflict) return null
                                    
                                    return (
                                      <span className="px-2 py-1 bg-red-200 text-red-800 rounded text-xs">
                                        Conflict — Planner Action Required
                                      </span>
                                    )
                                  })()}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                            <MapPin className="h-4 w-4 mr-2 text-primary-medium" /> Location
                          </label>
                          <div className="text-neutral-dark">{isViewOpen.location || '—'}</div>
                        </div>
                        {!isViewOpen?.is_copack && (
                          <div className="space-y-1">
                            <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                              Rush Order
                            </label>
                            <div>
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                                isViewOpen.is_rush 
                                  ? 'bg-orange-50 text-orange-600 border-orange-200' 
                                  : 'bg-neutral-light/40 text-neutral-dark border-neutral-soft/60'
                              }`}>
                                {isViewOpen.is_rush ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                            <Calendar className="h-4 w-4 mr-2 text-primary-medium" /> Date Submitted
                          </label>
                          <div className="text-neutral-dark">{isViewOpen.date || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Line Items Section */}
                  {!isViewOpen?.is_copack && (
                    <div className="mb-8 bg-white rounded-3xl border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
                      {/* Header Section */}
                      <div className="relative bg-gradient-to-r from-slate-50 via-neutral-50 to-slate-50/80 border-b border-neutral-200/60 px-6 py-5">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-500/10 to-primary-600/20 rounded-2xl flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary-600" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 tracking-tight">Line Items</h3>
                            <p className="text-sm text-slate-500 mt-0.5">Product quantities and allocation status</p>
                          </div>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-neutral-light/40 border-b border-neutral-soft/50">
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-medium uppercase">Product</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Ordered</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Allocated</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Shortfall</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-medium uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewLoading ? (
                            <tr><td className="px-4 py-4 text-sm text-neutral-medium" colSpan={5}>Loading…</td></tr>
                          ) : viewLines.length === 0 ? (
                            <tr><td className="px-4 py-4 text-sm text-neutral-medium" colSpan={5}>No lines</td></tr>
                          ) : (
                            viewLines.map((ln, i) => (
                              <tr key={i} className="border-t border-neutral-soft/30">
                                <td className="px-4 py-2 text-sm text-neutral-dark">{ln.product_name}</td>
                                <td className="px-4 py-2 text-sm text-right">{ln.quantity}</td>
                                <td className="px-4 py-2 text-sm text-right">{ln.allocated_qty}</td>
                                <td className={`px-4 py-2 text-sm text-right ${ln.shortfall_qty>0? 'text-amber-700 font-semibold':'text-neutral-dark'}`}>{ln.shortfall_qty}</td>
                                <td className="px-4 py-2 text-sm text-neutral-dark">{ln.status}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}

                  {/* Copack: Materials Allocation only */}
                {isViewOpen?.is_copack && (
                  <div className="space-y-3 mb-6">
                    <h3 className="text-base font-semibold text-neutral-dark">Materials Allocation</h3>
                    <div className="overflow-x-auto rounded-xl border border-neutral-soft/40 bg-white shadow-sm">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-neutral-light/40 border-b border-neutral-soft/50">
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-medium uppercase">Material</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Required</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Allocated</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Shortfall</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-medium uppercase">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-soft/30">
                          {viewLoading ? (
                            <tr><td className="px-4 py-4 text-sm text-neutral-medium" colSpan={5}>Loading…</td></tr>
                          ) : viewLines.length === 0 ? (
                            <tr><td className="px-4 py-4 text-sm text-neutral-medium" colSpan={5}>No materials</td></tr>
                          ) : (
                            viewLines.map((ln, i) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-light/20'}>
                                <td className="px-4 py-2 text-sm text-neutral-dark">{ln.product_name}</td>
                                <td className="px-4 py-2 text-sm text-right font-medium">{ln.quantity}</td>
                                <td className="px-4 py-2 text-sm text-right font-medium">{ln.allocated_qty}</td>
                                <td className={`px-4 py-2 text-sm text-right ${Number(ln.shortfall_qty)>0? 'text-amber-700 font-semibold':'text-accent-success font-semibold'}`}>{ln.shortfall_qty}</td>
                                <td className="px-4 py-2 text-sm">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isViewOpen?.operation_supplies_materials ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                                    {isViewOpen?.operation_supplies_materials ? 'OPS Material' : (isViewOpen?.client_materials_required ? 'Client Material' : '—')}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {hasViewShortfall && !isViewOpen?.is_copack && !isViewOpen?.operation_supplies_materials && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between text-sm mt-1">
                    <div>
                      <div className="font-semibold text-amber-800">This purchase order has unfulfilled quantities.</div>
                      <div className="text-xs text-amber-700 mt-0.5">Create or update a production batch to cover the shortfall.</div>
                    </div>
                    <button
                      className="px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-xs font-semibold shadow-sm"
                      onClick={() => { const id = String(isViewOpen.id); setIsViewOpen(null); navigate(`/production-schedule?poId=${encodeURIComponent(id)}`) }}
                    >
                      Go to Production Schedule
                    </button>
                  </div>
                )}

                {/* Copack-only sections */}
                {isViewOpen.is_copack && (
                  <>
                    {/* Show client allocation box only when client materials mode is ON */}
                    {!!isViewOpen.client_materials_required && !isViewOpen.operation_supplies_materials && (
                      <div className="mt-6">
                        <CopackAllocatedMaterials data={viewCopackRes} />
                      </div>
                    )}
                    {Array.isArray(viewFormulaItems) && viewFormulaItems.length > 0 && (
                      <div className="mt-6">
                        <CopackBOMMaterials
                          data={viewFormulaItems}
                          poQty={Number(isViewOpen.quantity || 0)}
                          formulaName={viewFormula?.formula_name}
                          opsMode={!!isViewOpen.operation_supplies_materials}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Shipments (Brand PO only) */}
                {!isViewOpen?.is_copack && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-neutral-dark">Shipments</h3>
                  <div className="border border-neutral-soft/40 rounded-xl bg-neutral-light/20">
                    <div className="px-4 py-3 border-b border-neutral-soft/40 flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Shipments</span>
                    </div>
                    {(!Array.isArray(viewShipments) || viewShipments.length === 0) ? (
                      <div className="px-4 py-4 text-xs text-neutral-medium">No shipments created for this PO yet.</div>
                    ) : (
                      <div className="divide-y divide-neutral-soft/40">
                        {viewShipments.map((s:any, idx:number) => {
                          const fmt = (d:any) => {
                            if (!d) return '-'
                            try { const dt = new Date(d); return dt.toLocaleDateString() } catch { return String(d) }
                          }
                          return (
                            <div key={s.id || idx} className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-sm font-semibold text-neutral-dark">Shipment #{idx + 1}</div>
                                <div className="text-xs px-2 py-1 rounded-lg border border-neutral-soft text-neutral-dark bg-white">{fmt(s.shipment_date)}</div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-6">
                                <div className="text-sm text-neutral-dark"><span className="font-semibold">Shipped Qty:</span> {s.shipped_qty ?? '-'}</div>
                                <div className="text-sm text-neutral-dark"><span className="font-semibold">Status:</span> {s.status ?? '-'}</div>
                                <div className="text-sm text-neutral-dark"><span className="font-semibold">ETA Date:</span> {fmt(s.eta)}</div>
                                <div className="text-sm text-neutral-dark md:col-span-2"><span className="font-semibold">Notes:</span> {s.notes || '-'}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* Purchase Requisitions for this Copack PO */}
                {isViewOpen?.is_copack && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-base font-semibold text-neutral-dark">Raw Material Purchase Requisitions for this Copack PO</h3>
                  <div className="rounded-xl border border-neutral-soft/40 bg-white shadow-sm">
                    <div className="px-4 py-3 border-b border-neutral-soft/40 flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-medium uppercase tracking-wide">PRs created for copack materials</span>
                      {viewPrLoading && <span className="text-[11px] text-neutral-medium">Loading…</span>}
                    </div>
                    {viewPrs.length === 0 && !viewPrLoading ? (
                      <div className="px-4 py-4 text-xs text-neutral-medium">No open raw material purchase requisitions for this PO.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="bg-neutral-light/40 border-b border-neutral-soft/50">
                              <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-medium uppercase">Material</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Required</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-medium uppercase">Needed By</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-medium uppercase">Status</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-medium uppercase">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-soft/30">
                            {viewPrs.map((pr:any) => {
                              const cleanNotes = (() => {
                                const raw = pr.notes || ''
                                try { return raw.trim() } catch { return raw }
                              })()
                              return (
                                <tr key={pr.id} className="bg-white">
                                  <td className="px-4 py-2 text-sm text-neutral-dark">{pr.item_name}</td>
                                  <td className="px-4 py-2 text-sm text-right">{pr.required_qty}</td>
                                  <td className="px-4 py-2 text-sm">{pr.needed_by || '—'}</td>
                                  <td className="px-4 py-2 text-sm">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${String(pr.status||'').toLowerCase()==='open' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-neutral-light/40 text-neutral-dark border-neutral-soft/60'}`}>
                                      {pr.status || '—'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-neutral-dark">{cleanNotes || '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* Raw Material PRs linked to this PO (Brand PO only) */}
                {!isViewOpen?.is_copack && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-neutral-dark">Raw Material Purchase Requisitions for this PO</h3>
                  <div className="border border-neutral-soft/40 rounded-xl bg-neutral-light/20">
                    <div className="px-4 py-3 border-b border-neutral-soft/40 flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-medium uppercase tracking-wide">Auto PR from PO Shortfall</span>
                      {viewPrLoading && <span className="text-[11px] text-neutral-medium">Loading…</span>}
                    </div>
                    {viewPrs.length === 0 && !viewPrLoading ? (
                      <div className="px-4 py-4 text-xs text-neutral-medium">No open raw material purchase requisitions for this PO.</div>
                    ) : (
                      <div className="divide-y divide-neutral-soft/40">
                        {viewPrs.map(pr => {
                          const cleanNotes = (() => {
                            const raw = pr.notes || ''
                            try { return raw.replace(/\s*for\s+Batch-[a-z0-9-]+/i, '').trim() } catch { return raw }
                          })()
                          return (
                            <div key={pr.id} className="p-4">
                              <div className="text-sm text-neutral-dark"><span className="font-semibold">Item:</span> {pr.item_name}</div>
                              <div className="text-sm text-neutral-dark"><span className="font-semibold">Required Qty:</span> {pr.required_qty}</div>
                              <div className="text-sm text-neutral-dark mt-2"><span className="font-semibold">Notes:</span> {cleanNotes || '-'}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                )}

                {isViewOpen.comments && (
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <FileText className="h-4 w-4 mr-2 text-primary-medium" /> Comments
                    </label>
                    <div className="bg-neutral-light/30 rounded-lg p-4 text-neutral-dark">
                      {isViewOpen.comments && <div><strong>Comments:</strong> {isViewOpen.comments}</div>}
                    </div>
                  </div>
                )}
                
                  <div className="flex justify-end">
                    <button onClick={() => setIsViewOpen(null)} className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all">
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Priority Allocation Rules Modal */}
        {showPriorityModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowPriorityModal(false)}></div>
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-amber-900">Priority Allocation Rules</h2>
                    <p className="text-sm text-amber-700 mt-1">Cannot approve - PO priority validation failed</p>
                  </div>
                </div>
              </div>
              <div className="p-8">
                <div className="space-y-4 text-sm text-neutral-dark">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-900 mb-2">System Priority Rules:</h3>
                    <p className="text-amber-800">
                      When multiple POs need the same inventory, the system must 
                      <strong> ALWAYS follow priority scoring</strong>. Earlier requested ship dates 
                      come first. Deposit-paid POs outrank non-deposit POs. If both 
                      are equal, the older PO (earlier created_at) has priority.
                    </p>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-2">Action Blocked:</h3>
                    <p className="text-red-800">
                      Manual Approve/Allocate actions cannot bypass this priority system. 
                      This PO is not the highest priority and cannot be approved at this time.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
                    <p className="text-blue-800">
                      Please approve POs in the correct priority order, or update the 
                      requested ship date and deposit status to change priority ranking.
                    </p>
                  </div>

                  <div className="text-center mt-6 p-4 bg-neutral-50 rounded-lg">
                    <p className="text-lg font-semibold text-neutral-700">
                      <em>THEN allocate by priority score.</em>
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button
                    className="px-6 py-3 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all"
                    onClick={() => setShowPriorityModal(false)}
                  >
                    I Understand
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {createLineOpen && canManageProductionLines && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !createLineSaving && setCreateLineOpen(false)}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-soft/30 flex items-center justify-between">
                <div className="text-lg font-semibold text-neutral-dark">Create Production Line</div>
                <button type="button" className="p-2 rounded-lg hover:bg-neutral-light/40 text-neutral-medium" onClick={() => !createLineSaving && setCreateLineOpen(false)}>
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-neutral-dark">Line Name</label>
                  <input
                    value={createLineName}
                    onChange={(e) => setCreateLineName(e.target.value)}
                    className="mt-2 w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-medium"
                    placeholder="e.g. Room 1"
                    disabled={createLineSaving}
                  />
                </div>
                {createLineError && (
                  <div className="text-sm text-accent-danger">{createLineError}</div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-neutral-soft/30 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateLineOpen(false)}
                  disabled={createLineSaving}
                  className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createLineSaving}
                  onClick={async () => {
                    try {
                      setCreateLineSaving(true)
                      setCreateLineError(null)
                      const name = createLineName.trim()
                      if (!name) {
                        setCreateLineError('Line name is required')
                        return
                      }
                      const { error } = await supabase.from('production_lines').insert({
                        line_name: name,
                        allowed_allergens: [],
                        sanitation_minutes: 30,
                        needs_qa_signoff: true,
                      })
                      if (error) throw error
                      await fetchProductionLines()
                      setCreateLineOpen(false)
                    } catch (e: any) {
                      setCreateLineError(e?.message || 'Failed to create production line')
                    } finally {
                      setCreateLineSaving(false)
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-primary-medium text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  {createLineSaving ? 'Saving…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Planner Override Modal */}
        {showPlannerOverride && overridePo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={closePlannerOverride}></div>
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Planner Override Required</h3>
                  <button onClick={closePlannerOverride} className="text-white/80 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-800">Allocation Conflict</h4>
                      <p className="text-sm text-red-700 mt-1">
                        Insufficient finished goods remain to fulfill this order after the priority rules were applied.
                        <br />Product Name: {overridePo.product_name}
                        <br />Required: {overridePo.quantity} • Allocated: {overridePo.allocated_qty || 0} • Available FG: {finishedGoodsData[overridePo.product_name]?.available_qty || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-neutral-dark">Select an action</h4>
                  
                  {/* Manual Allocation Override */}
                  <div className="border border-neutral-soft rounded-lg p-4">
                    <h5 className="font-medium text-neutral-dark mb-2">Manual Allocation Override</h5>
                    <p className="text-xs text-neutral-medium mb-3">Enter the quantity to allocate manually for this order.</p>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        className="flex-1 px-3 py-2 border border-neutral-soft rounded-lg"
                        value={overrideQty}
                        onChange={(e) => setOverrideQty(Number(e.target.value))}
                        placeholder="Enter quantity"
                      />
                      <button
                        className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-colors"
                        onClick={() => applyOverride(overridePo.id, overrideQty)}
                      >
                        Apply Override
                      </button>
                    </div>
                  </div>

                  {/* Client Communication */}
                  <div className="border border-neutral-soft rounded-lg p-4">
                    <h5 className="font-medium text-neutral-dark mb-2">Client Communication</h5>
                    <p className="text-xs text-neutral-medium mb-3">Mark this order for client follow-up and customer approval of the shortfall.</p>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      onClick={() => markClientCommunication(overridePo.id)}
                    >
                      Notify Client / Mark for Follow‑up
                    </button>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PurchaseOrders
