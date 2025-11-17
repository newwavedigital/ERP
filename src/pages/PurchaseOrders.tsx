import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, User, Package, Calendar, FileText, Eye, Pencil, Trash2, MapPin, BadgeCheck, Search, Filter, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Status } from '../domain/enums'
import { validatePODraft } from '../rules/po.rules'
import { PO_RULES } from '../config/rules-config'
import SubstituteModal from '../components/SubstituteModal'

const PurchaseOrders: React.FC = () => {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState<any>(null)
  const [isEditOpen, setIsEditOpen] = useState<any>(null)
  const [isCustomerOpen, setIsCustomerOpen] = useState(false)
  
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const [customers, setCustomers] = useState<Array<{id:string; name:string; credit_hold?: boolean; overdue_balance?: number}>>([])
  const [products, setProducts] = useState<Array<{id:string; name:string; sku?:string; is_discontinued?: boolean; substitute_sku?: string | null}>>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [rushFilter, setRushFilter] = useState<string>('All')
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [isRushOpen, setIsRushOpen] = useState(false)
  const [packagingTypes, setPackagingTypes] = useState<string[]>(['Jars','Squeeze packs','Sachets'])
  const [packagingReady, setPackagingReady] = useState<boolean>(true)
  const [showManagePackaging, setShowManagePackaging] = useState(false)
  const [newPackaging, setNewPackaging] = useState('')
  const [selectedPackagingTypes, setSelectedPackagingTypes] = useState<string[]>([])
  const [extraLines, setExtraLines] = useState<Array<{ id: string; product: string; qty: number }>>([])
  const [toast, setToast] = useState<{ show: boolean; message: string; kind?: 'success' | 'warning' | 'error' }>({ show: false, message: '', kind: 'success' })
  const [isAllocOpen, setIsAllocOpen] = useState(false)
  const [allocSummary, setAllocSummary] = useState<any | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showSubModal, setShowSubModal] = useState(false)
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null)
  const [pendingLines, setPendingLines] = useState<Array<{ id?: string; product_name: string; quantity?: number }>>([])
  const [showNoFg, setShowNoFg] = useState(false)
  const navigate = useNavigate()
  const [showBackorderAdvisory, setShowBackorderAdvisory] = useState(false)
  const [viewLines, setViewLines] = useState<Array<{ product_name: string; quantity: number; allocated_qty: number; shortfall_qty: number; status: string }>>([])
  const [viewLoading, setViewLoading] = useState(false)
  const [viewShipments, setViewShipments] = useState<any[]>([])
  const [viewCopackRes, setViewCopackRes] = useState<any[]>([])
  const [viewFormula, setViewFormula] = useState<any | null>(null)
  const [viewFormulaItems, setViewFormulaItems] = useState<any[]>([])
  const [viewPrs, setViewPrs] = useState<Array<{ id: string; item_name: string; required_qty: number; needed_by: string | null; status: string; created_at: string | null; notes?: string | null }>>([])
  const [viewPrLoading, setViewPrLoading] = useState(false)
  const [form, setForm] = useState({
    date: '',
    customer: '',
    customer_id: '',
    product: '',
    packagingType: '',
    requestedShipDate: '',
    ship_date: '',
    quantity: '',
    caseQty: '',
    notes: '',
    invoice: '',
    paymentTerms: '',
    status: 'Open',
    comments: '',
    location: '',
    is_copack: false,
    client_materials_required: false,
    lines: [] as Array<{ sku?: string; product_name: string; qty: number; is_discontinued?: boolean; substitute_sku?: string | null }>
  })
  const customerRef = useRef<HTMLDivElement>(null)
  
  const locationRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const rushRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setIsCustomerOpen(false)
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) setIsLocationOpen(false)
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setIsStatusOpen(false)
      if (rushRef.current && !rushRef.current.contains(e.target as Node)) setIsRushOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

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

  const CopackBOMMaterials: React.FC<{ data: any[]; poQty: number; formulaName?: string }>
    = ({ data, poQty, formulaName }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-dark">Client Materials Used</h3>
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
        // 2) Formula by product_id (fallback: find product id by product_name)
        let productId: string | null = isViewOpen.product_id ? String(isViewOpen.product_id) : null
        if (!productId && isViewOpen.product_name) {
          const nm = String(isViewOpen.product_name || '').trim()
          const { data: prodRow } = await supabase
            .from('products')
            .select('id')
            .ilike('product_name', `%${nm}%`)
            .maybeSingle()
          productId = prodRow?.id ? String(prodRow.id) : null
        }
        let formula: any = null
        if (productId) {
          const { data: f, error: fErr } = await supabase
            .from('formulas')
            .select('id, formula_name')
            .eq('product_id', productId)
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

  const hasViewShortfall = useMemo(
    () => viewLines.some(l => Number(l.shortfall_qty || 0) > 0),
    [viewLines]
  )

  // Pre-approval check: discontinued + substitutes
  const handleApproveClick = async (po: any) => {
    try {
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

  // When allocation summary opens with backordered status, detect full shortfall and absence of finished_goods
  useEffect(() => {
    const check = async () => {
      try {
        setShowBackorderAdvisory(false)
        const sum: any = allocSummary
        if (!sum || String(sum?.status || '').toLowerCase() !== 'backordered') return
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
  }, [allocSummary])

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
    if (toast.show) {
      const t = setTimeout(() => setToast({ show: false, message: '' }), 3000)
      return () => clearTimeout(t)
    }
  }, [toast.show])
  
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const [{ data: cData, error: cErr }, { data: pData, error: pErr }, { data: oData, error: oErr }] = await Promise.all([
        supabase.from('customers').select('id, company_name, credit_hold, overdue_balance').order('company_name', { ascending: true }),
        // After running the provided SQL, these columns will exist
        supabase.from('products').select('id, product_name, is_discontinued, substitute_sku').order('product_name', { ascending: true }),
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      ])
      if (cErr) setError('Cannot load customers')
      if (!cErr) setCustomers((cData ?? []).map((r: any) => ({ id: String(r.id), name: String(r.company_name ?? ''), credit_hold: !!r.credit_hold, overdue_balance: Number(r.overdue_balance ?? 0) })))
      if (!pErr) setProducts((pData ?? []).map((r: any) => ({ id: String(r.id), name: String(r.product_name ?? ''), is_discontinued: !!r.is_discontinued, substitute_sku: r.substitute_sku ?? null })))
      if (!oErr) setOrders(oData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const loadPackagingTypes = async () => {
      try {
        const { data, error } = await supabase.from('packaging_types').select('name').order('name', { ascending: true })
        if (error) {
          setPackagingReady(false)
          return
        }
        if (data && Array.isArray(data)) setPackagingTypes(data.map((r: any)=> String(r.name)))
        setPackagingReady(true)
      } catch {
        setPackagingReady(false)
      }
    }
    loadPackagingTypes()
  }, [])

  // validation handled by validatePODraft

  const resetForm = () => {
    setForm({
      date: '',
      customer: '',
      customer_id: '',
      product: '',
      packagingType: '',
      requestedShipDate: '',
      ship_date: '',
      quantity: '',
      caseQty: '',
      notes: '',
      invoice: '',
      paymentTerms: '',
      status: 'Open',
      comments: '',
      location: '',
      is_copack: false,
      client_materials_required: false,
      lines: []
    })
  }

  const saveOrder = async () => {
    setError(null)

    // Build draft payload from UI
    const selectedCustomerId = customers.find(c => c.name === form.customer)?.id || null
    const draft = {
      customer_id: form.customer_id || selectedCustomerId || null,
      ship_date: form.ship_date,
      location: form.location,
      is_copack: !!form.is_copack,
      client_materials_required: !!form.client_materials_required,
      lines: (form.lines || []).map(l => ({
        sku: (l as any).sku,
        product_name: l.product_name,
        qty: Number((l as any).qty || 0),
        is_discontinued: (l as any).is_discontinued,
        substitute_sku: (l as any).substitute_sku,
      })),
    }

    const customer = customers.find(c => c.id === draft.customer_id) || null

    // VALIDATE AGAINST RULE ENGINE
    const result = validatePODraft(draft, customer, productsIndex)

    if (!result.ok) {
      setToast({ show: true, message: result.errors.join(' '), kind: 'error' })
      return
    }

    // Auto status rules
    let status = form.status || 'Draft'
    if (result.flags.creditHold) status = 'On Hold'

    const is_rush = result.flags.rush === true

    setLoading(true)
    try {
      const mainProd = products.find(p => p.name === form.product) || null
      let po_id: string

      if (isEditOpen?.id) {
        // UPDATE existing head
        const { error: upErr } = await supabase
          .from('purchase_orders')
          .update({
            date: form.date || null,
            customer_id: draft.customer_id,
            customer_name: form.customer || (customers.find(c=>c.id===draft.customer_id)?.name || null),
            product_id: mainProd?.id || null,
            product_name: form.product || null,
            requested_ship_date: draft.ship_date,
            quantity: form.quantity ? Number(form.quantity) : null,
            location: draft.location || null,
            status,
            is_rush,
            is_copack: !!draft.is_copack,
            client_materials_required: !!draft.client_materials_required,
            notes: form.notes || null,
            invoice: form.invoice || null,
            payment_terms: form.paymentTerms || null,
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
            product_id: mainProd?.id || null,
            product_name: form.product || null,
            requested_ship_date: draft.ship_date,
            quantity: form.quantity ? Number(form.quantity) : null,
            location: draft.location || null,
            status,
            is_rush,
            is_copack: !!draft.is_copack,
            client_materials_required: !!draft.client_materials_required,
            notes: form.notes || null,
            invoice: form.invoice || null,
            payment_terms: form.paymentTerms || null,
          })
          .select()
          .single()
        if (headErr) throw headErr
        po_id = String(poHead.id)
      }

      // Replace lines for this PO
      await supabase.from('purchase_order_lines').delete().eq('purchase_order_id', po_id)

      const linesPayload = (draft.lines || []).map(l => ({
        purchase_order_id: po_id,
        product_name: l.product_name,
        quantity: l.qty,
      }))

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
      const { data } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })
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

  // Approve + Allocate for a single PO (final action)
  const approveAndAllocate = async (po: any) => {
    const poId = String(po.id)
    try {
      setError(null)

      // 1. Mark PO as approved
      const { error: upErr } = await supabase
        .from('purchase_orders')
        .update({ status: 'approved' })
        .eq('id', poId)
      if (upErr) throw upErr

      // 2. Decide which RPC to call
      const isCopack = !!po.is_copack
      const rpcName = isCopack ? 'allocate_copack_po_materials' : 'allocate_brand_po_finished_first'
      const { data: summary, error: rpcErr } = await supabase.rpc(rpcName, { p_po_id: poId })
      if (rpcErr) throw rpcErr

      // 3. Refresh PO list
      const { data: poRows } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false })
      setOrders(poRows ?? [])

      // 4. Allocation modal + toast
      setAllocSummary(summary || null)
      setIsAllocOpen(true)
      setToast({
        show: true,
        message: `Allocation result: ${String(summary?.status || 'done')}`,
        kind: summary?.status === 'allocated' ? 'success' : 'warning',
      })
    } catch (e: any) {
      setError(e?.message || 'Failed to approve and allocate')
      setToast({ show: true, message: e?.message || 'Allocation failed', kind: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
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
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsAllocOpen(false)}></div>
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <h2 className="text-2xl font-semibold text-neutral-dark">Allocation Summary</h2>
                <p className="text-sm text-neutral-medium mt-1">Status: {String(allocSummary?.status || '')}</p>
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
                {showBackorderAdvisory && (
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
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Line</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Ordered</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Allocated</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Shortfall</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-soft/20">
                      {(Array.isArray(allocSummary?.lines) ? allocSummary.lines : []).map((ln: any, idx: number) => (
                        <tr key={ln.id || idx} className="group">
                          <td className="px-6 py-3 text-sm text-neutral-dark">{ln.product_name || '—'}</td>
                          <td className="px-6 py-3 text-sm text-neutral-dark">{ln.id}</td>
                          <td className="px-6 py-3 text-sm">{ln.ordered_qty}</td>
                          <td className="px-6 py-3 text-sm">{ln.allocated_qty}</td>
                          <td className="px-6 py-3 text-sm">{ln.shortfall_qty}</td>
                          <td className="px-6 py-3 text-sm">{ln.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end">
                  <button className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all" onClick={() => setIsAllocOpen(false)}>Close</button>
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

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-2">Purchase Orders</h1>
              <p className="text-neutral-medium text-lg">Manage inbound customer purchase orders</p>
            </div>
            <button onClick={() => { setIsEditOpen(null); resetForm(); setSelectedPackagingTypes([]); setExtraLines([]); setIsAddOpen(true) }} className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center">
              <Plus className="h-5 w-5 mr-3" />
              Add Purchase Order
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/2">
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
            <div className="w-full md:flex-1 flex flex-col gap-4">
              <label className="flex items-center text-sm font-semibold text-neutral-dark">
                <Filter className="h-5 w-5 mr-3 text-primary-medium" />
                Filter & Sort
              </label>
              <div className="flex gap-3">
                <div className="relative w-1/2" ref={statusRef}>
                  <button
                    type="button"
                    onClick={()=>setIsStatusOpen(v=>!v)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white transition-all shadow-sm hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:shadow-md"
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
                <div className="relative w-1/2" ref={rushRef}>
                  <button
                    type="button"
                    onClick={()=>setIsRushOpen(v=>!v)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white transition-all shadow-sm hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:shadow-md"
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

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-6">
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
          {loading ? (
            <div className="p-12 text-center text-neutral-medium">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-neutral-medium">No purchase orders yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-primary-medium" />
                        <span>Date</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-primary-medium" />
                        <span>Customer</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-primary-medium" />
                        <span>Product</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Qty</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-primary-medium" />
                        <span>Ship Date</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <BadgeCheck className="h-4 w-4 text-primary-medium" />
                        <span>Status</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Rush</th>
                    <th className="px-8 py-6 text-center text-sm font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-soft/20">
                  {orders
                    .filter((o:any)=>{
                      const hit = (o.customer_name||'').toLowerCase().includes(search.toLowerCase()) || (o.product_name||'').toLowerCase().includes(search.toLowerCase())
                      const statusOk = statusFilter==='All' ? true : o.status===statusFilter
                      const rushOk = rushFilter==='All' ? true : rushFilter==='Rush Only' ? !!o.is_rush : !o.is_rush
                      return hit && statusOk && rushOk
                    })
                    .map((o:any) => {
                      const st = String(o.status || '').toLowerCase()
                      const statusClass = (st === 'on hold' || st === 'canceled')
                        ? 'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
                        : (st === 'approved' || st === 'allocated')
                          ? 'bg-accent-success/10 text-accent-success border-accent-success/30'
                          : 'bg-neutral-light/40 text-neutral-dark border-neutral-soft/60'
                      return (
                        <tr key={o.id} className="group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm">
                          <td className="px-8 py-6">{o.date || '-'}</td>
                          <td className="px-8 py-6">
                            <div className="text-sm font-medium text-neutral-dark truncate max-w-[260px]">{o.customer_name || o.customer_id}</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-sm text-neutral-dark truncate max-w-[260px] flex items-center gap-2">
                              <span className="truncate">{o.product_name || o.product_id}</span>
                              {o.is_copack && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">COPACK</span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6">{o.quantity}</td>
                          <td className="px-8 py-6">{o.requested_ship_date || '-'}</td>
                          <td className="px-8 py-6">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${statusClass}`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="px-8 py-6">{o.is_rush ? 'Yes' : 'No'}</td>
                          <td className="px-8 py-6">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                className="group/btn px-3 py-3 text-primary-medium hover:text-white hover:bg-primary-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium"
                                onClick={() => handleApproveClick(o)}
                                title="Approve & Allocate"
                              >
                                Approve
                              </button>
                              <button className="group/btn p-3 text-primary-medium hover:text-white hover:bg-primary-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium" onClick={() => setIsViewOpen(o)} title="View">
                                <Eye className="h-5 w-5" />
                              </button>
                              <button className="group/btn p-3 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft hover:border-neutral-medium" onClick={async () => {
                                setIsEditOpen(o)
                                setIsAddOpen(true)
                                // Prefill base form values
                                const fallbackName = o.customer_name || (customers.find(c=> String(c.id)===String(o.customer_id))?.name || '')
                                setForm({
                                  date: o.date || '',
                                  customer: fallbackName,
                                  customer_id: o.customer_id ? String(o.customer_id) : '',
                                  product: o.product_name || '',
                                  packagingType: o.packaging_type || '',
                                  requestedShipDate: o.requested_ship_date || '',
                                  ship_date: o.requested_ship_date || '',
                                  quantity: String(o.quantity),
                                  caseQty: o.case_qty ? String(o.case_qty) : '',
                                  notes: o.notes || '',
                                  invoice: o.invoice || '',
                                  paymentTerms: o.payment_terms || '',
                                  status: o.status || 'Open',
                                  comments: o.comments || '',
                                  location: o.location || '',
                                  is_copack: !!o.is_copack,
                                  client_materials_required: !!o.client_materials_required,
                                  lines: []
                                })
                                // Prefill packaging types (array)
                                if (Array.isArray(o.packaging_types)) {
                                  setSelectedPackagingTypes(o.packaging_types as string[])
                                } else if (o.packaging_type) {
                                  setSelectedPackagingTypes([String(o.packaging_type)])
                                } else {
                                  setSelectedPackagingTypes([])
                                }
                                // Load additional items from purchase_order_items
                                try {
                                  const { data: items } = await supabase
                                    .from('purchase_order_lines')
                                    .select('product_name, quantity')
                                    .eq('purchase_order_id', o.id)
                                  const extras = (items ?? [])
                                    .filter((it: any) => !(String(it.product_name || '') === String(o.product_name || '') && Number(it.quantity || 0) === Number(o.quantity || 0)))
                                    .map((it: any) => ({ id: (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`), product: String(it.product_name || ''), qty: Number(it.quantity || 0) }))
                                  setExtraLines(extras)
                                } catch {}
                              }} title="Edit">
                                <Pencil className="h-5 w-5" />
                              </button>
                              <button className="group/btn p-3 text-accent-danger hover:text-white hover:bg-accent-danger rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-accent-danger/30 hover:border-accent-danger" onClick={() => { setDeleteTarget(o); setIsDeleteOpen(true) }} title="Delete">
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
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
            <div className="absolute inset-0 bg-black/50" onClick={() => { setIsAddOpen(false); setIsEditOpen(null); setSelectedPackagingTypes([]); setExtraLines([]); }}></div>
            <div className="relative z-10 w-full max-w-3xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">{isEditOpen ? 'Update Purchase Order' : 'Add Purchase Order'}</h2>
                </div>
                <button onClick={() => { setIsAddOpen(false); setIsEditOpen(null); setSelectedPackagingTypes([]); setExtraLines([]); }} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
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
                        Date
                      </label>
                      <input type="date" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})} />
                    </div>
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
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Product</label>
                      <select className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.product} onChange={(e)=>setForm({...form, product:e.target.value})}>
                        <option value="">Select Product</option>
                        {products.map(p => (
                          <option key={p.id} value={p.name}>{p.name}{p.is_discontinued? ' • Discontinued' : ''}</option>
                        ))}
                      </select>
                    </div>
                    {/* Packaging Type placed next to Product */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center text-sm font-medium text-neutral-dark">
                          <Package className="h-4 w-4 mr-2 text-primary-medium" />
                          Packaging Type
                        </label>
                        <button type="button" disabled={!packagingReady} title={!packagingReady? 'Create table "packaging_types" to manage types' : ''} onClick={()=>setShowManagePackaging(true)} className={`text-xs ${packagingReady? 'text-primary-medium hover:text-primary-dark' : 'text-neutral-medium cursor-not-allowed'}`}>Manage Types</button>
                      </div>
                      <select multiple className="w-full px-3 py-2 border border-neutral-soft rounded-lg h-28" value={selectedPackagingTypes} onChange={(e)=>{
                        const opts = Array.from(e.target.selectedOptions).map(o=>o.value); setSelectedPackagingTypes(opts)
                      }}>
                        {packagingTypes.map(t=> <option key={t} value={t}>{t}</option>)}
                      </select>
                      <div className="text-xs text-neutral-medium">Hold Ctrl/Cmd to select multiple</div>
                    </div>
                  </div>

                  {/* Copack toggles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Copack Settings</label>
                      <div className="flex items-center gap-6 px-3 py-3 border border-neutral-soft rounded-lg bg-white">
                        <label className="flex items-center gap-2 text-sm text-neutral-dark">
                          <input type="checkbox" className="h-4 w-4" checked={form.is_copack} onChange={(e)=>setForm(prev=>({...prev,is_copack:e.target.checked, client_materials_required: e.target.checked ? true : prev.client_materials_required}))} />
                          <span>This is a Copack Order</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-neutral-dark">
                          <input type="checkbox" className="h-4 w-4" checked={form.client_materials_required} onChange={(e)=>setForm(prev=>({...prev,client_materials_required:e.target.checked}))} />
                          <span>Client-supplied materials required</span>
                        </label>
                      </div>
                      {form.is_copack && !form.client_materials_required && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Copack orders require client-supplied materials.</div>
                      )}
                    </div>
                    <div />
                  </div>

                  {/* Additional Products moved to full width below */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-neutral-dark">Additional Products</div>
                      <button type="button" className="px-3 py-1.5 text-xs rounded-md border border-neutral-soft hover:bg-neutral-light" onClick={()=>setExtraLines(prev=>[...prev,{ id: (crypto?.randomUUID?.()||`${Date.now()}`), product: '', qty: 0 }])}>+ Add Product</button>
                    </div>
                    {extraLines.length===0 ? (
                      <div className="text-xs text-neutral-medium border border-dashed border-neutral-soft rounded-lg p-3">No additional products added. Click "+ Add Product" to add more products to this order.</div>
                    ) : (
                      <div className="space-y-3 max-h-60 overflow-auto">
                        {extraLines.map((l)=> (
                          <div key={l.id} className="grid grid-cols-12 gap-3 items-center border border-neutral-soft rounded-lg p-3">
                            <div className="col-span-7">
                              <label className="text-xs text-neutral-medium">Product</label>
                              <select className="w-full px-3 py-2 border border-neutral-soft rounded-lg" value={l.product} onChange={(e)=> setExtraLines(prev=> prev.map(x=> x.id===l.id ? { ...x, product: e.target.value } : x))}>
                                <option value="">Select Product</option>
                                {products.map(p=> <option key={p.id} value={p.name}>{p.name}</option>)}
                              </select>
                            </div>
                            <div className="col-span-4">
                              <label className="text-xs text-neutral-medium">Quantity</label>
                              <input type="number" className="w-full px-3 py-2 border border-neutral-soft rounded-lg" value={l.qty} onChange={(e)=> setExtraLines(prev=> prev.map(x=> x.id===l.id ? { ...x, qty: Number(e.target.value||0) } : x))} />
                            </div>
                            <div className="col-span-1 flex justify-end pt-5">
                              <button type="button" className="p-2 text-accent-danger hover:bg-red-50 rounded-md" onClick={()=> setExtraLines(prev=> prev.filter(x=> x.id!==l.id))}>🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <Calendar className="h-4 w-4 mr-2 text-primary-medium" />
                        Requested Ship Date
                      </label>
                      <input type="date" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.requestedShipDate} onChange={(e)=>setForm({...form, requestedShipDate:e.target.value, ship_date: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Quantity</label>
                      <input type="number" placeholder="Total quantity" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.quantity} onChange={(e)=>setForm({...form, quantity:e.target.value})} />
                    </div>
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
                            {['Main Room','Room A','Room B'].map(loc => (
                              <button key={loc} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${form.location===loc?'bg-neutral-light':''}`} onClick={()=>{setForm({...form, location:loc}); setIsLocationOpen(false)}}>{loc}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Case Quantity</label>
                      <input type="number" placeholder="Per case quantity" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.caseQty} onChange={(e)=>setForm({...form, caseQty:e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                        PO Notes
                      </label>
                      <input type="text" placeholder="Reference or short notes" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Invoice</label>
                      <input type="text" placeholder="Invoice number" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.invoice} onChange={(e)=>setForm({...form, invoice:e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Payment Terms</label>
                      <input type="text" placeholder="e.g., 30 days" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.paymentTerms} onChange={(e)=>setForm({...form, paymentTerms:e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">Status</label>
                    <select className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.status} onChange={(e)=>setForm({...form, status:e.target.value})}>
                      {[Status.Draft, Status.Submitted, Status.Approved, Status.Allocated, Status.Backordered, Status.OnHold, Status.Canceled].map(s=> <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">Comments</label>
                    <textarea placeholder="Additional comments about this purchase order..." className="w-full min-h-[80px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light resize-none" value={form.comments} onChange={(e)=>setForm({...form, comments:e.target.value})} />
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
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={()=>setIsViewOpen(null)}>
              <div className="w-[900px] bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={(e)=>e.stopPropagation()}>
                <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-neutral-dark">Purchase Order Details</h2>
                      {/* PO number and advisory intentionally hidden per request */}
                    </div>
                  </div>
                </div>
                <div className="p-8 space-y-6 flex-1 overflow-y-auto">
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
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Calendar className="h-4 w-4 mr-2 text-primary-medium" /> Ship Date
                    </label>
                    <div className="text-neutral-dark">{isViewOpen.requested_ship_date || '—'}</div>
                  </div>
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
                            : (st === 'backordered')
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-neutral-light/40 text-neutral-dark border-neutral-soft/60'
                        return (
                          <div className="space-y-1">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${statusClass}`}>
                              {isViewOpen.status || '—'} {isViewOpen.is_copack && (<span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">COPACK</span>)}
                            </span>
                            <div className="text-[11px] text-neutral-medium">{statusDescription(isViewOpen.status)}</div>
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
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Calendar className="h-4 w-4 mr-2 text-primary-medium" /> Order Date
                    </label>
                    <div className="text-neutral-dark">{isViewOpen.date || '—'}</div>
                  </div>
                </div>
                {/* Line Items (no IDs) */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-neutral-dark">Line Items</h3>
                  <div className="overflow-x-auto border border-neutral-soft/40 rounded-lg">
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

                {hasViewShortfall && (
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
                    <CopackAllocatedMaterials data={viewCopackRes} />
                    {Array.isArray(viewFormulaItems) && viewFormulaItems.length > 0 && (
                      <CopackBOMMaterials
                        data={viewFormulaItems}
                        poQty={Number(isViewOpen.quantity || 0)}
                        formulaName={viewFormula?.formula_name}
                      />
                    )}
                  </>
                )}

                {/* Shipments */}
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

                {/* Raw Material PRs linked to this PO */}
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

                {(isViewOpen.notes || isViewOpen.comments) && (
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <FileText className="h-4 w-4 mr-2 text-primary-medium" /> Notes & Comments
                    </label>
                    <div className="bg-neutral-light/30 rounded-lg p-4 text-neutral-dark">
                      {isViewOpen.notes && <div><strong>Notes:</strong> {isViewOpen.notes}</div>}
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
        {showManagePackaging && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={()=>setShowManagePackaging(false)}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">Manage Packaging Types</h3>
                <button onClick={()=>setShowManagePackaging(false)} className="p-2"><X className="h-5 w-5"/></button>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <div className="flex gap-2">
                  <input className="flex-1 px-3 py-2 border border-neutral-soft rounded-lg" placeholder="e.g., Bottles, Pouches" value={newPackaging} onChange={(e)=>setNewPackaging(e.target.value)} />
                  <button className="px-4 py-2 rounded-lg bg-primary-dark text-white disabled:opacity-60" disabled={!packagingReady} onClick={async()=>{ if(!packagingReady) return; const name = newPackaging.trim(); if(!name) return; try{ const { error } = await supabase.from('packaging_types').insert({ name }); if (error) return; setPackagingTypes(prev=> Array.from(new Set([...prev, name])).sort()); setNewPackaging('') }catch(e){} }}>Add</button>
                </div>
                <div className="space-y-2">
                  {packagingTypes.map((t)=> (
                    <div key={t} className="flex items-center justify-between border border-neutral-soft rounded-lg px-3 py-2">
                      <div>{t}</div>
                      <div className="flex gap-3 text-xs">
                        <button className={`text-primary-medium ${!packagingReady? 'opacity-50 cursor-not-allowed':''}`} onClick={async()=>{ if(!packagingReady) return; const nn = prompt('Edit type', t) || ''; const name = nn.trim(); if(!name) return; try{ const { error } = await supabase.from('packaging_types').update({ name }).eq('name', t); if (error) return; setPackagingTypes(prev=> prev.map(x=> x===t? name: x).sort()) }catch(e){} }}>Edit</button>
                        <button className={`text-accent-danger ${!packagingReady? 'opacity-50 cursor-not-allowed':''}`} onClick={async()=>{ if(!packagingReady) return; try{ const { error } = await supabase.from('packaging_types').delete().eq('name', t); if (error) return; setPackagingTypes(prev=> prev.filter(x=> x!==t)) }catch(e){} }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button className="px-4 py-2 rounded-lg border" onClick={()=>setShowManagePackaging(false)}>Close</button>
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

