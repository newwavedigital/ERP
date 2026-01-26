import React, { useEffect, useMemo, useState } from 'react'
import { Calculator, RefreshCw, CheckCircle, Truck } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ShippingTab from './SupplyChainProcurement/ShippingTab'
import CopackAllocationSummary from '../components/CopackAllocationSummary'

function formatStatusLabel(raw?: string | null): string {
  const s = String(raw || '').trim()
  if (!s) return '—'
  const lower = s.toLowerCase()
  if (lower === 'move_to_procurement' || lower === 'move to procurement') return 'Move to Procurement'
  if (lower === 'ready_to_schedule' || lower === 'ready to schedule') return 'Ready to Schedule'
  if (lower === 'ready_to_ship' || lower === 'ready to ship') return 'Completed'
  if (lower === 'on_hold' || lower === 'on hold') return 'On Hold'
  return s
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function getStatusBadgeClass(raw?: string | null): string {
  const st = String(raw || '').toLowerCase()
  if (st === 'approved' || st === 'allocated') return 'bg-accent-success/10 text-accent-success border-accent-success/30'
  if (st === 'move_to_procurement' || st === 'move to procurement' || st === 'procurement') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (st === 'on hold' || st === 'on_hold' || st === 'canceled' || st === 'cancelled') return 'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
  return 'bg-neutral-light/40 text-neutral-dark border-neutral-soft/60'
}

const SupplyChainProcurement: React.FC = () => {
  const { user } = useAuth()
  const location = useLocation()
  const formatQty2 = (n: any) => {
    const v = Number(n)
    if (!Number.isFinite(v)) return '0.00'
    return v.toFixed(2)
  }
  const [activeTab, setActiveTab] = useState<'procurement' | 'shipping'>(() => {
    try {
      const sp = new URLSearchParams(String(window?.location?.search || ''))
      return sp.get('tab') === 'shipping' ? 'shipping' : 'procurement'
    } catch {
      return 'procurement'
    }
  })
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [selectedPo, setSelectedPo] = useState<any | null>(null)
  const [calcLoading, setCalcLoading] = useState<boolean>(false)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [poLines, setPoLines] = useState<Array<{ id: string; product_id: string | null; product_name: string; quantity: number }>>([])
  const [rawMaterials, setRawMaterials] = useState<Array<{ material_id: string; material_name: string; uom: string; required_qty: number }>>([])
  const [packagingMaterials, setPackagingMaterials] = useState<Array<{ material_id: string; material_name: string; uom: string; required_qty: number }>>([])
  const [calcBreakdown, setCalcBreakdown] = useState<Array<{ line_id: string; product_name: string; quantity: number; formula: { id: string; formula_name: string; version: number | null } | null; items: Array<{ material_id: string; material_name: string; category: string; uom: string; qty_per_unit: number; required_qty: number }> }>>([])
  const [showCalcBreakdown, setShowCalcBreakdown] = useState<boolean>(false)
  const [missingFormulas, setMissingFormulas] = useState<Array<{ product_name: string; quantity: number }>>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [copackSummary, setCopackSummary] = useState<any | null>(null)

  // RPC response typing (subset)
  type AllocationSummary = { status?: string; total_shortfall?: number; lines?: any[] }

  // Helper to run RPC with skip/error handling
  const runRpc = async (name: string, poId: string) => {
    const { data, error } = await supabase.rpc(name, { p_po_id: poId })
    if (error) return { status: 'error', message: error.message, data: null }
    const status = (data as any)?.status || (data ? 'ok' : 'ok')
    const message = (data as any)?.message || null
    return { status, message, data }
  }

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

  const approveBrandProcurement = async (po: any) => {
    if (!canManageProcurement) return
    const poId = String(po?.id || '')
    if (!poId) return
    setApprovingId(poId)
    try {
      setError(null)
      const { error: upErr } = await supabase
        .from('purchase_orders')
        .update({ status: 'ready_to_schedule' })
        .eq('id', poId)
      if (upErr) throw upErr
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to approve PO')
    } finally {
      setApprovingId(null)
    }
  }

  function formatWordDate(dateStr?: string | null): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  const [roleLoading, setRoleLoading] = useState<boolean>(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [shippingOrders, setShippingOrders] = useState<any[]>([])
  const [shippingLoading, setShippingLoading] = useState<boolean>(false)

  const procurementStatuses = useMemo(
    () => [
      'Move to Procurement',
      'move_to_procurement',
      'procurement',
      'Procurement',
      'Ready to Schedule',
      'ready_to_schedule',
      'scheduled',
      'Scheduled',
      'in_progress',
      'In Progress',
      'qa_hold',
      'QA Hold',
      'ready_to_ship',
      'Ready to Ship',
      'ready to ship',
      'allocated',
      'Allocated',
      'partial',
      'Partial',
      'partially_shipped',
      'Partially Shipped',
      'shipped',
      'Shipped',
      'submitted',
      'Submitted',
      'completed',
      'Completed',
    ],
    []
  )

  const canManageProcurement = useMemo(() => {
    const r = String(currentUserRole || '').toLowerCase()
    return r === 'admin' || r === 'procurement' || r === 'finance' || r === 'supply_chain'
  }, [currentUserRole])

  const canViewProcurement = useMemo(() => {
    const r = String(currentUserRole || '').toLowerCase()
    return canManageProcurement || r === 'supply_chain_procurement' || r === 'sales_representative' || r === 'warehouse'
  }, [canManageProcurement, currentUserRole])

  const loadUserRole = async () => {
    if (!user?.id) {
      setCurrentUserRole(null)
      return
    }
    setRoleLoading(true)
    try {
      const { data, error: profErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profErr) throw profErr
      setCurrentUserRole((data as any)?.role ? String((data as any).role) : null)
    } catch (e: any) {
      setCurrentUserRole(null)
      setError(e?.message || 'Failed to load user role')
    } finally {
      setRoleLoading(false)
    }
  }

  const canShipWarehouse = useMemo(() => {
    const r = String(currentUserRole || '').toLowerCase()
    return r === 'warehouse' || r === 'admin'
  }, [currentUserRole])
  const isWarehouseRole = useMemo(() => String(currentUserRole || '').toLowerCase() === 'warehouse', [currentUserRole])

  const markReadyToShip = async (poId: string) => {
    const { error } = await supabase.rpc('fn_mark_ready_to_ship', { p_po_id: poId })
    if (error) throw error
  }

  const shipPO = async (poId: string) => {
    const { error } = await supabase.rpc('fn_ship_po', { p_po_id: poId })
    if (error) throw error
  }

  const shipPartialPO = async (poId: string) => {
    const { error } = await supabase.rpc('fn_ship_po_partial', { p_po_id: poId })
    if (error) throw error
  }

  const handleShippingAction = async (action: 'ready_to_ship' | 'ship' | 'partial_ship', poId: string) => {
    try {
      setError(null)
      if (action === 'ready_to_ship') await markReadyToShip(poId)
      if (action === 'ship') await shipPO(poId)
      if (action === 'partial_ship') await shipPartialPO(poId)
      await loadShippingOrders()
      await load()
    } catch (e: any) {
      console.error('Shipping action failed:', e)
      setError(e?.message || 'Shipping action failed')
    }
  }

  const load = async () => {
    if (!canViewProcurement) {
      setOrders([])
      setSelectedPo(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .in('status', procurementStatuses)
        .order('created_at', { ascending: false })

      if (qErr) throw qErr
      setOrders((data as any[]) || [])
      const currentSelectedId = selectedPo?.id != null ? String(selectedPo.id) : null
      if (currentSelectedId) {
        const next = ((data as any[]) || []).find((r: any) => String(r.id) === currentSelectedId) || null
        setSelectedPo(next)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load procurement orders')
      setOrders([])
      setSelectedPo(null)
    } finally {
      setLoading(false)
    }
  }

  const loadShippingOrders = async () => {
    if (!canViewProcurement) {
      setShippingOrders([])
      return
    }
    setShippingLoading(true)
    try {
      const { data, error: qErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (qErr) throw qErr
      const raw = Array.isArray(data) ? data : []
      const allowed = new Set([
        'completed',
        'ready_to_ship',
        'ready to ship',
        'allocated',
        'partial',
        'partially_shipped',
        'shipped',
        'submitted',
      ])
      const filtered = raw.filter((po: any) => allowed.has(String(po?.status || '').toLowerCase().trim()))
      setShippingOrders(filtered)
    } catch (e: any) {
      console.error('Failed to load shipping orders:', e)
      setShippingOrders([])
    } finally {
      setShippingLoading(false)
    }
  }

  const loadCalculator = async (po: any) => {
    if (!canViewProcurement) return
    const poId = String(po?.id || '')
    if (!poId) return

    setCalcLoading(true)
    setCalcError(null)
    setPoLines([])
    setRawMaterials([])
    setPackagingMaterials([])
    setCalcBreakdown([])
    setShowCalcBreakdown(false)
    setMissingFormulas([])

    try {
      const { data: linesData, error: linesErr } = await supabase
        .from('purchase_order_lines')
        .select('id, product_name, quantity')
        .eq('purchase_order_id', poId)
        .order('created_at', { ascending: true })
      if (linesErr) throw linesErr

      const baseLines = ((linesData && linesData.length > 0)
        ? linesData
        : [{ id: poId, product_name: po?.product_name || '', quantity: po?.quantity || 0 }]
      ).map((r: any) => ({
        id: String(r.id),
        product_id: null as string | null,
        product_name: String(r.product_name || ''),
        quantity: Number(r.quantity || 0),
      }))

      // Resolve product_id by product_name (purchase_order_lines doesn't store product_id)
      const uniqueNames = Array.from(new Set(baseLines.map((l) => l.product_name).map((s) => String(s || '').trim()).filter(Boolean)))
      const idByName = new Map<string, string>()

      // Exact match first (fast + accurate)
      if (uniqueNames.length > 0) {
        try {
          const { data: exactRows } = await supabase
            .from('products')
            .select('id, product_name')
            .in('product_name', uniqueNames)
          ;(exactRows || []).forEach((p: any) => {
            const nm = String(p?.product_name || '').trim()
            if (nm && p?.id) idByName.set(nm, String(p.id))
          })
        } catch {}
      }

      // Fallback: loose match for names not found via exact match
      const missingNames = uniqueNames.filter((nm) => !idByName.get(nm))
      for (const nm of missingNames) {
        try {
          const { data: prodRow } = await supabase
            .from('products')
            .select('id, product_name')
            .ilike('product_name', `%${nm}%`)
            .maybeSingle()
          if (prodRow?.id) idByName.set(nm, String(prodRow.id))
        } catch {}
      }

      const lines = baseLines.map((l) => ({
        ...l,
        product_id: idByName.get(String(l.product_name || '').trim()) || null,
      }))
      setPoLines(lines)

      const productIds = Array.from(new Set(lines.map((l) => l.product_id).filter(Boolean))) as string[]

      // Resolve formulas for the products in this PO
      const formulasByProduct = new Map<string, any>()
      if (productIds.length > 0) {
        const { data: prodRows, error: pErr } = await supabase
          .from('products')
          .select('id, formula_id, formula_name')
          .in('id', productIds)
        if (pErr) throw pErr

        const formulaIdByProductId = new Map<string, string>()
        const formulaNameByProductId = new Map<string, string>()
        ;(prodRows || []).forEach((p: any) => {
          const pid = p?.id != null ? String(p.id) : ''
          if (!pid) return
          if (p?.formula_id) formulaIdByProductId.set(pid, String(p.formula_id))
          if (p?.formula_name) formulaNameByProductId.set(pid, String(p.formula_name))
        })

        const formulaIdsFromProducts = Array.from(new Set(Array.from(formulaIdByProductId.values()).filter(Boolean)))
        if (formulaIdsFromProducts.length > 0) {
          const { data: formulas, error: fErr } = await supabase
            .from('formulas')
            .select('id, formula_name, version')
            .in('id', formulaIdsFromProducts)
          if (fErr) throw fErr
          ;(formulas || []).forEach((f: any) => {
            const fid = f?.id != null ? String(f.id) : ''
            if (!fid) return
            ;(formulaIdByProductId as any).forEach((v: string, k: string) => {
              if (String(v) === fid) formulasByProduct.set(String(k), f)
            })
          })
        }

        // Fallback: if product has no formula_id, try to find latest formula by formula_name (matching product name)
        const missingProductIds = productIds.filter((pid) => !formulaIdByProductId.get(pid))
        if (missingProductIds.length > 0) {
          for (const pid of missingProductIds) {
            const ln = lines.find((l) => String(l.product_id || '') === String(pid))
            const baseName = String(formulaNameByProductId.get(pid) || ln?.product_name || '').trim()
            if (!baseName) continue
            try {
              const { data: fRow } = await supabase
                .from('formulas')
                .select('id, formula_name, version')
                .ilike('formula_name', `%${baseName}%`)
                .order('version', { ascending: false })
                .limit(1)
                .maybeSingle()
              if (fRow?.id) formulasByProduct.set(String(pid), fRow)
            } catch {}
          }
        }
      }

      const formulaIds = Array.from(new Set(Array.from(formulasByProduct.values()).map((f: any) => String(f.id)).filter(Boolean)))

      const itemsByFormula = new Map<string, Array<{ material_id: string; qty_per_unit: number; uom: string; material_name: string; category: string }>>()
      if (formulaIds.length > 0) {
        const { data: items, error: fiErr } = await supabase
          .from('formula_items')
          .select(`formula_id, material_id, qty_per_unit, uom, inventory_materials:inventory_materials!formula_items_material_id_fkey ( id, product_name, category )`)
          .in('formula_id', formulaIds)
        if (fiErr) throw fiErr
        ;(items || []).forEach((it: any) => {
          const fid = it.formula_id != null ? String(it.formula_id) : ''
          const mid = it.material_id != null ? String(it.material_id) : ''
          if (!fid || !mid) return
          const mat = (it.inventory_materials || {}) as any
          const arr = itemsByFormula.get(fid) || []
          arr.push({
            material_id: mid,
            qty_per_unit: Number(it.qty_per_unit || 0),
            uom: String(it.uom || ''),
            material_name: String(mat.product_name || ''),
            category: String(mat.category || ''),
          })
          itemsByFormula.set(fid, arr)
        })
      }

      const rawAgg = new Map<string, { material_id: string; material_name: string; uom: string; required_qty: number }>()
      const packAgg = new Map<string, { material_id: string; material_name: string; uom: string; required_qty: number }>()
      const missing: Array<{ product_name: string; quantity: number }> = []
      const breakdown: Array<{ line_id: string; product_name: string; quantity: number; formula: { id: string; formula_name: string; version: number | null } | null; items: Array<{ material_id: string; material_name: string; category: string; uom: string; qty_per_unit: number; required_qty: number }> }> = []

      lines.forEach((ln) => {
        const pid = ln.product_id ? String(ln.product_id) : ''
        const formula = pid ? formulasByProduct.get(pid) : null
        const fid = formula?.id != null ? String(formula.id) : ''
        const items = fid ? itemsByFormula.get(fid) || [] : []

        if (!pid || !fid || items.length === 0) {
          missing.push({ product_name: ln.product_name || '—', quantity: ln.quantity })
          breakdown.push({
            line_id: String(ln.id),
            product_name: ln.product_name || '—',
            quantity: Number(ln.quantity || 0),
            formula: fid ? { id: fid, formula_name: String(formula?.formula_name || ''), version: (formula?.version ?? null) as any } : null,
            items: [],
          })
          return
        }

        const lnItems: Array<{ material_id: string; material_name: string; category: string; uom: string; qty_per_unit: number; required_qty: number }> = []

        items.forEach((it) => {
          const required = Number(ln.quantity || 0) * Number(it.qty_per_unit || 0)
          const isPackaging = String(it.category || '').toLowerCase() === 'packaging'
          const target = isPackaging ? packAgg : rawAgg
          const prev = target.get(it.material_id)

          lnItems.push({
            material_id: it.material_id,
            material_name: it.material_name || '—',
            category: it.category || '',
            uom: it.uom || '',
            qty_per_unit: Number(it.qty_per_unit || 0),
            required_qty: required,
          })

          if (!prev) {
            target.set(it.material_id, {
              material_id: it.material_id,
              material_name: it.material_name || '—',
              uom: it.uom || '',
              required_qty: required,
            })
          } else {
            target.set(it.material_id, {
              ...prev,
              required_qty: Number(prev.required_qty || 0) + required,
            })
          }
        })

        breakdown.push({
          line_id: String(ln.id),
          product_name: ln.product_name || '—',
          quantity: Number(ln.quantity || 0),
          formula: { id: fid, formula_name: String(formula?.formula_name || ''), version: (formula?.version ?? null) as any },
          items: lnItems,
        })
      })

      const sortByName = (a: any, b: any) => String(a.material_name || '').localeCompare(String(b.material_name || ''))
      setRawMaterials(Array.from(rawAgg.values()).sort(sortByName))
      setPackagingMaterials(Array.from(packAgg.values()).sort(sortByName))
      setMissingFormulas(missing)
      setCalcBreakdown(breakdown)
    } catch (e: any) {
      setCalcError(e?.message || 'Failed to calculate materials')
    } finally {
      setCalcLoading(false)
    }
  }

  const approveCopackAllocation = async (po: any) => {
    if (!canManageProcurement) return
    const poId = String(po?.id || '')
    if (!poId) return

    // This button/action is ONLY for Copack POs
    if (!po?.is_copack) return

    setApprovingId(poId)
    try {
      setError(null)

      // Load the most recent PO to decide the flow
      const { data: poRow, error: fetchErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .maybeSingle()
      if (fetchErr) throw fetchErr
      const poRec: any = poRow || po

      // COPACK MODE — run same sequence used in PurchaseOrders.tsx
      const seq = [
        'fn_copack_material_check',
        'allocate_copack_po_operations',
        'allocate_copack_po_ops_dual_pr',
      ]

      let finalSummary: any = null
      for (const name of seq) {
        const res = await runRpc(name, poId)
        if (res.status === 'error') {
          setError(res.message || 'RPC Error')
          break
        }
        if (name === 'allocate_copack_po_operations' && res.data) {
          finalSummary = res.data
        }
      }

      // Move PO to Ready to Schedule after successful allocation (batch creation happens later in Production Schedule)
      try {
        const sumStatus = String((finalSummary as any)?.status || '').toLowerCase().trim()
        if (!sumStatus || sumStatus === 'allocated' || sumStatus === 'ok') {
          await supabase.from('purchase_orders').update({ status: 'ready_to_schedule' }).eq('id', poId)
        }
      } catch {}

      // ─── Bundle/KIT packaging rule: block batch creation when shortfall exists ───
      try {
        const sum = (finalSummary || {}) as AllocationSummary
        const isBundle = ['kit', 'bundle'].includes(String(poRec?.packaging_type || '').toLowerCase())
        const notAllocated = String(sum.status || '').toLowerCase() !== 'allocated'
        const hasShort = Number(sum.total_shortfall || 0) > 0
        if (isBundle && (notAllocated || hasShort)) {
          await load()
          return
        }
      } catch {}

      await load()
      const normalized = normalizeCopackSummary(finalSummary || {}, poId)
      setCopackSummary(normalized)

      // reset calculator panels
      setPoLines([])
      setRawMaterials([])
      setPackagingMaterials([])
      setMissingFormulas([])
    } catch (e: any) {
      setError(e?.message || 'Failed to approve PO')
    } finally {
      setApprovingId(null)
    }
  }

  useEffect(() => {
    loadUserRole()
  }, [user?.id])

  useEffect(() => {
    if (!roleLoading) {
      load()
      loadShippingOrders()
    }
    // Intentionally no realtime subscription added here to avoid changing existing backend behavior.
  }, [roleLoading])

  useEffect(() => {
    try {
      const sp = new URLSearchParams(String(location.search || ''))
      const tab = sp.get('tab')
      if (tab === 'shipping') setActiveTab('shipping')
      if (tab === 'procurement') setActiveTab('procurement')
    } catch {}
  }, [location.search])

  useEffect(() => {
    if (isWarehouseRole) setActiveTab('shipping')
  }, [isWarehouseRole])

  useEffect(() => {
    if (roleLoading) return
    if (activeTab === 'shipping') {
      loadShippingOrders()
    } else {
      load()
    }
  }, [activeTab, roleLoading])

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-2 sm:p-4 lg:p-6">
        {copackSummary && (
          <CopackAllocationSummary summary={copackSummary} onClose={() => setCopackSummary(null)} />
        )}
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-dark mb-1">Supply Chain & Procurement</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { load(); loadShippingOrders(); }}
              disabled={loading || roleLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-neutral-soft bg-white hover:bg-neutral-light/40 text-neutral-dark transition-all disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 mb-3 lg:mb-4 overflow-hidden">
          <div className="flex border-b border-neutral-soft/20">
            {!isWarehouseRole && (
              <button
                onClick={() => setActiveTab('procurement')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'procurement'
                    ? 'bg-primary-light/10 text-primary-dark border-b-2 border-primary-medium'
                    : 'text-neutral-medium hover:text-neutral-dark hover:bg-neutral-light/20'
                }`}
              >
                <Calculator className="h-4 w-4" />
                Procurement
              </button>
            )}
            <button
              onClick={() => setActiveTab('shipping')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'shipping'
                  ? 'bg-primary-light/10 text-primary-dark border-b-2 border-primary-medium'
                  : 'text-neutral-medium hover:text-neutral-dark hover:bg-neutral-light/20'
              }`}
            >
              <Truck className="h-4 w-4" />
              Shipping
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'procurement' && !isWarehouseRole && (
          <>
            {error && (
              <div className="bg-white rounded-xl shadow-md border border-red-200 p-3 sm:p-4 mb-3">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {!selectedPo && (
              <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-light/20 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-primary-medium" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-dark">Materials Calculator</div>
                    <div className="text-sm text-neutral-medium">
                      Select a PO from the Procurement Queue to calculate raw materials and packaging requirements.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!canViewProcurement && !roleLoading && (
              <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
                <div className="text-sm text-neutral-medium">
                  You can view moved POs here, but only Finance / Procurement / Supply Chain team members can access this page.
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 overflow-hidden">
              <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 border-b border-neutral-soft/40 bg-neutral-light/30 flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-dark">Procurement Queue</div>
                <div className="text-xs text-neutral-medium">{orders.length} PO(s)</div>
              </div>

              <div className="p-3 sm:p-4 lg:p-6">
                {loading ? (
                  <div className="text-sm text-neutral-medium">Loading…</div>
                ) : orders.length === 0 ? (
                  <div className="text-sm text-neutral-medium">No purchase orders are currently marked "Move to Procurement".</div>
                ) : (
                  <div className="space-y-2">
                    {orders.map((po: any) => {
                      const id = String(po.id ?? '')
                      const created = po.created_at ? formatWordDate(po.created_at) : '—'
                      const poNumber = String(po.po_number ?? po.number ?? id.slice(0, 8))
                      const isSelected = selectedPo?.id != null && String(selectedPo.id) === id
                      const isCopack = !!po.is_copack
                      return (
                        <div
                          key={id}
                          role={canViewProcurement ? 'button' : undefined}
                          tabIndex={canViewProcurement ? 0 : undefined}
                          onClick={() => {
                            if (!canViewProcurement) return
                            setSelectedPo(po)
                            loadCalculator(po)
                          }}
                          className={`w-full text-left rounded-xl border border-neutral-soft/40 transition-colors p-3 sm:p-4 ${isSelected ? 'bg-primary-light/10 border-primary-light' : 'bg-white'} ${canViewProcurement ? 'hover:bg-neutral-light/20 cursor-pointer' : ''}`}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex flex-col gap-1">
                                <div className="text-sm font-semibold text-neutral-dark">
                                  PO #{poNumber}
                                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isCopack ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-neutral-light/60 text-neutral-dark border-neutral-soft/60'}`}>
                                    {isCopack ? 'COPACK' : 'BRAND'}
                                  </span>
                                </div>
                                <div className="text-xs text-neutral-medium">Customer: {String(po.customer_name || '—')}</div>
                              </div>
                              <div className="flex flex-col items-start sm:items-end gap-1">
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${getStatusBadgeClass(po.status)}`}>{formatStatusLabel(po.status)}</span>
                                <span className="text-xs text-neutral-medium">{created}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t border-neutral-soft/40">
                              <div className="text-xs text-neutral-medium">
                                Product: {String(po.product_name || '—')} • Qty: {Number(po.quantity || 0)}
                              </div>
                              {canManageProcurement ? (
                                (() => {
                                  const st = String(po.status || '').toLowerCase()
                                  const alreadyApproved = st === 'ready_to_schedule' || st === 'ready to schedule'
                                  const isProcurementStage = st === 'move_to_procurement' || st === 'move to procurement' || st === 'procurement'
                                  if (alreadyApproved) {
                                    return (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-success/10 text-accent-success border border-accent-success/30">
                                        <CheckCircle className="h-3.5 w-3.5" /> Approved
                                      </span>
                                    )
                                  }
                                  if (!isProcurementStage) return null
                                  if (isCopack) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          approveCopackAllocation(po)
                                        }}
                                        disabled={approvingId === id}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        {approvingId === id ? 'Approving...' : 'Approve Copack Allocation'}
                                      </button>
                                    )
                                  }
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        approveBrandProcurement(po)
                                      }}
                                      disabled={approvingId === id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      {approvingId === id ? 'Approving...' : 'Approve'}
                                    </button>
                                  )
                                })()
                              ) : (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Approval restricted (Admin / Procurement (Finance))
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {selectedPo && canViewProcurement && (
              <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 overflow-hidden mt-3 lg:mt-4">
                <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 border-b border-neutral-soft/40 bg-neutral-light/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary-medium" />
                    <div className="text-sm font-semibold text-neutral-dark">Materials Calculator</div>
                  </div>
                  <div className="text-xs text-neutral-medium">PO {String(selectedPo.po_number ?? selectedPo.number ?? String(selectedPo.id).slice(0, 8))}</div>
                </div>

                <div className="p-3 sm:p-4 lg:p-6">
                  {calcLoading ? (
                    <div className="text-sm text-neutral-medium">Calculating…</div>
                  ) : calcError ? (
                    <div className="text-sm text-red-700">{calcError}</div>
                  ) : (
                    <div className="space-y-4">
                      {poLines.length > 0 && (
                        <div className="rounded-xl border border-neutral-soft/40 bg-white overflow-hidden">
                          <div className="px-3 sm:px-4 py-2 border-b border-neutral-soft/40 bg-neutral-light/20 text-xs font-semibold text-neutral-dark">PO Line Items</div>
                          <div className="p-3 sm:p-4">
                            <div className="space-y-2">
                              {poLines.map((ln) => (
                                <div key={ln.id} className="flex items-center justify-between gap-3">
                                  <div className="text-sm text-neutral-dark truncate">{ln.product_name || '—'}</div>
                                  <div className="text-sm font-semibold text-neutral-dark">{ln.quantity}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {missingFormulas.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:p-4">
                          <div className="text-sm font-semibold text-amber-800 mb-2">Missing Formula</div>
                          <div className="space-y-1">
                            {missingFormulas.map((m, i) => (
                              <div key={i} className="text-xs text-amber-800">{m.product_name} (qty {m.quantity})</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {calcBreakdown.length > 0 && (
                        <div className="rounded-xl border border-neutral-soft/40 bg-white overflow-hidden">
                          <div className="px-3 sm:px-4 py-2 border-b border-neutral-soft/40 bg-neutral-light/20 flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold text-neutral-dark">Calculation Details</div>
                            <button
                              type="button"
                              onClick={() => setShowCalcBreakdown((v) => !v)}
                              className="text-xs font-semibold text-primary-medium hover:text-primary-dark"
                            >
                              {showCalcBreakdown ? 'Hide' : 'Show'}
                            </button>
                          </div>

                          {showCalcBreakdown && (
                            <div className="p-3 sm:p-4 space-y-3">
                              {calcBreakdown.map((b) => (
                                <div key={b.line_id} className="rounded-xl border border-neutral-soft/40 bg-white overflow-hidden">
                                  <div className="px-3 sm:px-4 py-2 border-b border-neutral-soft/40 bg-neutral-light/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-neutral-dark truncate">{b.product_name || '—'}</div>
                                      <div className="text-xs text-neutral-medium">
                                        Formula: {b.formula ? `${b.formula.formula_name || '—'}${b.formula.version != null ? ` (v${b.formula.version})` : ''}` : '—'}
                                      </div>
                                    </div>
                                    <div className="text-xs text-neutral-dark font-semibold">Ordered Units: {Number(b.quantity || 0)}</div>
                                  </div>

                                  {b.items.length === 0 ? (
                                    <div className="p-3 sm:p-4 text-sm text-neutral-medium">No formula items found for this line.</div>
                                  ) : (
                                    <div className="p-3 sm:p-4 overflow-x-auto">
                                      <table className="min-w-full text-sm">
                                        <thead className="text-neutral-medium">
                                          <tr>
                                            <th className="text-left py-2 pr-4">Material</th>
                                            <th className="text-left py-2 pr-4">Category</th>
                                            <th className="text-right py-2 pr-4">Qty / Unit</th>
                                            <th className="text-right py-2 pr-4">Ordered Units</th>
                                            <th className="text-right py-2">Required</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {b.items.map((it) => (
                                            <tr key={`${b.line_id}-${it.material_id}`} className="border-t border-neutral-soft/40">
                                              <td className="py-2 pr-4 text-neutral-dark">{it.material_name || '—'}</td>
                                              <td className="py-2 pr-4 text-neutral-medium">{it.category || '—'}</td>
                                              <td className="py-2 pr-4 text-right text-neutral-dark">
                                                {formatQty2(it.qty_per_unit)}{it.uom ? ` ${it.uom}` : ''}
                                              </td>
                                              <td className="py-2 pr-4 text-right text-neutral-dark">{Number(b.quantity || 0)}</td>
                                              <td className="py-2 text-right font-semibold text-neutral-dark">
                                                {formatQty2(it.required_qty)}{it.uom ? ` ${it.uom}` : ''}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      <div className="mt-2 text-xs text-neutral-medium">
                                        Required = Ordered Units × Qty / Unit
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                        <div className="rounded-xl border border-neutral-soft/40 bg-white overflow-hidden">
                          <div className="px-3 sm:px-4 py-2 border-b border-neutral-soft/40 bg-neutral-light/20 text-xs font-semibold text-neutral-dark">Raw Materials Required</div>
                          <div className="p-3 sm:p-4">
                            {rawMaterials.length === 0 ? (
                              <div className="text-sm text-neutral-medium">No raw materials calculated.</div>
                            ) : (
                              <div className="space-y-2">
                                {rawMaterials.map((m) => (
                                  <div key={m.material_id} className="flex items-center justify-between gap-3">
                                    <div className="text-sm text-neutral-dark truncate">{m.material_name}</div>
                                    <div className="text-sm font-semibold text-neutral-dark">
                                      {formatQty2(m.required_qty)}{m.uom ? ` ${m.uom}` : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-neutral-soft/40 bg-white overflow-hidden">
                          <div className="px-3 sm:px-4 py-2 border-b border-neutral-soft/40 bg-neutral-light/20 text-xs font-semibold text-neutral-dark">Packaging Required</div>
                          <div className="p-3 sm:p-4">
                            {packagingMaterials.length === 0 ? (
                              <div className="text-sm text-neutral-medium">No packaging calculated.</div>
                            ) : (
                              <div className="space-y-2">
                                {packagingMaterials.map((m) => (
                                  <div key={m.material_id} className="flex items-center justify-between gap-3">
                                    <div className="text-sm text-neutral-dark truncate">{m.material_name}</div>
                                    <div className="text-sm font-semibold text-neutral-dark">
                                      {formatQty2(m.required_qty)}{m.uom ? ` ${m.uom}` : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'shipping' && (
          <ShippingTab 
            shippingOrders={shippingOrders}
            loading={shippingLoading}
            canViewProcurement={canViewProcurement}
            formatStatusLabel={formatStatusLabel}
            getStatusBadgeClass={getStatusBadgeClass}
            canShipWarehouse={canShipWarehouse}
            onReadyToShip={(poId: string) => handleShippingAction('ready_to_ship', poId)}
            onPartialShip={(poId: string) => handleShippingAction('partial_ship', poId)}
            onShipOrder={(poId: string) => handleShippingAction('ship', poId)}
          />
        )}
      </div>
    </div>
  )
}

export default SupplyChainProcurement
