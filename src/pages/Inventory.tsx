import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Package, Box, Factory, LineChart, Inbox, Landmark, X, Tag, User, Scale, DollarSign, ClipboardList, Eye, Edit, Trash2, CheckCircle2, Clock, Upload, List, Grid3X3, FileText, RefreshCw, Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Map filename extension to themed badge styles
const getFileMeta = (name?: string) => {
  const raw = String(name || '').toLowerCase()
  const ext = raw.includes('.') ? raw.split('.').pop() || '' : ''
  let cls = 'bg-neutral-100 text-neutral-700'
  let label = (ext || 'file').toUpperCase()
  if (ext === 'pdf') { cls = 'bg-red-100 text-red-700'; label = 'PDF' }
  else if (ext === 'doc' || ext === 'docx') { cls = 'bg-blue-100 text-blue-700'; label = 'DOC' }
  else if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') { cls = 'bg-emerald-100 text-emerald-700'; label = 'XLS' }
  else if (ext === 'ppt' || ext === 'pptx') { cls = 'bg-orange-100 text-orange-700'; label = 'PPT' }
  else if (ext === 'txt' || ext === 'rtf') { cls = 'bg-neutral-100 text-neutral-700'; label = ext.toUpperCase() }
  return { cls, label }
}

// Derive a clean filename for display from a stored URL/safe filename
const prettyFileName = (src?: string) => {
  if (!src) return ''
  try {
    const last = decodeURIComponent(new URL(src).pathname.split('/').pop() || '')
    // remove leading timestamp or numeric prefix like 1699999999999- or 1699999_
    return last.replace(/^\d{6,}[-_]/, '')
  } catch {
    // fallback: just strip numeric prefix if present in raw string
    const base = String(src).split('/').pop() || String(src)
    return base.replace(/^\d{6,}[-_]/, '')
  }
}

interface Supplier {
  id: string
  name: string
}

interface RawMaterial {
  id: string
  product_name: string
  category: string
  supplier_id?: string | null
  supplier_name?: string | null
  unit_of_measure?: string | null
  unit_weight?: string | null
  cost_per_unit?: string | null
  total_available?: number | null
  created_at?: string | null
  material_file_urls?: string[]
  reserved_qty?: number | null
  reorder_point?: number | null
  reorder_to_level?: number | null
  moq?: number | null
  eoq?: number | null
  replenishmentStatus?: {
    hasPending: boolean
    qty: number
    reqId: string | null
    reqStatus: string | null
    reqCreatedAt?: string | null
  } | null
}

const Inventory: React.FC = () => {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState<boolean>(false)

  const canManageInventory = useMemo(() => {
    const r = String(currentUserRole || '').toLowerCase()
    return r === 'admin' || r === 'warehouse' || r === 'procurement' || r === 'finance' || r === 'supply_chain'
  }, [currentUserRole])

  const canViewInventory = useMemo(() => {
    const r = String(currentUserRole || '').toLowerCase()
    return canManageInventory || r === 'supply_chain_procurement' || r === 'sales_representative'
  }, [canManageInventory, currentUserRole])

  const [mainTab, setMainTab] = useState<'raw' | 'packaging' | 'finished'>('raw')
  const [subTab, setSubTab] = useState<'list' | 'forecast'>('list')
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isSupplierOpen, setIsSupplierOpen] = useState(false)
  const [isUomOpen, setIsUomOpen] = useState(false)
  const [isAddRawOpen, setIsAddRawOpen] = useState(false)
  const [isSavingRaw, setIsSavingRaw] = useState(false)
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [materialsLoading, setMaterialsLoading] = useState<boolean>(true)
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false)
  const [viewData, setViewData] = useState<RawMaterial | null>(null)
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const [editForm, setEditForm] = useState({
    product_name: '',
    category: '',
    supplier_id: '',
    supplier_name: '',
    unit_of_measure: '',
    unit_weight: '',
    cost_per_unit: '',
    total_available: '',
    lot_number: '',
    manufacture_date: '',
    expiry_date: '',
    reorder_point: '',
    reorder_to_level: '',
    moq: '',
    eoq: '',
    material_file_urls: [] as string[],
  })
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false)
  const [deleteTarget, setDeleteTarget] = useState<RawMaterial | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  // Finished goods state
  const [fg, setFg] = useState<Array<{ id: string; product_name: string; available_qty: number; reserved_qty: number; location?: string | null; reorder_point?: number | null; updated_at?: string | null; qa_hold?: boolean | null; qa_hold_reason?: string | null; segregated_qty?: number | null; segregated_location?: string | null; disposition?: string | null; manufacture_date?: string | null; expiry_date?: string | null }>>([])
  const [fgLoading, setFgLoading] = useState<boolean>(false)
  const [fgError, setFgError] = useState<string | null>(null)
  const [fgLastSynced] = useState<string>('')
  const [highlightedRows, setHighlightedRows] = useState<Record<string, number>>({})
  const [recentlyAllocated, setRecentlyAllocated] = useState<Record<string, boolean>>({})
  const [fgBanner, setFgBanner] = useState<{ show: boolean; count: number; poNumber?: string | null }>({ show: false, count: 0, poNumber: null })
  // FG purchase history modal state
  const [fgHistOpen, setFgHistOpen] = useState<boolean>(false)
  const [fgHistLoading, setFgHistLoading] = useState<boolean>(false)
  const [fgHistError, setFgHistError] = useState<string | null>(null)
  const [fgHistProduct, setFgHistProduct] = useState<string | null>(null)
  const [fgHistRows, setFgHistRows] = useState<Array<{ id: string; created_at: string; customer_name: string | null; status: string; quantity: number | null; case_qty: number | null; allocated_qty?: number | null; backorder_qty?: number | null }>>([])
  // Reservation history modal state
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false)
  const [historyData, setHistoryData] = useState<Array<{ po_id: string; line_id: string; qty: number; created_at: string; line_name?: string | null }>>([])
  const [historyLoading, setHistoryLoading] = useState<boolean>(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null)
  const [openReplFor, setOpenReplFor] = useState<string | null>(null)
  const [replModalFor, setReplModalFor] = useState<RawMaterial | null>(null)
  const [replLoading, setReplLoading] = useState<boolean>(false)
  const [prModalFor, setPrModalFor] = useState<RawMaterial | null>(null)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [replRpcData, setReplRpcData] = useState<any | null>(null)
  const [rawForm, setRawForm] = useState({
    name: '',
    category: '',
    newCategory: '',
    supplier: '',
    supplierId: '',
    uom: 'Kilograms (kg)',
    unitWeight: '',
    costPerUnit: '',
    totalAvailable: '',
    lotNumber: '',
    manufactureDate: '',
    expiryDate: '',
    reorderPoint: '',
    reorderToLevel: '',
    moq: '',
    eoq: '',
    docFiles: [] as File[]
  })
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [editDocFiles, setEditDocFiles] = useState<File[]>([])
  const [docsLayout, setDocsLayout] = useState<'list' | 'grid'>('list')
  const [editDocDragOver, setEditDocDragOver] = useState(false)
  const [addDocDragOver, setAddDocDragOver] = useState(false)
  const rawCategories = ['Ingredient', 'Packaging']
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState<boolean>(true)
  const [suppliersError, setSuppliersError] = useState<string | null>(null)
  const uoms = ['Kilograms (kg)', 'Grams (g)', 'Pounds (lbs)', 'Ounces (oz)', 'Pieces', 'Bottles', 'Boxes', 'Liters (L)']
  const categoryRef = useRef<HTMLDivElement>(null)
  const supplierRef = useRef<HTMLDivElement>(null)
  const uomRef = useRef<HTMLDivElement>(null)
  const addDocInputRef = useRef<HTMLInputElement>(null)
  const editDocInputRef = useRef<HTMLInputElement>(null)

  // Load user role
  const loadUserRole = async () => {
    if (!user?.id) {
      setCurrentUserRole(null)
      return
    }
    setRoleLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (error) throw error
      setCurrentUserRole(data?.role ? String(data.role) : null)
    } catch (e) {
      setCurrentUserRole(null)
    } finally {
      setRoleLoading(false)
    }
  }

  useEffect(() => {
    loadUserRole()
  }, [user?.id])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) setIsCategoryOpen(false)
      if (supplierRef.current && !supplierRef.current.contains(event.target as Node)) setIsSupplierOpen(false)
      if (uomRef.current && !uomRef.current.contains(event.target as Node)) setIsUomOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load reservation history when modal opens
  useEffect(() => {
    const loadHistory = async () => {
      if (!isHistoryOpen || !selectedMaterial) return
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const { data, error } = await supabase
          .from('inventory_reservations')
          .select('po_id, line_id, qty, created_at')
          .eq('product_name', selectedMaterial)
          .order('created_at', { ascending: false })
        if (error) {
          setHistoryError('Cannot load reservation history')
          setHistoryData([])
        } else {
          const raw = (data as any[]) || []
          // fetch production line names for line_id values
          const ids = Array.from(new Set(raw.map((r: any) => r.line_id).filter((v: any) => v != null)))
          let lineMap: Record<string, string> = {}
          if (ids.length) {
            try {
              const { data: lines } = await supabase
                .from('production_lines')
                .select('id, line_name')
                .in('id', ids)
              lineMap = Object.fromEntries((lines || []).map((l: any) => [String(l.id), String(l.line_name || '')]))
            } catch {}
          }
          const withNames = raw.map((r: any) => ({ ...r, line_name: lineMap[String(r.line_id)] || null }))
          setHistoryData(withNames)
        }
      } finally {
        setHistoryLoading(false)
      }
    }
    loadHistory()
  }, [isHistoryOpen, selectedMaterial])

  // Load finished goods with safe ordering and robust error handling
  const loadFinished = React.useCallback(async () => {
    if (!supabase) return
    setFgLoading(true)
    setFgError(null)
    try {
      const { data, error } = await supabase
        .from('finished_goods')
        .select('id, product_name, available_qty, reserved_qty, location, updated_at, qa_hold, qa_hold_reason, segregated_qty, segregated_location, disposition, manufacture_date, expiry_date, lot_number')
        .order('product_name', { ascending: true, nullsFirst: true })

      if (error) {
        setFg([])
        setFgError('Cannot load finished goods')
        setFgLoading(false)
        return
      }

      const items = (data ?? []).map((r: any) => ({
        id: String(r.id),
        product_name: String(r.product_name ?? ''),
        available_qty: Number(r.available_qty ?? 0),
        reserved_qty: Number(r.reserved_qty ?? 0),
        location: r.location ?? null,
        updated_at: r.updated_at ?? null,
        qa_hold: Boolean(r.qa_hold ?? false),
        qa_hold_reason: r.qa_hold_reason ?? null,
        segregated_qty: Number(r.segregated_qty ?? 0),
        segregated_location: r.segregated_location ?? null,
        disposition: r.disposition ?? null,
        manufacture_date: r.manufacture_date ?? null,
        expiry_date: r.expiry_date ?? null,
        lot_number: r.lot_number ?? null,
      }))

      setFg(items)
      setFgLoading(false)
    } catch {
      setFg([])
      setFgError('Cannot load finished goods')
      setFgLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFinished()
    const channel = supabase
      ?.channel('realtime-finished-goods')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finished_goods' }, async (payload: any) => {
        const oldRow: any = payload?.old || {}
        const newRow: any = payload?.new || {}
        const oldRes = Number(oldRow?.reserved_qty ?? 0)
        const newRes = Number(newRow?.reserved_qty ?? 0)
        if (newRes !== oldRes) {
          // mark row highlight
          const key = String(newRow?.product_name || newRow?.id)
          setHighlightedRows((prev) => ({ ...prev, [key]: Date.now() }))
          setRecentlyAllocated((prev) => ({ ...prev, [key]: newRes > oldRes }))
          // try get latest po_number from reservation log
          let poNumber: string | null = null
          try {
            const { data } = await supabase
              .from('inventory_reservations')
              .select('po_id')
              .order('created_at', { ascending: false })
              .limit(1)
            if (data && data.length > 0) poNumber = String(data[0].po_id)
          } catch {}
          setFgBanner({ show: true, count: 1, poNumber })
          // auto hide banner after 5s
          setTimeout(() => setFgBanner((b) => ({ ...b, show: false })), 5000)
          // remove highlight after 5s
          setTimeout(() => setHighlightedRows((prev) => { const p = { ...prev }; delete p[key]; return p }), 5000)
        }
        // refresh table
        loadFinished()
      })
      .subscribe()
    return () => { if (channel) supabase?.removeChannel(channel) }
  }, [loadFinished])

  // Load FG purchase history for a given product
  const loadFgHistory = React.useCallback(async (productName: string) => {
    if (!supabase) return
    setFgHistLoading(true)
    setFgHistError(null)
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, created_at, customer_name, status, quantity, case_qty, allocated_qty, backorder_qty')
        .eq('product_name', productName)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) {
        setFgHistRows([])
        setFgHistError('Cannot load PO history')
      } else {
        const rows = (data ?? []).map((r: any) => ({
          id: String(r.id),
          created_at: r.created_at || new Date().toISOString(),
          customer_name: r.customer_name ?? null,
          status: String(r.status || ''),
          quantity: (r.quantity != null ? Number(r.quantity) : null),
          case_qty: (r.case_qty != null ? Number(r.case_qty) : null),
          allocated_qty: (r.allocated_qty != null ? Number(r.allocated_qty) : null),
          backorder_qty: (r.backorder_qty != null ? Number(r.backorder_qty) : null),
        }))
        setFgHistRows(rows)
      }
    } finally {
      setFgHistLoading(false)
    }
  }, [])

  // UI behavior hooks for PO canceled and batch completed
  useEffect(() => {
    const poChannel = supabase
      ?.channel('ui-po-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'purchase_orders' }, async (payload: any) => {
        const newRow: any = payload?.new || {}
        const oldRow: any = payload?.old || {}
        const newSt = String(newRow?.status || '').toLowerCase()
        const oldSt = String(oldRow?.status || '').toLowerCase()
        if (newSt === 'canceled' && oldSt !== 'canceled' && newRow?.id) {
          try {
            await supabase.rpc('release_po_reservations', { p_po_id: newRow.id })
            setToast({ show: true, message: 'Reservations released for this PO.' })
            // refresh materials to reflect reservation release
            try {
              const { data, error } = await supabase
                .from('inventory_materials')
                .select('id, product_name, category, supplier_id, supplier_name, unit_of_measure, unit_weight, cost_per_unit, total_available, reserved_qty, created_at, material_file_url')
                .order('product_name', { ascending: true })
              if (!error) {
                const rows = (data ?? []) as Array<any>
                const mapped: any[] = rows.map((r) => ({
                  id: String(r.id),
                  product_name: String(r.product_name ?? ''),
                  category: String(r.category ?? ''),
                  supplier_id: r.supplier_id ?? null,
                  supplier_name: r.supplier_name ?? null,
                  unit_of_measure: r.unit_of_measure ?? null,
                  unit_weight: r.unit_weight ?? null,
                  cost_per_unit: r.cost_per_unit ?? null,
                  total_available: r.total_available ?? null,
                  reserved_qty: r.reserved_qty ?? 0,
                  created_at: r.created_at ?? null,
                  material_file_urls: (() => { try { const v = r.material_file_url; if (!v) return []; const arr = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
                }))
                setMaterials(mapped as any)
              }
            } catch {}
          } catch {}
        }
      })
      .subscribe()

    const batchChannel = supabase
      ?.channel('ui-batch-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'production_batches' }, async (payload: any) => {
        const newRow: any = payload?.new || {}
        const oldRow: any = payload?.old || {}
        const newSt = String(newRow?.status || '').toLowerCase()
        const oldSt = String(oldRow?.status || '').toLowerCase()
        if (newSt === 'completed' && oldSt !== 'completed' && newRow?.id) {
          try {
            await supabase.rpc('consume_reservations', { p_batch_id: newRow.id })
            setToast({ show: true, message: 'Raw materials consumed.' })
            // reload inventory materials inline (minimal duplication to avoid refactor)
            try {
              const { data, error } = await supabase
                .from('inventory_materials')
                .select('id, product_name, category, supplier_id, supplier_name, unit_of_measure, unit_weight, cost_per_unit, total_available, reserved_qty, created_at')
                .order('product_name', { ascending: true })
              if (!error) {
                const rows = (data ?? []) as Array<any>
                const mapped: any[] = rows.map((r) => ({
                  id: String(r.id),
                  product_name: String(r.product_name ?? ''),
                  category: String(r.category ?? ''),
                  supplier_id: r.supplier_id ?? null,
                  supplier_name: r.supplier_name ?? null,
                  unit_of_measure: r.unit_of_measure ?? null,
                  unit_weight: r.unit_weight ?? null,
                  cost_per_unit: r.cost_per_unit ?? null,
                  total_available: r.total_available ?? null,
                  reserved_qty: r.reserved_qty ?? 0,
                  created_at: r.created_at ?? null,
                }))
                setMaterials(mapped as any)
              }
            } catch {}
            loadFinished()
          } catch {}
        } else {
          // For other status transitions, still refresh materials to keep reserved/available in sync
          try {
            const { data, error } = await supabase
              .from('inventory_materials')
              .select('id, product_name, category, supplier_id, supplier_name, unit_of_measure, unit_weight, cost_per_unit, total_available, reserved_qty, created_at, material_file_url')
              .order('product_name', { ascending: true })
            if (!error) {
              const rows = (data ?? []) as Array<any>
              const mapped: any[] = rows.map((r) => ({
                id: String(r.id),
                product_name: String(r.product_name ?? ''),
                category: String(r.category ?? ''),
                supplier_id: r.supplier_id ?? null,
                supplier_name: r.supplier_name ?? null,
                unit_of_measure: r.unit_of_measure ?? null,
                unit_weight: r.unit_weight ?? null,
                cost_per_unit: r.cost_per_unit ?? null,
                total_available: r.total_available ?? null,
                reserved_qty: r.reserved_qty ?? 0,
                created_at: r.created_at ?? null,
                material_file_urls: (() => { try { const v = r.material_file_url; if (!v) return []; const arr = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
              }))
              setMaterials(mapped as any)
            }
          } catch {}
        }
      })
      .subscribe()

    return () => {
      if (poChannel) supabase?.removeChannel(poChannel)
      if (batchChannel) supabase?.removeChannel(batchChannel)
    }
  }, [loadFinished])

  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(() => setToast({ show: false, message: '' }), 2500)
      return () => clearTimeout(t)
    }
  }, [toast.show])

  // Auto-Generate PR per spec
  const handleReplenishmentClick = async (material: RawMaterial) => {
    if (!supabase) return
    if (material?.replenishmentStatus?.hasPending) {
      setToast({ show: true, message: 'Requisition already exists' })
      setOpenReplFor(material.id)
      return
    }
    setIsGenerating(true)
    try {
      const { data, error } = await supabase.rpc('fn_replenishment_check', { p_material_id: material.id })
      if (error) {
        setToast({ show: true, message: error.message || 'Failed to generate PR' })
        return
      }
      if (!data) {
        setToast({ show: true, message: 'No response from replenishment function' })
        return
      }
      const status = String(data.status || '')
      if (status === 'no_action') {
        setToast({ show: true, message: String(data.message || 'Stock above reorder point') })
        return
      }
      if (status === 'created') {
        setReplModalFor(material)
        setReplRpcData(data)
        setToast({ show: true, message: 'Purchase Requisition processed' })
        // refresh materials + statuses
        try { await refreshMaterials() } catch {}
      } else {
        setToast({ show: true, message: String(data.message || 'No PR created') })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  // Helper to refresh inventory + status
  const refreshMaterials = async () => {
    const { data, error } = await supabase
      .from('inventory_materials')
      .select('id, product_name, category, supplier_id, supplier_name, unit_of_measure, unit_weight, cost_per_unit, total_available, reserved_qty, reorder_point, reorder_to_level, moq, eoq, created_at, material_file_url')
      .order('product_name', { ascending: true })
    if (error) return
    const rows = (data ?? []) as Array<any>
    const mapped: RawMaterial[] = rows.map((r) => ({
      id: String(r.id),
      product_name: String(r.product_name ?? ''),
      category: String(r.category ?? ''),
      supplier_id: r.supplier_id ?? null,
      supplier_name: r.supplier_name ?? null,
      unit_of_measure: r.unit_of_measure ?? null,
      unit_weight: r.unit_weight ?? null,
      cost_per_unit: r.cost_per_unit ?? null,
      total_available: Number(r.total_available ?? 0),
      reserved_qty: Number(r.reserved_qty ?? 0),
      reorder_point: Number(r.reorder_point ?? 0),
      reorder_to_level: Number(r.reorder_to_level ?? 0),
      moq: Number(r.moq ?? 0),
      eoq: Number(r.eoq ?? 0),
      created_at: r.created_at ?? null,
      material_file_urls: (() => { try { const v = r.material_file_url; if (!v) return []; const arr = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
    }))
    try {
      const ids = mapped.map(m => m.id)
      let statusRows: any[] = []
      let reqRows: any[] = []
      if (ids.length) {
        const { data: s } = await supabase
          .from('raw_material_replenishment_status')
          .select('material_id, has_pending_pr, pending_qty')
          .in('material_id', ids)
        statusRows = s ?? []
        const { data: rqs } = await supabase
          .from('raw_material_requisitions')
          .select('id, material_id, status, suggested_qty, created_at')
          .in('material_id', ids)
        reqRows = rqs ?? []
      }
      const latestReqByMat = new Map<string, any>()
      reqRows.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .forEach((r: any) => { const k = String(r.material_id); if (!latestReqByMat.has(k)) latestReqByMat.set(k, r) })
      const statusByMat = new Map(statusRows.map((s: any) => [String(s.material_id), s]))
      const withStatus = mapped.map(m => {
        const s: any = statusByMat.get(m.id) || {}
        const rq: any = latestReqByMat.get(m.id) || {}
        return {
          ...m,
          replenishmentStatus: {
            hasPending: Boolean(s.has_pending_pr ?? (rq.status && String(rq.status).toLowerCase() !== 'closed' && String(rq.status).toLowerCase() !== 'canceled')),
            qty: Number(s.pending_qty ?? rq.suggested_qty ?? 0),
            reqId: (rq.id != null ? String(rq.id) : null),
            reqStatus: rq.status != null ? String(rq.status) : null,
            reqCreatedAt: rq.created_at ?? null,
          }
        }
      })
      setMaterials(withStatus)
    } catch {
      setMaterials(mapped)
    }
  }

  // Load suppliers from Supabase on mount (reference: Products.tsx customer select)
  useEffect(() => {
    const loadSuppliers = async () => {
      if (!supabase) {
        setSuppliersLoading(false)
        setSuppliersError('Supabase not configured')
        return
      }
      setSuppliersLoading(true)
      setSuppliersError(null)
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .order('company_name', { ascending: true })

      if (error) {
        console.error('Failed to fetch suppliers', error)
        setSuppliersError('Cannot load suppliers')
        setSuppliersLoading(false)
        return
      }
      const rows = (data ?? []) as Array<{ id: string; company_name: string | null }>
      const items: Supplier[] = rows
        .map((r) => ({ id: String(r.id), name: String(r.company_name ?? '').trim() }))
        .filter((r) => r.id && r.name.length > 0)
      setSuppliers(items)
      setSuppliersLoading(false)
    }
    loadSuppliers()
  }, [])

  // Load raw materials and subscribe to realtime updates
  useEffect(() => {
    const loadMaterials = async () => {
      if (!supabase) return
      setMaterialsLoading(true)
      const { data, error } = await supabase
      .from('inventory_materials')
      .select('id, product_name, category, supplier_id, supplier_name, unit_of_measure, unit_weight, cost_per_unit, total_available, reserved_qty, reorder_point, reorder_to_level, moq, eoq, created_at, material_file_url')
      .order('product_name', { ascending: true })

      if (error) {
        console.error('Failed to fetch materials', error)
        setMaterialsLoading(false)
        return
      }
      const rows = (data ?? []) as Array<any>
      const mapped: RawMaterial[] = rows.map((r) => ({
        id: String(r.id),
        product_name: String(r.product_name ?? ''),
        category: String(r.category ?? ''),
        supplier_id: r.supplier_id ?? null,
        supplier_name: r.supplier_name ?? null,
        unit_of_measure: r.unit_of_measure ?? null,
        unit_weight: r.unit_weight ?? null,
        cost_per_unit: r.cost_per_unit ?? null,
        total_available: Number(r.total_available ?? 0),
        reserved_qty: Number(r.reserved_qty ?? 0),
        reorder_point: Number(r.reorder_point ?? 0),
        reorder_to_level: Number(r.reorder_to_level ?? 0),
        moq: Number(r.moq ?? 0),
        eoq: Number(r.eoq ?? 0),
        created_at: r.created_at ?? null,
        material_file_urls: (() => { try { const v = r.material_file_url; if (!v) return []; const arr = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
      }))

      // fetch replenishment status and latest requisition per material
      try {
        const ids = mapped.map(m => m.id)
        let statusRows: any[] = []
        let reqRows: any[] = []
        if (ids.length) {
          try {
            const { data: s } = await supabase
              .from('raw_material_replenishment_status')
              .select('material_id, has_pending_pr, pending_qty')
              .in('material_id', ids)
            statusRows = s ?? []
          } catch {}
          try {
            const { data: rqs } = await supabase
              .from('raw_material_requisitions')
              .select('id, material_id, status, suggested_qty, created_at')
              .in('material_id', ids)
            reqRows = rqs ?? []
          } catch {}
        }
        const latestReqByMat = new Map<string, any>()
        reqRows.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .forEach((r: any) => { const k = String(r.material_id); if (!latestReqByMat.has(k)) latestReqByMat.set(k, r) })
        const statusByMat = new Map(statusRows.map((s: any) => [String(s.material_id), s]))
        const withStatus = mapped.map(m => {
          const s: any = statusByMat.get(m.id) || {}
          const rq: any = latestReqByMat.get(m.id) || {}
          return {
            ...m,
            replenishmentStatus: {
              hasPending: Boolean(s.has_pending_pr ?? (rq.status && String(rq.status).toLowerCase() !== 'closed' && String(rq.status).toLowerCase() !== 'canceled')),
              qty: Number(s.pending_qty ?? rq.suggested_qty ?? 0),
              reqId: (rq.id != null ? String(rq.id) : null),
              reqStatus: rq.status != null ? String(rq.status) : null,
              reqCreatedAt: rq.created_at ?? null,
            }
          }
        })
        setMaterials(withStatus)
      } catch {
        setMaterials(mapped)
      }
      setMaterialsLoading(false)
    }

    loadMaterials()
    const channel = supabase
      ?.channel('inventory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_materials' }, () => {
        loadMaterials()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_reservations' }, () => {
        loadMaterials()
      })
      .subscribe()

    return () => {
      if (channel) supabase?.removeChannel(channel)
    }
  }, [])

  const rawMaterials = useMemo(() => {
    return (materials || []).filter((m) => String(m?.category || '').toLowerCase() !== 'packaging')
  }, [materials])

  const packagingMaterials = useMemo(() => {
    return (materials || []).filter((m) => String(m?.category || '').toLowerCase() === 'packaging')
  }, [materials])

  const titleByTab = {
    raw: 'Raw Materials',
    packaging: 'Packaging Management',
    finished: 'Finished Goods',
  } as const

  const addLabelByTab = {
    raw: 'Add Material',
    packaging: 'Update Inventory',
    finished: 'Add Finished Good',
  } as const

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-2 sm:p-4 lg:p-6">
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-dark mb-1">Inventory Management</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-6 mb-6">
          <nav className="-mb-px flex gap-6">
            <button
              className={`${mainTab === 'raw' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} inline-flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold`}
              onClick={() => setMainTab('raw')}
            >
              <Package className="h-4 w-4" /> Raw Materials
            </button>
            <button
              className={`${mainTab === 'packaging' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} inline-flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold`}
              onClick={() => setMainTab('packaging')}
            >
              <Box className="h-4 w-4" /> Packaging
            </button>
            <button
              className={`${mainTab === 'finished' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} inline-flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold`}
              onClick={() => setMainTab('finished')}
            >
              <Factory className="h-4 w-4" /> Finished Goods
            </button>
          </nav>
        </div>

        <div className="flex items-center justify-between mb-2 px-1">
          <div>
            <h2 className="text-xl font-semibold text-neutral-dark">{titleByTab[mainTab]}</h2>
          </div>
          <div className="flex items-center gap-2">
            {(mainTab === 'raw' || mainTab === 'packaging' || mainTab === 'finished') && (
              <button className="inline-flex items-center gap-2 border border-neutral-soft rounded-lg px-4 py-2 text-sm bg-white hover:border-neutral-medium hover:bg-neutral-light/40 text-neutral-dark">
                <LineChart className="h-4 w-4 text-primary-medium" /> Generate Forecast
              </button>
            )}

            {mainTab === 'finished' && (
              <button className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow-md">
                <Plus className="h-4 w-4" /> Update Inventory
              </button>
            )}

            {/* Replenishment Confirm Modal */}
            {replModalFor && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50" onClick={() => !replLoading && setReplModalFor(null)}></div>
                <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50 flex items-center justify-between">
                    <div className="text-lg font-semibold text-neutral-dark">Replenishment Recommendation</div>
                    <button className="p-2" onClick={() => !replLoading && setReplModalFor(null)}><X className="h-5 w-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between"><span className="text-neutral-medium">Material Name</span><span className="font-semibold text-neutral-dark">{replModalFor.product_name}</span></div>
                        <div className="flex items-center justify-between"><span className="text-neutral-medium">Total Available</span><span className="font-semibold text-neutral-dark">{replModalFor.total_available ?? '0'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-neutral-medium">Reserved Qty</span><span className="font-semibold text-neutral-dark">{replModalFor.reserved_qty ?? 0}</span></div>
                        <div className="flex items-center justify-between"><span className="text-neutral-medium">Net Available</span><span className="font-semibold text-neutral-dark">{Number(replModalFor.total_available || 0) - Number(replModalFor.reserved_qty || 0)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-neutral-medium">Reorder Point</span><span className="font-semibold text-neutral-dark">{replModalFor.reorder_point ?? '—'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-neutral-medium">Reorder To Level</span><span className="font-semibold text-neutral-dark">{replModalFor.reorder_to_level ?? '—'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-neutral-medium">MOQ</span><span className="font-semibold text-neutral-dark">{replModalFor.moq ?? '—'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-neutral-medium">EOQ</span><span className="font-semibold text-neutral-dark">{replModalFor.eoq ?? '—'}</span></div>
                      </div>
                    </div>
                    <div className="text-sm bg-neutral-light/30 border border-neutral-soft rounded-xl p-3">
                      {(() => {
                        const net = Number(replModalFor.total_available || 0) - Number(replModalFor.reserved_qty || 0)
                        const rto = Number(replModalFor.reorder_to_level || 0)
                        const moq = Number(replModalFor.moq || 0)
                        const eoq = Number(replModalFor.eoq || 0)
                        const base = Math.max(moq, eoq, Math.max(0, rto - net))
                        return (
                          <>
                            <div className="font-semibold text-neutral-dark">Suggested Qty: <span className="text-primary-medium">{base}</span></div>
                            <div className="text-xs text-neutral-medium mt-1">Suggested Qty = max(MOQ, EOQ, ReorderToLevel − NetAvailable)</div>
                          </>
                        )
                      })()}
                    </div>
                    {replRpcData && (
                      <div className="text-xs text-neutral-medium border border-neutral-soft rounded-xl p-3">
                        {replRpcData.suggested_qty !== undefined && (
                          <div className="mb-1">RPC Suggested Qty: <span className="font-semibold text-neutral-dark">{replRpcData.suggested_qty}</span></div>
                        )}
                        {replRpcData.message && (
                          <div className="text-[11px] leading-snug">{replRpcData.message}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-soft/50">
                    <button className="px-4 py-2 rounded-lg border border-neutral-soft" onClick={() => !replLoading && setReplModalFor(null)}>Cancel</button>
                    <button
                      className="px-5 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm disabled:opacity-60"
                      disabled={replLoading}
                      onClick={async () => {
                        if (!replModalFor) return
                        setReplLoading(true)
                        try {
                          const { data, error } = await supabase.rpc("fn_replenishment_check", { p_material_id: replModalFor.id })
                          if (error) throw error
                          const status = (data && (data.status || data.result || '')) as string
                          if (status && status.toLowerCase().includes('created')) {
                            setToast({ show: true, message: 'Purchase Requisition Created' })
                          } else if (status && status.toLowerCase().includes('not') ) {
                            setToast({ show: true, message: 'Stock level above reorder point' })
                          } else {
                            setToast({ show: true, message: 'Purchase Requisition processed' })
                          }
                        } catch (e) {
                          setToast({ show: true, message: 'Failed to generate PR' })
                        } finally {
                          setReplLoading(false)
                          setReplModalFor(null)
                        }
                      }}
                    >
                      {replLoading ? 'Processing…' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* PR Details Modal */}
            {prModalFor && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50" onClick={() => setPrModalFor(null)} />
                <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50 flex items-center justify-between">
                    <div className="text-lg font-semibold text-neutral-dark">Replenishment Details</div>
                    <button className="p-2" onClick={() => setPrModalFor(null)}><X className="h-5 w-5"/></button>
                  </div>
                  <div className="p-6 space-y-5 text-sm">
                    {(() => {
                      const m = prModalFor
                      const net = Number(m.total_available || 0) - Number(m.reserved_qty || 0)
                      const rto = Number(m.reorder_to_level || 0)
                      const moq = Number(m.moq || 0)
                      const eoq = Number(m.eoq || 0)
                      const suggested = Math.max(moq, eoq, Math.max(0, rto - net))
                      const created = m.replenishmentStatus?.reqCreatedAt
                        ? new Date(m.replenishmentStatus.reqCreatedAt).toLocaleString(undefined, {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                            hour: 'numeric', minute: '2-digit', second: '2-digit'
                          })
                        : '—'
                      const status = (m.replenishmentStatus?.reqStatus || '—') as string
                      const statusCls = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ' +
                        (String(status).toLowerCase() === 'open' ? 'bg-blue-100 text-blue-700' :
                         String(status).toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                         String(status).toLowerCase() === 'canceled' ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-700')
                      return (
                        <div className="space-y-4">
                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-neutral-medium mb-1">Subject</div>
                            <div className="text-base font-semibold text-neutral-dark">Purchase Requisition — {m.product_name}</div>
                            <div className="mt-1 text-xs text-neutral-medium">Created {created}</div>
                          </div>

                          <div className="rounded-xl border border-neutral-soft bg-neutral-light/20">
                            <div className="px-4 py-3 border-b border-neutral-soft/60 text-[12px] font-semibold text-neutral-dark">Details</div>
                            <div className="p-4 space-y-2">
                              <div><span className="text-neutral-medium">Material:</span> <span className="font-semibold text-neutral-dark">{m.product_name}</span></div>
                              <div><span className="text-neutral-medium">Status:</span> <span className={statusCls}>{status}</span></div>
                              <div><span className="text-neutral-medium">Suggested Qty:</span> <span className="font-semibold text-primary-medium">{suggested}</span></div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-neutral-soft bg-white">
                            <div className="px-4 py-3 border-b border-neutral-soft/60 text-[12px] font-semibold text-neutral-dark">Inventory Snapshot</div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
                              <div><span className="text-neutral-medium">Net Available:</span> <span className="font-semibold text-neutral-dark">{net}</span></div>
                              <div><span className="text-neutral-medium">Reorder To Level:</span> <span className="font-semibold text-neutral-dark">{m.reorder_to_level ?? '—'}</span></div>
                              <div><span className="text-neutral-medium">Reorder Point:</span> <span className="font-semibold text-neutral-dark">{m.reorder_point ?? '—'}</span></div>
                              <div><span className="text-neutral-medium">MOQ:</span> <span className="font-semibold text-neutral-dark">{m.moq ?? '—'}</span></div>
                              <div><span className="text-neutral-medium">EOQ:</span> <span className="font-semibold text-neutral-dark">{m.eoq ?? '—'}</span></div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                  <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-soft/50">
                    <button className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all" onClick={() => setPrModalFor(null)}>Close</button>
                  </div>
                </div>
              </div>
            )}
            {/* Reservation History Modal */}
            {isHistoryOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50" onClick={() => setIsHistoryOpen(false)}></div>
                <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                    <div>
                      <h2 className="text-2xl font-semibold text-neutral-dark">Reservation History – {selectedMaterial}</h2>
                      <p className="text-sm text-neutral-medium mt-1">Latest entries first</p>
                    </div>
                    <button onClick={() => setIsHistoryOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all">✕</button>
                  </div>
                  <div className="p-6">
                    {historyLoading ? (
                      <div className="p-6 text-center text-neutral-medium">Loading…</div>
                    ) : historyError ? (
                      <div className="p-6 text-center text-accent-danger">{historyError}</div>
                    ) : historyData.length === 0 ? (
                      <div className="p-6 text-center text-neutral-medium">No reservation history found</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                              <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Production Line</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Quantity Reserved</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Date Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-soft/20">
                            {historyData.map((h, i) => (
                              <tr key={i} className="group">
                                <td className="px-6 py-3 text-sm text-neutral-dark">{h.line_name || h.line_id}</td>
                                <td className="px-6 py-3 text-sm text-neutral-dark">{h.qty}</td>
                                <td className="px-6 py-3 text-sm text-neutral-dark">{new Date(h.created_at).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="mt-6 flex justify-end">
                      <button className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all" onClick={() => setIsHistoryOpen(false)}>Close</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {mainTab !== 'finished' && canManageInventory && (
              <button onClick={() => { if (mainTab==='raw') setIsAddRawOpen(true) }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow-md">
                <Plus className="h-4 w-4" /> {addLabelByTab[mainTab]}
              </button>
            )}
            {!canViewInventory && !roleLoading && (
              <div className="text-sm text-neutral-medium">
                Access restricted to authorized roles only.
              </div>
            )}
          </div>
        </div>

        {mainTab === 'raw' && (
          <div className="border-b border-neutral-soft mb-6 px-1"> 
            <nav className="-mb-px flex gap-6">
              <button
                className={`${subTab === 'list' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} border-b-2 px-2 py-2 text-sm font-semibold`}
                onClick={() => setSubTab('list')}
              >
                Raw Materials ({rawMaterials.length})
              </button>
              <button
                className={`${subTab === 'forecast' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} border-b-2 px-2 py-2 text-sm font-semibold`}
                onClick={() => setSubTab('forecast')}
              >
                Monthly Forecasts (0)
              </button>
            </nav>
          </div>
        )}
        {mainTab === 'packaging' && (
          <div className="border-b border-neutral-soft mb-6 px-1"> 
            <nav className="-mb-px flex gap-6">
              <button
                className={`${subTab === 'list' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} border-b-2 px-2 py-2 text-sm font-semibold`}
                onClick={() => setSubTab('list')}
              >
                Current Inventory
              </button>
              <button
                className={`${subTab === 'forecast' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} border-b-2 px-2 py-2 text-sm font-semibold`}
                onClick={() => setSubTab('forecast')}
              >
                Monthly Forecasts (0)
              </button>
            </nav>
          </div>
        )}
        {mainTab === 'finished' && (
          <div className="border-b border-neutral-soft mb-6 px-1"> 
            <nav className="-mb-px flex gap-6">
              <button
                className={`${subTab === 'list' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} border-b-2 px-2 py-2 text-sm font-semibold`}
                onClick={() => setSubTab('list')}
              >
                Current Inventory
              </button>
              <button
                className={`${subTab === 'forecast' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} border-b-2 px-2 py-2 text-sm font-semibold`}
                onClick={() => setSubTab('forecast')}
              >
                Monthly Forecasts (0)
              </button>
            </nav>
          </div>
        )}
        {mainTab === 'finished' ? (
          <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-dark">Finished Goods Inventory</h3>
              </div>
            </div>

            {fgBanner.show && (
              <div className="mx-6 mt-4 mb-0 p-3 rounded-lg border border-teal-300 bg-teal-50 text-teal-700 text-sm">
                ✅ Finished Goods updated — {fgBanner.count} item(s) reserved{fgBanner.poNumber ? ` for PO #${fgBanner.poNumber}` : ''}.
              </div>
            )}
            {fgLoading ? (
              <div className="p-10 text-center text-neutral-medium">Loading…</div>
            ) : fgError ? (
              <div className="p-10 text-center text-accent-danger">{fgError}</div>
            ) : fg.length === 0 ? (
              <div className="p-10 text-center text-neutral-medium">No finished goods found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                      <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Product</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Location</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Lot #</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Mfg Date</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Expiry Date</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider">Available Qty</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider">Reserved Qty</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-neutral-dark uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">History</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-soft/20">
                    {fg.map(item => {
                      const allocated = Number(item.reserved_qty || 0)
                      const key = item.product_name || item.id
                      const highlighted = highlightedRows[key] !== undefined
                      const hasStock = Number(item.available_qty || 0) > 0
                      const qaHold = Boolean((item as any).qa_hold)
                      const status = qaHold ? 'QA Hold - Segregated Lot' : (hasStock ? 'Sufficient' : 'No Stock')
                      const statusTone = qaHold ? 'rose' : (hasStock ? 'emerald' : 'red')
                      const nf = new Intl.NumberFormat('en-US')
                      const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-CA') : '—')
                      return (
                        <tr key={item.id} className={`hover:bg-neutral-light/20 transition ${highlighted ? 'ring-1 ring-primary-light/50 bg-teal-50/30' : ''} ${qaHold ? 'bg-gray-50' : ''}`}>
                          <td className="px-6 py-4 text-sm text-neutral-dark font-medium">
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[280px]" title={item.product_name}>{item.product_name}</span>
                              {recentlyAllocated[key] && highlighted && (
                                <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">Allocated</span>
                              )}
                              {String((item as any).disposition || '').toUpperCase().includes('REWORK') && (
                                <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="This finished good came from a rework batch.">Rework</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-dark">{item.location || '—'}</td>
                          <td className="px-6 py-4 text-sm text-neutral-dark">{(item as any).lot_number || '—'}</td>
                          <td className="px-6 py-4 text-sm text-neutral-dark">{fmtDate(item.manufacture_date)}</td>
                          <td className="px-6 py-4 text-sm text-neutral-dark">{fmtDate(item.expiry_date)}</td>
                          <td className="px-6 py-4 text-sm text-neutral-dark text-right font-mono tabular-nums">{nf.format(Number(item.available_qty || 0))}</td>
                          <td className="px-6 py-4 text-sm text-neutral-dark text-right font-mono tabular-nums">{nf.format(allocated)}</td>
                          <td className="px-6 py-4 text-center">
                            {qaHold ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">QA Hold - Segregated Lot</span>
                                {(item as any).qa_hold_reason ? (
                                  <span className="text-[10px] text-rose-600/80 max-w-[220px] truncate" title={(item as any).qa_hold_reason}>
                                    {(item as any).qa_hold_reason}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border bg-${statusTone}-50 text-${statusTone}-700 border-${statusTone}-200`}>{status}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-dark">
                            <button
                              type="button"
                              onClick={async () => { setFgHistProduct(item.product_name); setFgHistOpen(true); await loadFgHistory(item.product_name) }}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-soft bg-white hover:bg-neutral-light/40 text-neutral-800 text-xs font-semibold"
                              title={`View PO history for ${item.product_name}`}
                            >
                              <ClipboardList className="w-3.5 h-3.5 text-primary-medium" />
                              View History
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-6 py-3 text-xs text-neutral-medium border-t border-neutral-soft/40 bg-white/60 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Last synced at {fgLastSynced || '—'}
            </div>
            {fgHistOpen && (
              <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60" onClick={() => setFgHistOpen(false)}></div>
                <div className="relative z-10 w-full max-w-3xl max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-soft/40 bg-white">
                    <div>
                      <h4 className="text-lg font-semibold text-neutral-dark">PO History</h4>
                      <p className="text-sm text-neutral-medium">{fgHistProduct || ''}</p>
                    </div>
                    <button onClick={() => setFgHistOpen(false)} className="p-2 rounded-lg hover:bg-neutral-light/40 text-neutral-medium"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {fgHistLoading ? (
                      <div className="p-8 text-center text-neutral-medium">Loading…</div>
                    ) : fgHistError ? (
                      <div className="p-8 text-center text-accent-danger">{fgHistError}</div>
                    ) : fgHistRows.length === 0 ? (
                      <div className="p-8 text-center text-neutral-medium">No purchase orders found for this product.</div>
                    ) : (
                      (() => {
                        const tone = (st: string) => {
                          const s = st?.toLowerCase() || ''
                          if (s.includes('alloc')) return 'emerald'
                          if (s.includes('approved') || s.includes('ready')) return 'blue'
                          if (s.includes('ship') || s.includes('shipped')) return 'indigo'
                          if (s.includes('draft')) return 'slate'
                          if (s.includes('cancel') || s.includes('closed')) return 'red'
                          return 'neutral'
                        }
                        const nf = new Intl.NumberFormat('en-US')
                        const df = new Intl.DateTimeFormat('en-US', { month: 'long', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                        const groups: Record<string, typeof fgHistRows> = {}
                        fgHistRows.forEach((r) => {
                          const d = new Date(r.created_at)
                          const key = `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`
                          groups[key] = groups[key] || []
                          groups[key].push(r)
                        })
                        const order = Object.keys(groups).sort((a,b)=>{
                          const da = new Date(a)
                          const db = new Date(b)
                          return db.getTime()-da.getTime()
                        })
                        return (
                          <div className="py-2">
                            {order.map((g) => (
                              <div key={g} className="mb-5">
                                <div className="px-6 pb-2 text-[11px] font-bold tracking-wider uppercase text-neutral-medium">{g}</div>
                                <div className="space-y-2">
                                  {groups[g].map((r) => {
                                    const created = new Date(r.created_at)
                                    const qty = r.quantity != null ? nf.format(r.quantity) : '—'
                                    const remainingRaw = (r.backorder_qty != null ? Number(r.backorder_qty) : ((r.quantity != null && r.allocated_qty != null) ? (Number(r.quantity) - Number(r.allocated_qty)) : null))
                                    const remaining = (remainingRaw != null ? Math.max(0, remainingRaw) : null)
                                    const t = tone(String(r.status||''))
                                    const name = r.customer_name || '—'
                                    const initials = name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase() || '—'
                                    return (
                                      <div key={r.id} className="mx-4 rounded-xl border border-neutral-soft/60 bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="px-6 py-4 flex items-center justify-between gap-4">
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-primary-light/20 text-primary-dark flex items-center justify-center text-xs font-bold flex-shrink-0">{initials}</div>
                                            <div className="min-w-0">
                                              <div className="text-[15px] font-semibold text-neutral-900 truncate">{name}</div>
                                              <div className="mt-0.5 text-xs text-neutral-medium">{df.format(created)}</div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border bg-${t}-50 text-${t}-700 border-${t}-200`}>{r.status || '—'}</span>
                                            <span className="text-sm text-neutral-900 font-mono tabular-nums">Qty: {qty}</span>
                                            <span className="text-sm text-neutral-900 font-mono tabular-nums">Remaining: {remaining != null ? nf.format(remaining) : '—'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                            <div className="px-6 pt-2 pb-4 text-[11px] text-neutral-medium">Showing latest {fgHistRows.length} record(s).</div>
                          </div>
                        )
                      })()
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {mainTab === 'packaging' && subTab === 'list' ? (
              materialsLoading || packagingMaterials.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-soft/20 shadow-md p-14 flex flex-col items-center justify-center">
                  <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
                    <Landmark className="h-8 w-8 text-primary-medium" />
                  </div>
                  <div className="text-neutral-dark font-semibold mb-1">{materialsLoading ? 'Loading packaging inventory...' : 'No inventory records found'}</div>
                  {!materialsLoading && (
                    <p className="text-sm text-neutral-medium mb-6 text-center">Packaging items appear here when their category is Packaging.</p>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b border-neutral-soft/40">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-neutral-dark">Packaging Inventory</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Product</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Category</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Supplier</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">UoM</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Unit Weight</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Cost/Unit</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Total Available</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Reserved</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Net Available</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-soft/20">
                        {packagingMaterials.map((m) => (
                          <React.Fragment key={m.id}>
                          <tr className="hover:bg-neutral-light/20 transition">
                            <td className="px-6 py-4 text-sm text-neutral-dark font-medium">
                              {m.product_name}
                              {m.replenishmentStatus?.hasPending ? (
                                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                  <Bell className="h-3.5 w-3.5 mr-1" /> Pending PR ({m.replenishmentStatus.qty})
                                </span>
                              ) : ((Number(m.total_available ?? 0) - Number(m.reserved_qty ?? 0)) <= Number(m.reorder_point ?? 0)) ? (
                                <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Replenishment Required</span>
                              ) : null}
                            </td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.category || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.supplier_name || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.unit_of_measure || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.unit_weight || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.cost_per_unit || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.total_available || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">
                              <div className="flex items-center gap-2">
                                <span>{(m as any).reserved_qty ?? 0}</span>
                                <button
                                  type="button"
                                  className="p-1.5 rounded-md border border-neutral-soft hover:border-neutral-medium hover:bg-neutral-light/40 text-neutral-medium hover:text-neutral-dark"
                                  title="View reservation history"
                                  onClick={() => { setSelectedMaterial(m.product_name); setIsHistoryOpen(true) }}
                                >
                                  <Clock className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{Number(m.total_available || 0) - Number(m.reserved_qty || 0)}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button type="button" onClick={() => { setViewData(m); setIsViewOpen(true) }} className="p-2 text-primary-medium hover:text-white hover:bg-primary-medium rounded-lg border border-primary-light/30">
                                  <Eye className="h-4 w-4" />
                                </button>
                                {canManageInventory && (
                                  <button type="button" onClick={() => { setEditId(m.id); setEditForm({
                                    product_name: m.product_name || '',
                                    category: m.category || '',
                                    supplier_id: m.supplier_id || '',
                                    supplier_name: m.supplier_name || '',
                                    unit_of_measure: m.unit_of_measure || '',
                                    unit_weight: m.unit_weight || '',
                                    cost_per_unit: m.cost_per_unit || '',
                                    total_available: String(m.total_available ?? ''),
                                    lot_number: '',
                                    manufacture_date: '',
                                    expiry_date: '',
                                    reorder_point: String((m as any).reorder_point ?? ''),
                                    reorder_to_level: String((m as any).reorder_to_level ?? ''),
                                    moq: String((m as any).moq ?? ''),
                                    eoq: String((m as any).eoq ?? ''),
                                    material_file_urls: (m as any).material_file_urls || [],
                                  }); setEditDocFiles([]); setIsEditOpen(true) }} className="p-2 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-lg border border-neutral-soft">
                                    <Edit className="h-4 w-4" />
                                  </button>
                                )}
                                {(() => {
                                  const hasPending = Boolean(m.replenishmentStatus?.hasPending)
                                  const net = Number(m.total_available || 0) - Number((m as any).reserved_qty || 0)
                                  const rp = Number((m as any).reorder_point || 0)
                                  if (hasPending) {
                                    return (
                                      <button type="button" onClick={() => setOpenReplFor(openReplFor === m.id ? null : m.id)} className="px-3 py-1.5 text-xs inline-flex items-center gap-1 rounded-lg border border-primary-light text-primary-medium hover:bg-primary-light/20">
                                        <ClipboardList className="h-4 w-4" /> View PR Details
                                      </button>
                                    )
                                  }
                                  if (net <= rp && canManageInventory) {
                                    return (
                                      <button type="button" onClick={() => handleReplenishmentClick(m)} className="px-3 py-1.5 text-xs inline-flex items-center gap-1 rounded-lg border border-primary-light text-primary-medium hover:bg-primary-light/20">
                                        <ClipboardList className="h-4 w-4" /> Auto-Generate PR
                                      </button>
                                    )
                                  }
                                  return null
                                })()}
                                {canManageInventory && (
                                  <button type="button" onClick={() => { setDeleteTarget(m); setIsDeleteOpen(true) }} className="p-2 text-accent-danger hover:text-white hover:bg-accent-danger rounded-lg border border-accent-danger/30">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {openReplFor === m.id && (
                            <tr>
                              <td colSpan={10} className="px-6 py-5 bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
                                <div className="rounded-2xl bg-white border border-neutral-soft/40 shadow-lg p-6">
                                  <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-lg bg-primary-light/20">
                                        <Package className="h-5 w-5 text-primary-medium" />
                                      </div>
                                      <div>
                                        <div className="text-lg font-semibold text-neutral-dark">Replenishment Panel</div>
                                        <div className="text-xs text-neutral-medium">Material: {m.product_name}</div>
                                      </div>
                                    </div>
                                    {m.replenishmentStatus?.hasPending ? (
                                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                        <Bell className="h-4 w-4 mr-2"/> Pending PR ({m.replenishmentStatus.qty})
                                      </span>
                                    ) : (() => { const net = Number(m.total_available || 0) - Number(m.reserved_qty || 0); const rp = Number(m.reorder_point || 0); return net <= rp ? (
                                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700 border border-red-200">Replenishment Required</span>
                                    ) : null })()}
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                      <div className="rounded-xl border border-neutral-soft bg-gradient-to-r from-neutral-light/40 to-white p-4">
                                        <div className="text-xs font-semibold text-neutral-dark uppercase tracking-wider mb-3 border-b border-neutral-soft/60 pb-2">Current Stock</div>
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">Total Available</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.total_available ?? '0'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">Reserved Qty</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.reserved_qty ?? 0}</span>
                                          </div>
                                          <div className="flex items-center justify-between pt-2 border-t border-neutral-soft/60">
                                            <span className="text-sm font-semibold text-neutral-dark">Net Available</span>
                                            <span className="text-xl font-semibold text-neutral-dark">{Number(m.total_available || 0) - Number(m.reserved_qty || 0)}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">Reorder Point</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.reorder_point ?? '—'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <div className="rounded-xl border border-neutral-soft bg-gradient-to-r from-white to-neutral-light/40 p-4">
                                        <div className="text-xs font-semibold text-neutral-dark uppercase tracking-wider mb-3 border-b border-neutral-soft/60 pb-2">Ordering Parameters</div>
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">Reorder To Level</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.reorder_to_level ?? '—'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">MOQ</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.moq ?? '—'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">EOQ</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.eoq ?? '—'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {m.replenishmentStatus?.hasPending && (
                                    <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                      <div className="flex items-start gap-3">
                                        <div className="p-1.5 rounded-lg bg-blue-200">
                                          <Bell className="h-4 w-4 text-blue-700" />
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-semibold text-blue-800 mb-1">Pending Requisition</div>
                                          <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div><span className="text-neutral-medium">Qty:</span> <span className="font-semibold text-neutral-dark">{m.replenishmentStatus.qty}</span></div>
                                            <div><span className="text-neutral-medium">Status:</span> <span className="font-semibold text-neutral-dark">{m.replenishmentStatus.reqStatus || '—'}</span></div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <div className="mt-6 pt-4 border-t border-neutral-soft/60 flex items-center justify-end">
                                    {(() => {
                                      const hasPending = Boolean(m.replenishmentStatus?.hasPending)
                                      const net = Number(m.total_available || 0) - Number(m.reserved_qty || 0)
                                      const rp = Number(m.reorder_point || 0)
                                      if (hasPending) {
                                        return (
                                          <button type="button" onClick={() => setPrModalFor(m)} className="px-4 py-2.5 text-sm inline-flex items-center gap-2 rounded-xl border-2 border-primary-medium text-primary-medium hover:bg-primary-medium hover:text-white transition-all duration-200 font-semibold">
                                            <ClipboardList className="h-4 w-4" /> View PR Details
                                          </button>
                                        )
                                      }
                                      if (net <= rp && canManageInventory) {
                                        return (
                                          <button type="button" disabled={isGenerating} onClick={() => handleReplenishmentClick(m)} className={`px-4 py-2.5 text-sm inline-flex items-center gap-2 rounded-xl border-2 border-primary-medium text-primary-medium hover:bg-primary-medium hover:text-white transition-all duration-200 font-semibold ${isGenerating ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                            <ClipboardList className="h-4 w-4" /> Auto-Generate PR
                                          </button>
                                        )
                                      }
                                      return null
                                    })()}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : (
              materialsLoading || rawMaterials.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-soft/20 shadow-md p-12 flex flex-col items-center justify-center">
                  <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
                    <Inbox className="h-8 w-8 text-primary-medium" />
                  </div>
                  <div className="text-neutral-dark font-semibold mb-1">{materialsLoading ? 'Loading raw materials...' : 'No raw materials found'}</div>
                  {!materialsLoading && (
                    <>
                      <p className="text-sm text-neutral-medium mb-6">Add a new item to track your inventory.</p>
                      {canManageInventory && (
                        <button onClick={() => { if (mainTab==='raw') setIsAddRawOpen(true) }} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow">
                          <Plus className="h-4 w-4" /> Add Your First Raw Material
                        </button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b border-neutral-soft/40">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-neutral-dark">Raw Materials Inventory</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Product</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Category</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Supplier</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">UoM</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Unit Weight</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Cost/Unit</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Total Available</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Reserved</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Net Available</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-soft/20">
                        {rawMaterials.map((m) => (
                          <React.Fragment key={m.id}>
                          <tr className="hover:bg-neutral-light/20 transition">
                            <td className="px-6 py-4 text-sm text-neutral-dark font-medium">
                              {m.product_name}
                              {m.replenishmentStatus?.hasPending ? (
                                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                  <Bell className="h-3.5 w-3.5 mr-1" /> Pending PR ({m.replenishmentStatus.qty})
                                </span>
                              ) : ((Number(m.total_available ?? 0) - Number(m.reserved_qty ?? 0)) <= Number(m.reorder_point ?? 0)) ? (
                                <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Replenishment Required</span>
                              ) : null}
                            </td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.category || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.supplier_name || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.unit_of_measure || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.unit_weight || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.cost_per_unit || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{m.total_available || '—'}</td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">
                              <div className="flex items-center gap-2">
                                <span>{(m as any).reserved_qty ?? 0}</span>
                                <button
                                  type="button"
                                  className="p-1.5 rounded-md border border-neutral-soft hover:border-neutral-medium hover:bg-neutral-light/40 text-neutral-medium hover:text-neutral-dark"
                                  title="View reservation history"
                                  onClick={() => { setSelectedMaterial(m.product_name); setIsHistoryOpen(true) }}
                                >
                                  <Clock className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-neutral-dark">{Number(m.total_available || 0) - Number(m.reserved_qty || 0)}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button type="button" onClick={() => { setViewData(m); setIsViewOpen(true) }} className="p-2 text-primary-medium hover:text-white hover:bg-primary-medium rounded-lg border border-primary-light/30">
                                  <Eye className="h-4 w-4" />
                                </button>
                                {canManageInventory && (
                                  <button type="button" onClick={() => { setEditId(m.id); setEditForm({
                                    product_name: m.product_name || '',
                                    category: m.category || '',
                                    supplier_id: m.supplier_id || '',
                                    supplier_name: m.supplier_name || '',
                                    unit_of_measure: m.unit_of_measure || '',
                                    unit_weight: m.unit_weight || '',
                                    cost_per_unit: m.cost_per_unit || '',
                                    total_available: String(m.total_available ?? ''),
                                    lot_number: '',
                                    manufacture_date: '',
                                    expiry_date: '',
                                    reorder_point: String((m as any).reorder_point ?? ''),
                                    reorder_to_level: String((m as any).reorder_to_level ?? ''),
                                    moq: String((m as any).moq ?? ''),
                                    eoq: String((m as any).eoq ?? ''),
                                    material_file_urls: (m as any).material_file_urls || [],
                                  }); setEditDocFiles([]); setIsEditOpen(true) }} className="p-2 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-lg border border-neutral-soft">
                                    <Edit className="h-4 w-4" />
                                  </button>
                                )}
                                {(() => {
                                  const hasPending = Boolean(m.replenishmentStatus?.hasPending)
                                  const net = Number(m.total_available || 0) - Number((m as any).reserved_qty || 0)
                                  const rp = Number((m as any).reorder_point || 0)
                                  if (hasPending) {
                                    return (
                                      <button type="button" onClick={() => setOpenReplFor(openReplFor === m.id ? null : m.id)} className="px-3 py-1.5 text-xs inline-flex items-center gap-1 rounded-lg border border-primary-light text-primary-medium hover:bg-primary-light/20">
                                        <ClipboardList className="h-4 w-4" /> View PR Details
                                      </button>
                                    )
                                  }
                                  if (net <= rp && canManageInventory) {
                                    return (
                                      <button type="button" onClick={() => handleReplenishmentClick(m)} className="px-3 py-1.5 text-xs inline-flex items-center gap-1 rounded-lg border border-primary-light text-primary-medium hover:bg-primary-light/20">
                                        <ClipboardList className="h-4 w-4" /> Auto-Generate PR
                                      </button>
                                    )
                                  }
                                  return null
                                })()}
                                {canManageInventory && (
                                  <button type="button" onClick={() => { setDeleteTarget(m); setIsDeleteOpen(true) }} className="p-2 text-accent-danger hover:text-white hover:bg-accent-danger rounded-lg border border-accent-danger/30">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {openReplFor === m.id && (
                            <tr>
                              <td colSpan={10} className="px-6 py-5 bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
                                <div className="rounded-2xl bg-white border border-neutral-soft/40 shadow-lg p-6">
                                  <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-lg bg-primary-light/20">
                                        <Package className="h-5 w-5 text-primary-medium" />
                                      </div>
                                      <div>
                                        <div className="text-lg font-semibold text-neutral-dark">Replenishment Panel</div>
                                        <div className="text-xs text-neutral-medium">Material: {m.product_name}</div>
                                      </div>
                                    </div>
                                    {m.replenishmentStatus?.hasPending ? (
                                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                        <Bell className="h-4 w-4 mr-2"/> Pending PR ({m.replenishmentStatus.qty})
                                      </span>
                                    ) : (() => { const net = Number(m.total_available || 0) - Number(m.reserved_qty || 0); const rp = Number(m.reorder_point || 0); return net <= rp ? (
                                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700 border border-red-200">Replenishment Required</span>
                                    ) : null })()}
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                      <div className="rounded-xl border border-neutral-soft bg-gradient-to-r from-neutral-light/40 to-white p-4">
                                        <div className="text-xs font-semibold text-neutral-dark uppercase tracking-wider mb-3 border-b border-neutral-soft/60 pb-2">Current Stock</div>
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">Total Available</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.total_available ?? '0'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">Reserved Qty</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.reserved_qty ?? 0}</span>
                                          </div>
                                          <div className="flex items-center justify-between pt-2 border-t border-neutral-soft/60">
                                            <span className="text-sm font-semibold text-neutral-dark">Net Available</span>
                                            <span className="text-xl font-semibold text-neutral-dark">{Number(m.total_available || 0) - Number(m.reserved_qty || 0)}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">Reorder Point</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.reorder_point ?? '—'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <div className="rounded-xl border border-neutral-soft bg-gradient-to-r from-white to-neutral-light/40 p-4">
                                        <div className="text-xs font-semibold text-neutral-dark uppercase tracking-wider mb-3 border-b border-neutral-soft/60 pb-2">Ordering Parameters</div>
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">Reorder To Level</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.reorder_to_level ?? '—'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">MOQ</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.moq ?? '—'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-medium">EOQ</span>
                                            <span className="text-lg font-semibold text-neutral-dark">{m.eoq ?? '—'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {m.replenishmentStatus?.hasPending && (
                                    <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                      <div className="flex items-start gap-3">
                                        <div className="p-1.5 rounded-lg bg-blue-200">
                                          <Bell className="h-4 w-4 text-blue-700" />
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-semibold text-blue-800 mb-1">Pending Requisition</div>
                                          <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div><span className="text-neutral-medium">Qty:</span> <span className="font-semibold text-neutral-dark">{m.replenishmentStatus.qty}</span></div>
                                            <div><span className="text-neutral-medium">Status:</span> <span className="font-semibold text-neutral-dark">{m.replenishmentStatus.reqStatus || '—'}</span></div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <div className="mt-6 pt-4 border-t border-neutral-soft/60 flex items-center justify-end">
                                    {(() => {
                                      const hasPending = Boolean(m.replenishmentStatus?.hasPending)
                                      const net = Number(m.total_available || 0) - Number(m.reserved_qty || 0)
                                      const rp = Number(m.reorder_point || 0)
                                      if (hasPending) {
                                        return (
                                          <button type="button" onClick={() => setPrModalFor(m)} className="px-4 py-2.5 text-sm inline-flex items-center gap-2 rounded-xl border-2 border-primary-medium text-primary-medium hover:bg-primary-medium hover:text-white transition-all duration-200 font-semibold">
                                            <ClipboardList className="h-4 w-4" /> View PR Details
                                          </button>
                                        )
                                      }
                                      if (net <= rp && canManageInventory) {
                                        return (
                                          <button type="button" disabled={isGenerating} onClick={() => handleReplenishmentClick(m)} className={`px-4 py-2.5 text-sm inline-flex items-center gap-2 rounded-xl border-2 border-primary-medium text-primary-medium hover:bg-primary-medium hover:text-white transition-all duration-200 font-semibold ${isGenerating ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                            <ClipboardList className="h-4 w-4" /> Auto-Generate PR
                                          </button>
                                        )
                                      }
                                      return null
                                    })()}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </>
        )}

        {toast.show && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70]">
            <div className="flex items-center gap-3 bg-white rounded-xl shadow-2xl border border-neutral-soft/40 px-4 py-3 animate-fade-in">
              <div className="w-8 h-8 bg-accent-success/15 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-accent-success" />
              </div>
              <span className="text-sm font-semibold text-neutral-dark">{toast.message}</span>
            </div>
          </div>
        )}

        {/* View Material Modal */}
        {isViewOpen && viewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setIsViewOpen(false)}></div>
            <div className="relative z-10 w-full max-w-5xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-neutral-soft/30 overflow-hidden flex flex-col">
              {/* Enhanced Header */}
              <div className="relative flex items-center justify-between px-10 py-7 
                  bg-gradient-to-r from-neutral-50 via-primary-light/20 to-primary-light/10
                  backdrop-blur-md border-b border-neutral-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]
                  rounded-t-2xl">
                
                {/* Left Section */}
                <div className="flex flex-col">
                  <h2 className="text-2xl font-semibold text-neutral-800 tracking-tight leading-tight">
                    {viewData.product_name}
                  </h2>
                  <p className="text-sm text-neutral-500 leading-snug mt-1">
                    Material Details • Specifications • Documents
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setIsViewOpen(false)}
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
                  {/* Material Information Card */}
                  <div className="mb-8 bg-white rounded-3xl border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
                    {/* Header Section */}
                    <div className="relative bg-gradient-to-r from-slate-50 via-neutral-50 to-slate-50/80 border-b border-neutral-200/60 px-6 py-5">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500/10 to-primary-600/20 rounded-2xl flex items-center justify-center">
                          <Package className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 tracking-tight">Material Specifications</h3>
                          <p className="text-sm text-slate-500 mt-0.5">Complete material information</p>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-neutral-50 to-white p-4 rounded-2xl border border-neutral-200/60">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Category</div>
                          <div className="text-neutral-800 font-medium text-lg">{viewData.category || '—'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-neutral-50 to-white p-4 rounded-2xl border border-neutral-200/60">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Supplier</div>
                          <div className="text-neutral-800 font-medium text-lg">{viewData.supplier_name || '—'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-neutral-50 to-white p-4 rounded-2xl border border-neutral-200/60">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Unit of Measure</div>
                          <div className="text-neutral-800 font-medium text-lg">{viewData.unit_of_measure || '—'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-neutral-50 to-white p-4 rounded-2xl border border-neutral-200/60">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Unit Weight</div>
                          <div className="text-neutral-800 font-medium text-lg">{viewData.unit_weight || '—'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-neutral-50 to-white p-4 rounded-2xl border border-neutral-200/60">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Cost per Unit</div>
                          <div className="text-neutral-800 font-medium text-lg">{viewData.cost_per_unit ? `$${viewData.cost_per_unit}` : '—'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-neutral-50 to-white p-4 rounded-2xl border border-neutral-200/60">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Total Available</div>
                          <div className="text-neutral-800 font-medium text-lg">{viewData.total_available || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Replenishment Settings */}
                  <div className="mb-8 bg-white rounded-3xl border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
                    {/* Header Section */}
                    <div className="relative bg-gradient-to-r from-slate-50 via-neutral-50 to-slate-50/80 border-b border-neutral-200/60 px-6 py-5">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500/10 to-primary-600/20 rounded-2xl flex items-center justify-center">
                          <RefreshCw className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 tracking-tight">Replenishment Settings</h3>
                          <p className="text-sm text-slate-500 mt-0.5">Configure replenishment options</p>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-neutral-50 to-white p-4 rounded-2xl border border-neutral-200/60">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Reorder To Level</div>
                          <div className="text-neutral-800 font-medium text-lg">{viewData.reorder_to_level || '—'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-neutral-50 to-white p-4 rounded-2xl border border-neutral-200/60">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">MOQ</div>
                          <div className="text-neutral-800 font-medium text-lg">{viewData.moq || '—'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-neutral-50 to-white p-4 rounded-2xl border border-neutral-200/60">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">EOQ</div>
                          <div className="text-neutral-800 font-medium text-lg">{viewData.eoq || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Material Documents */}
                  {Array.isArray(viewData.material_file_urls) && viewData.material_file_urls.length > 0 && (
                    <div className="mb-8 bg-white rounded-3xl border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
                      {/* Header Section */}
                      <div className="relative bg-gradient-to-r from-slate-50 via-neutral-50 to-slate-50/80 border-b border-neutral-200/60 px-6 py-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary-500/10 to-primary-600/20 rounded-2xl flex items-center justify-center">
                              <FileText className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-slate-900 tracking-tight">Material Documents</h3>
                              <p className="text-sm text-slate-500 mt-0.5">{viewData.material_file_urls.length} file{viewData.material_file_urls.length !== 1 ? 's' : ''} attached</p>
                            </div>
                          </div>
                          
                          {/* View Toggle */}
                          <div className="inline-flex items-center bg-white rounded-2xl p-1.5 border border-neutral-200 shadow-sm">
                            <button 
                              type="button" 
                              onClick={() => setDocsLayout('list')} 
                              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 min-w-[80px] justify-center ${
                                docsLayout === 'list' 
                                  ? 'bg-blue-500 text-white shadow-lg border-2 border-blue-600' 
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-2 border-transparent'
                              }`}
                              title="List View"
                            >
                              <List className="w-4 h-4 flex-shrink-0" />
                              <span className="whitespace-nowrap font-semibold">List</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setDocsLayout('grid')} 
                              className={`ml-1 flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 min-w-[80px] justify-center ${
                                docsLayout === 'grid' 
                                  ? 'bg-blue-500 text-white shadow-lg border-2 border-blue-600' 
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-2 border-transparent'
                              }`}
                              title="Grid View"
                            >
                              <Grid3X3 className="w-4 h-4 flex-shrink-0" />
                              <span className="whitespace-nowrap font-semibold">Grid</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="p-6">
                        {docsLayout === 'list' ? (
                          <div className="space-y-3">
                            {viewData.material_file_urls.map((url, idx) => (
                              <div key={idx} className="group relative bg-slate-50/50 hover:bg-white border border-slate-200/60 hover:border-primary-200 rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                                    {(() => { 
                                      const meta = getFileMeta(prettyFileName(url)); 
                                      return (
                                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xs font-bold ${meta.cls.replace('bg-', 'bg-').replace('text-', 'text-')} border border-current/20`}>
                                          {meta.label}
                                        </div>
                                      )
                                    })()}
                                    <div className="min-w-0 flex-1">
                                      <button
                                        type="button"
                                        className="block text-left w-full"
                                        onClick={() => {
                                          const lower = url.toLowerCase()
                                          if (lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
                                            window.open(url, '_blank')
                                          } else {
                                            const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`
                                            window.open(viewer, '_blank')
                                          }
                                        }}
                                      >
                                        <h4 className="text-sm font-semibold text-slate-900 group-hover:text-primary-600 truncate transition-colors">
                                          {prettyFileName(url)}
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-1">Click to open in new tab</p>
                                      </button>
                                    </div>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center">
                                      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {viewData.material_file_urls.map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="group relative bg-slate-50/50 hover:bg-white border border-slate-200/60 hover:border-primary-200 rounded-3xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1"
                                onClick={() => {
                                  const lower = url.toLowerCase()
                                  if (lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
                                    window.open(url, '_blank')
                                  } else {
                                    const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`
                                    window.open(viewer, '_blank')
                                  }
                                }}
                              >
                                <div className="flex flex-col items-center text-center">
                                  {(() => {
                                    const fname = prettyFileName(url).toLowerCase()
                                    const ext = fname.includes('.') ? (fname.split('.').pop() || '') : ''
                                    let color = 'text-slate-600'; let bg = 'bg-slate-100'
                                    if (ext === 'pdf') { color = 'text-red-600'; bg = 'bg-red-50' }
                                    else if (ext === 'doc' || ext === 'docx') { color = 'text-blue-600'; bg = 'bg-blue-50' }
                                    else if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') { color = 'text-emerald-600'; bg = 'bg-emerald-50' }
                                    else if (ext === 'ppt' || ext === 'pptx') { color = 'text-orange-600'; bg = 'bg-orange-50' }
                                    return (
                                      <div className={`w-16 h-16 ${bg} rounded-2xl border border-current/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                                        <FileText className={`w-8 h-8 ${color}`} />
                                      </div>
                                    )
                                  })()}
                                  <h4 className="text-sm font-semibold text-slate-900 group-hover:text-primary-600 transition-colors line-clamp-2" title={prettyFileName(url)}>
                                    {prettyFileName(url)}
                                  </h4>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* No Documents Message */}
                  {(!Array.isArray(viewData.material_file_urls) || viewData.material_file_urls.length === 0) && (
                    <div className="text-center py-12">
                      <div className="mx-auto w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                        <Upload className="h-8 w-8 text-neutral-400" />
                      </div>
                      <h3 className="text-lg font-medium text-neutral-900 mb-2">No Documents</h3>
                      <p className="text-neutral-500">This material doesn't have any documents attached.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Material Modal */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !isUpdating && setIsEditOpen(false)}></div>
            <div className="relative z-10 w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Edit Material</h2>
                  <p className="text-sm text-neutral-medium mt-1">Update material details</p>
                </div>
                <button onClick={() => !isUpdating && setIsEditOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!editId || isUpdating) return
                    setIsUpdating(true)
                    try {
                      // Upload any newly added documents and merge with existing
                      let newDocUrls: string[] = []
                      try {
                        if (editDocFiles && editDocFiles.length) {
                          const bucket = 'ERP_storage'
                          const uploads = await Promise.all(
                            editDocFiles.map(async (file) => {
                              const safeName = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '-')
                              const path = `material_docs/${editId}/${safeName}`
                              const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
                                upsert: true,
                                contentType: file.type || 'application/octet-stream',
                              })
                              if (!upErr) {
                                const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
                                let url = pub?.publicUrl || ''
                                if (!url) {
                                  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365)
                                  url = signed?.signedUrl || ''
                                }
                                return url || null
                              }
                              return null
                            })
                          )
                          newDocUrls = uploads.filter((u): u is string => !!u)
                        }
                      } catch {}

                      const payload: any = {
                        product_name: editForm.product_name || null,
                        category: editForm.category || null,
                        supplier_id: editForm.supplier_id || null,
                        supplier_name: editForm.supplier_name || null,
                        unit_of_measure: editForm.unit_of_measure || null,
                        unit_weight: editForm.unit_weight || null,
                        cost_per_unit: editForm.cost_per_unit || null,
                        total_available: editForm.total_available || null,
                        lot_number: editForm.lot_number || null,
                        manufacture_date: editForm.manufacture_date || null,
                        expiry_date: editForm.expiry_date || null,
                        reorder_point: editForm.reorder_point || null,
                        reorder_to_level: editForm.reorder_to_level || null,
                        moq: editForm.moq || null,
                        eoq: editForm.eoq || null,
                        material_file_url: (() => {
                          const base = Array.isArray(editForm.material_file_urls) ? editForm.material_file_urls : []
                          const next = [...base, ...newDocUrls]
                          return next.length ? JSON.stringify(next) : null
                        })(),
                      }
                      const { error } = await supabase.from('inventory_materials').update(payload).eq('id', editId)
                      if (error) throw error
                      setIsEditOpen(false)
                      setToast({ show: true, message: 'Material updated' })
                    } catch (err) {
                      console.error('Failed to update material', err)
                    } finally {
                      setIsUpdating(false)
                    }
                  }}
                  className="p-8 space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><Package className="h-4 w-4 mr-2 text-primary-medium"/>Product Name</label>
                      <input type="text" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.product_name} onChange={(e)=>setEditForm({ ...editForm, product_name: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><Tag className="h-4 w-4 mr-2 text-primary-medium"/>Category</label>
                      <input type="text" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.category} onChange={(e)=>setEditForm({ ...editForm, category: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><User className="h-4 w-4 mr-2 text-primary-medium"/>Supplier Name</label>
                      <input type="text" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.supplier_name} onChange={(e)=>setEditForm({ ...editForm, supplier_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><Scale className="h-4 w-4 mr-2 text-primary-medium"/>Unit of Measure</label>
                      <input type="text" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.unit_of_measure} onChange={(e)=>setEditForm({ ...editForm, unit_of_measure: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><ClipboardList className="h-4 w-4 mr-2 text-primary-medium"/>Unit Weight</label>
                      <input type="text" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.unit_weight} onChange={(e)=>setEditForm({ ...editForm, unit_weight: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><DollarSign className="h-4 w-4 mr-2 text-primary-medium"/>Cost per Unit</label>
                      <input type="text" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.cost_per_unit} onChange={(e)=>setEditForm({ ...editForm, cost_per_unit: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><Inbox className="h-4 w-4 mr-2 text-primary-medium"/>Total Available</label>
                      <input type="text" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.total_available} onChange={(e)=>setEditForm({ ...editForm, total_available: e.target.value })} />
                    </div>
                  </div>
                  {/* Lot Traceability (Edit) */}
                  <div className="mt-2 border-t border-neutral-soft pt-6">
                    <h3 className="text-lg font-semibold text-neutral-dark mb-4">Lot Traceability</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">Lot Number</label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 border border-neutral-soft rounded-lg"
                          value={editForm.lot_number}
                          onChange={(e)=>setEditForm({ ...editForm, lot_number: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">Manufacture Date</label>
                        <input
                          type="date"
                          className="w-full px-4 py-3 border border-neutral-soft rounded-lg"
                          value={editForm.manufacture_date}
                          onChange={(e)=>setEditForm({ ...editForm, manufacture_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">Expiry Date</label>
                        <input
                          type="date"
                          className="w-full px-4 py-3 border border-neutral-soft rounded-lg"
                          value={editForm.expiry_date}
                          onChange={(e)=>setEditForm({ ...editForm, expiry_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Replenishment Settings */}
                  <div className="mt-2 border-t border-neutral-soft pt-6">
                    <h3 className="text-lg font-semibold text-neutral-dark mb-4">Replenishment Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">Reorder Point</label>
                        <input type="number" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.reorder_point} onChange={(e)=>setEditForm({ ...editForm, reorder_point: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">Reorder To Level</label>
                        <input type="number" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.reorder_to_level} onChange={(e)=>setEditForm({ ...editForm, reorder_to_level: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">MOQ</label>
                        <input type="number" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.moq} onChange={(e)=>setEditForm({ ...editForm, moq: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">EOQ</label>
                        <input type="number" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={editForm.eoq} onChange={(e)=>setEditForm({ ...editForm, eoq: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">
                      <Upload className="h-5 w-5 mr-3 text-primary-medium" />
                      Documents
                    </label>
                    <div 
                      className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-300 cursor-pointer ${editDocDragOver ? 'border-primary-light bg-primary-light/10' : 'border-neutral-soft bg-gradient-to-br from-neutral-light/20 to-white hover:from-primary-light/10 hover:to-primary-medium/5'}`}
                      onDragOver={(e) => { e.preventDefault(); setEditDocDragOver(true) }}
                      onDragLeave={() => setEditDocDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setEditDocDragOver(false)
                        const files = Array.from(e.dataTransfer.files || [])
                        if (files.length) setEditDocFiles((prev) => [...prev, ...files])
                      }}
                      onClick={() => editDocInputRef.current?.click()}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-neutral-medium">PDF, DOCX, XLSX, PPTX, TXT</p>
                        <button type="button" onClick={() => editDocInputRef.current?.click()} className="px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-medium shadow-sm">Browse File</button>
                      </div>
                      {(editForm.material_file_urls && editForm.material_file_urls.length > 0) && (
                        <div className="space-y-2 mb-3">
                          {editForm.material_file_urls.map((url, idx) => (
                            <div key={`exist-${idx}`} className="flex items-center justify-between bg-white border border-neutral-soft rounded-lg px-4 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {(() => { const meta = getFileMeta(prettyFileName(url)); return (<span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>) })()}
                                <span className="text-sm text-neutral-dark truncate">{prettyFileName(url)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm" onClick={(e) => { e.stopPropagation(); const lower = url.toLowerCase(); if (lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) { window.open(url, '_blank') } else { const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`; window.open(viewer, '_blank') } }}>View</button>
                                <button type="button" className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm" onClick={async (e) => { e.stopPropagation(); try { const next = editForm.material_file_urls.filter((_, i) => i !== idx); setEditForm((prev) => ({ ...prev, material_file_urls: next })); if (editId) { await supabase.from('inventory_materials').update({ material_file_url: next.length ? JSON.stringify(next) : null }).eq('id', editId) } try { const marker = '/storage/v1/object/public/ERP_storage/'; const at = url.indexOf(marker); if (at >= 0) { const key = url.substring(at + marker.length); if (key) await supabase.storage.from('ERP_storage').remove([key]) } } catch {} } catch {} }}>Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {(editDocFiles.length > 0) && (
                        <div className="space-y-2 mb-3">
                          {editDocFiles.map((f, idx) => (
                            <div key={`new-${idx}`} className="flex items-center justify-between bg-white border border-neutral-soft rounded-lg px-4 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {(() => { const meta = getFileMeta(f.name); return (<span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>) })()}
                                <span className="text-sm text-neutral-dark truncate">{f.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm" onClick={(e) => { e.stopPropagation(); try { const name = (f?.name || '').toLowerCase(); const ext = name.split('.').pop() || ''; const previewable = ['pdf','png','jpg','jpeg']; if (previewable.includes(ext)) { const url = URL.createObjectURL(f); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 5000) } else { alert('Preview is available after saving for this file type.') } } catch {} }}>View</button>
                                <button type="button" className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm" onClick={(e) => { e.stopPropagation(); setEditDocFiles((prev) => prev.filter((_, i) => i !== idx)) }}>Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {((!editForm.material_file_urls || editForm.material_file_urls.length === 0) && editDocFiles.length === 0) && (
                        <div className="text-center py-4">
                          <div className="mx-auto w-10 h-10 bg-primary-light/20 rounded-full flex items-center justify-center mb-2">
                            <Upload className="h-5 w-5 text-primary-medium" />
                          </div>
                          <p className="text-sm text-neutral-dark font-semibold">Drag & drop file here, or click to upload</p>
                          <p className="text-xs text-neutral-medium">Max size depends on storage policy</p>
                        </div>
                      )}
                      <input ref={editDocInputRef} type="file" multiple onChange={(e)=> setEditDocFiles(Array.from(e.target.files || []))} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*" className="hidden" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md disabled:opacity-60" disabled={isUpdating}>
                      {isUpdating ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {isDeleteOpen && deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setIsDeleteOpen(false)}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-soft/40">
                <div className="text-lg font-semibold text-neutral-dark">Delete Material</div>
              </div>
              <div className="p-6 text-sm text-neutral-dark">
                Are you sure you want to delete "{deleteTarget.product_name}"? This action cannot be undone.
              </div>
              <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-soft/40">
                <button onClick={() => !deleting && setIsDeleteOpen(false)} className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark">Cancel</button>
                <button
                  onClick={async () => {
                    if (deleting) return
                    setDeleting(true)
                    try {
                      const { error } = await supabase.from('inventory_materials').delete().eq('id', deleteTarget.id)
                      if (error) throw error
                      setIsDeleteOpen(false)
                      setToast({ show: true, message: 'Material deleted' })
                    } catch (err) {
                      console.error('Failed to delete material', err)
                    } finally {
                      setDeleting(false)
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-accent-danger text-white"
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Add Raw Material Modal */}
        {isAddRawOpen && mainTab==='raw' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setIsAddRawOpen(false); setHasAttemptedSubmit(false) }}></div>
            <div className="relative z-10 w-full max-w-5xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Add New Raw Material</h2>
                  <p className="text-sm text-neutral-medium mt-1">Create a new material for your inventory</p>
                </div>
                <button onClick={() => { setIsAddRawOpen(false); setHasAttemptedSubmit(false) }} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (isSavingRaw) return
                    
                    // Mark that user has attempted to submit
                    setHasAttemptedSubmit(true)
                    
                    // Validate Total Available field
                    if (!rawForm.totalAvailable || rawForm.totalAvailable.trim() === '') {
                      const totalAvailableField = document.querySelector('[data-field="totalAvailable"]') as HTMLElement
                      if (totalAvailableField) {
                        totalAvailableField.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        totalAvailableField.focus()
                      }
                      return
                    }

                    // Validate Lot Traceability fields
                    if (!rawForm.lotNumber || rawForm.lotNumber.trim() === '') {
                      const lotNumberField = document.querySelector('[data-field="lotNumber"]') as HTMLElement
                      if (lotNumberField) {
                        lotNumberField.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        lotNumberField.focus()
                      }
                      return
                    }
                    if (!rawForm.manufactureDate || rawForm.manufactureDate.trim() === '') {
                      const manufactureDateField = document.querySelector('[data-field="manufactureDate"]') as HTMLElement
                      if (manufactureDateField) {
                        manufactureDateField.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        manufactureDateField.focus()
                      }
                      return
                    }
                    if (!rawForm.expiryDate || rawForm.expiryDate.trim() === '') {
                      const expiryDateField = document.querySelector('[data-field="expiryDate"]') as HTMLElement
                      if (expiryDateField) {
                        expiryDateField.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        expiryDateField.focus()
                      }
                      return
                    }
                    
                    setIsSavingRaw(true)
                    try {
                      const category = (rawForm.newCategory || '').trim() || rawForm.category || null
                      const id = (window.crypto && 'randomUUID' in window.crypto)
                        ? (window.crypto as any).randomUUID()
                        : `mat_${Date.now()}_${Math.random().toString(36).slice(2,8)}`

                      // Upload selected documents first
                      let docUrls: string[] = []
                      if (supabase && rawForm.docFiles.length) {
                        const bucket = 'ERP_storage'
                        const folder = `material_docs/${id}`
                        const uploads = await Promise.all(
                          rawForm.docFiles.map(async (file) => {
                            const safeName = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '-')
                            const path = `${folder}/${safeName}`
                            const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
                              upsert: true,
                              contentType: file.type || 'application/octet-stream',
                            })
                            if (upErr) {
                              console.error('Doc upload error:', upErr.message)
                              return null
                            }
                            const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
                            let url = pub?.publicUrl || null
                            if (!url) {
                              const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365)
                              url = signed?.signedUrl || null
                            }
                            return url || null
                          })
                        )
                        docUrls = uploads.filter((u): u is string => !!u)
                      }

                      const payload: any = {
                        id,
                        product_name: rawForm.name || null,
                        category,
                        supplier_id: rawForm.supplierId || null,
                        supplier_name: rawForm.supplier || null,
                        unit_of_measure: rawForm.uom || null,
                        unit_weight: rawForm.unitWeight ? String(rawForm.unitWeight) : null,
                        cost_per_unit: rawForm.costPerUnit ? String(rawForm.costPerUnit) : null,
                        total_available: rawForm.totalAvailable ? String(rawForm.totalAvailable) : null,
                        lot_number: rawForm.lotNumber || null,
                        manufacture_date: rawForm.manufactureDate || null,
                        expiry_date: rawForm.expiryDate || null,
                        reorder_point: rawForm.reorderPoint || null,
                        reorder_to_level: rawForm.reorderToLevel || null,
                        moq: rawForm.moq || null,
                        eoq: rawForm.eoq || null,
                        material_file_url: docUrls.length ? JSON.stringify(docUrls) : null,
                      }
                      const { error } = await supabase.from('inventory_materials').insert(payload)
                      if (error) throw error
                      const cleanedName = String(rawForm.name || '').trim()
                      const catLower = String(category || '').trim().toLowerCase()
                      const tabLabel = catLower === 'packaging' ? 'Packaging' : 'Raw Materials'
                      setToast({ show: true, message: `${cleanedName || 'Material'} added. View it in ${tabLabel} tab.` })
                      setIsAddRawOpen(false)
                      setHasAttemptedSubmit(false)
                      setRawForm({ name: '', category: '', newCategory: '', supplier: '', supplierId: '', uom: 'Kilograms (kg)', unitWeight: '', costPerUnit: '', totalAvailable: '', lotNumber: '', manufactureDate: '', expiryDate: '', reorderPoint: '', reorderToLevel: '', moq: '', eoq: '', docFiles: [] })
                    } catch (err) {
                      console.error('Failed to insert inventory material', err)
                    } finally {
                      setIsSavingRaw(false)
                    }
                  }}
                  className="p-8 space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><Package className="h-4 w-4 mr-2 text-primary-medium"/>Product Name</label>
                      <input type="text" placeholder="e.g., Roasted Peanuts" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium" value={rawForm.name} onChange={(e)=>setRawForm({...rawForm, name:e.target.value})} required />
                    </div>
                    <div className="space-y-2" ref={categoryRef}>
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><Tag className="h-4 w-4 mr-2 text-primary-medium"/>Category</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCategoryOpen((v) => !v)}
                          className="col-span-2 w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                        >
                          <span className={rawForm.category ? 'text-neutral-dark' : 'text-neutral-medium'}>
                            {rawForm.category || 'Select Category'}
                          </span>
                          <span className="ml-2 text-neutral-medium">▼</span>
                        </button>
                        <button type="button" className="px-3 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm">+ New</button>
                        {isCategoryOpen && (
                          <div className="col-span-3 relative">
                            <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                              <div className="px-3 py-2 text-xs text-neutral-medium">Select Category</div>
                              {rawCategories.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${rawForm.category===c ? 'bg-neutral-light' : ''}`}
                                  onClick={() => { setRawForm({ ...rawForm, category: c }); setIsCategoryOpen(false) }}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <input type="text" placeholder="Or type new category" className="col-span-2 w-full px-3 py-3 border border-neutral-soft rounded-lg bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={rawForm.newCategory} onChange={(e)=>setRawForm({...rawForm, newCategory:e.target.value})} />
                        <button type="button" className="px-3 py-2 rounded-lg border border-neutral-soft hover:border-neutral-medium text-neutral-dark text-sm">Add</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2" ref={supplierRef}>
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><User className="h-4 w-4 mr-2 text-primary-medium"/>Supplier</label>
                      <button
                        type="button"
                        onClick={() => { if (!suppliersLoading && suppliers.length>0) setIsSupplierOpen((v)=>!v) }}
                        disabled={suppliersLoading || suppliers.length===0}
                        className={`w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all ${(suppliersLoading || suppliers.length===0) ? 'opacity-60 cursor-not-allowed' : 'hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light'}`}
                      >
                        <span className={rawForm.supplier ? 'text-neutral-dark' : 'text-neutral-medium'}>
                          {suppliersLoading ? 'Loading suppliers...' : (rawForm.supplier || 'Select Supplier')}
                        </span>
                        <span className="ml-2 text-neutral-medium">▼</span>
                      </button>
                      {suppliersError && (
                        <p className="text-xs text-accent-danger">{suppliersError}</p>
                      )}
                      {(!suppliersLoading && suppliers.length===0 && !suppliersError) && (
                        <p className="text-xs text-accent-danger">No suppliers found. Add suppliers first in the Suppliers section.</p>
                      )}
                      {isSupplierOpen && (
                        <div className="relative">
                          <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                            <div className="px-3 py-2 text-xs text-neutral-medium">Select Supplier</div>
                            {suppliers.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${rawForm.supplier===s.name ? 'bg-neutral-light' : ''}`}
                                onClick={() => { setRawForm({ ...rawForm, supplier: s.name, supplierId: s.id }); setIsSupplierOpen(false) }}
                              >
                                {s.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2" ref={uomRef}>
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><Scale className="h-4 w-4 mr-2 text-primary-medium"/>Unit of Measure</label>
                      <button
                        type="button"
                        onClick={() => setIsUomOpen((v)=>!v)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        <span className={rawForm.uom ? 'text-neutral-dark' : 'text-neutral-medium'}>
                          {rawForm.uom || 'Select UoM'}
                        </span>
                        <span className="ml-2 text-neutral-medium">▼</span>
                      </button>
                      {isUomOpen && (
                        <div className="relative">
                          <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                            <div className="px-3 py-2 text-xs text-neutral-medium">Select Unit of Measure</div>
                            {uoms.map((u) => (
                              <button
                                key={u}
                                type="button"
                                className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${rawForm.uom===u ? 'bg-neutral-light' : ''}`}
                                onClick={() => { setRawForm({ ...rawForm, uom: u }); setIsUomOpen(false) }}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><Box className="h-4 w-4 mr-2 text-primary-medium"/>Unit Weight</label>
                      <input type="number" placeholder="Weight per unit" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium" value={rawForm.unitWeight} onChange={(e)=>setRawForm({...rawForm, unitWeight:e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark"><DollarSign className="h-4 w-4 mr-2 text-primary-medium"/>Cost per Unit ($)</label>
                      <input type="number" step="0.01" placeholder="0.00" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium" value={rawForm.costPerUnit} onChange={(e)=>setRawForm({...rawForm, costPerUnit:e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">
                      <ClipboardList className="h-4 w-4 mr-2 text-primary-medium"/>
                      Total Available <span className="text-accent-danger ml-1">*</span>
                    </label>
                    <input 
                      type="number" 
                      placeholder="Enter quantity (required)" 
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium ${hasAttemptedSubmit && (!rawForm.totalAvailable || rawForm.totalAvailable.trim() === '') ? 'border-accent-danger' : 'border-neutral-soft'}`}
                      value={rawForm.totalAvailable} 
                      onChange={(e)=>setRawForm({...rawForm, totalAvailable:e.target.value})}
                      data-field="totalAvailable"
                      required
                    />
                    {(hasAttemptedSubmit && (!rawForm.totalAvailable || rawForm.totalAvailable.trim() === '')) && (
                      <p className="text-xs text-accent-danger">Total Available quantity is required</p>
                    )}
                  </div>

                  {/* Lot Traceability Section */}
                  <div className="border-t border-neutral-soft pt-6">
                    <h3 className="text-lg font-semibold text-neutral-dark mb-4 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-primary-medium"/>
                      Lot Traceability
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-neutral-dark">Lot Number <span className="text-accent-danger ml-1">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g., LOT-2024-001" 
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium ${hasAttemptedSubmit && (!rawForm.lotNumber || rawForm.lotNumber.trim() === '') ? 'border-accent-danger' : 'border-neutral-soft'}`}
                          value={rawForm.lotNumber} 
                          onChange={(e)=>setRawForm({...rawForm, lotNumber:e.target.value})} 
                          data-field="lotNumber"
                          required
                        />
                        {(hasAttemptedSubmit && (!rawForm.lotNumber || rawForm.lotNumber.trim() === '')) && (
                          <p className="text-xs text-accent-danger">Lot Number is required</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-neutral-dark">Manufacture Date <span className="text-accent-danger ml-1">*</span></label>
                        <input 
                          type="date" 
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium ${hasAttemptedSubmit && (!rawForm.manufactureDate || rawForm.manufactureDate.trim() === '') ? 'border-accent-danger' : 'border-neutral-soft'}`}
                          value={rawForm.manufactureDate} 
                          onChange={(e)=>setRawForm({...rawForm, manufactureDate:e.target.value})} 
                          data-field="manufactureDate"
                          required
                        />
                        {(hasAttemptedSubmit && (!rawForm.manufactureDate || rawForm.manufactureDate.trim() === '')) && (
                          <p className="text-xs text-accent-danger">Manufacture Date is required</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-neutral-dark">Expiry Date <span className="text-accent-danger ml-1">*</span></label>
                        <input 
                          type="date" 
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium ${hasAttemptedSubmit && (!rawForm.expiryDate || rawForm.expiryDate.trim() === '') ? 'border-accent-danger' : 'border-neutral-soft'}`}
                          value={rawForm.expiryDate} 
                          onChange={(e)=>setRawForm({...rawForm, expiryDate:e.target.value})} 
                          data-field="expiryDate"
                          required
                        />
                        {(hasAttemptedSubmit && (!rawForm.expiryDate || rawForm.expiryDate.trim() === '')) && (
                          <p className="text-xs text-accent-danger">Expiry Date is required</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Replenishment Settings (Add) */}
                  <div className="border-t border-neutral-soft pt-6 mt-4">
                    <h3 className="text-lg font-semibold text-neutral-dark mb-4">Replenishment Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">Reorder Point</label>
                        <input type="number" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={rawForm.reorderPoint} onChange={(e)=>setRawForm({...rawForm, reorderPoint:e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">Reorder To Level</label>
                        <input type="number" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={rawForm.reorderToLevel} onChange={(e)=>setRawForm({...rawForm, reorderToLevel:e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">MOQ</label>
                        <input type="number" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={rawForm.moq} onChange={(e)=>setRawForm({...rawForm, moq:e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-dark">EOQ</label>
                        <input type="number" className="w-full px-4 py-3 border border-neutral-soft rounded-lg" value={rawForm.eoq} onChange={(e)=>setRawForm({...rawForm, eoq:e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">
                      <Upload className="h-4 w-4 mr-2 text-primary-medium"/>
                      Upload Documents
                    </label>
                    <div 
                      className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-300 cursor-pointer ${addDocDragOver ? 'border-primary-light bg-primary-light/10' : 'border-neutral-soft bg-gradient-to-br from-neutral-light/20 to-white hover:from-primary-light/10 hover:to-primary-medium/5'}`}
                      onDragOver={(e) => { e.preventDefault(); setAddDocDragOver(true) }}
                      onDragLeave={() => setAddDocDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setAddDocDragOver(false)
                        const files = Array.from(e.dataTransfer.files || [])
                        if (files.length) setRawForm((prev) => ({...prev, docFiles: [...prev.docFiles, ...files]}))
                      }}
                      onClick={() => addDocInputRef.current?.click()}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-neutral-medium">PDF, DOCX, XLSX, PPTX, TXT, Images</p>
                        <button type="button" onClick={() => addDocInputRef.current?.click()} className="px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-medium shadow-sm">Browse File</button>
                      </div>
                      {rawForm.docFiles.length === 0 ? (
                        <div onClick={() => addDocInputRef.current?.click()} className="text-center py-8 cursor-pointer">
                          <div className="mx-auto w-10 h-10 bg-primary-light/20 rounded-full flex items-center justify-center mb-2">
                            <Upload className="h-5 w-5 text-primary-medium" />
                          </div>
                          <p className="text-sm text-neutral-dark font-semibold">Drag & drop file here, or click to upload</p>
                          <p className="text-xs text-neutral-medium">Max size depends on storage policy</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {rawForm.docFiles.map((f, i) => (
                            <div key={`sel-${i}`} className="flex items-center justify-between bg-white border border-neutral-soft rounded-lg px-4 py-3">
                              <span className="text-sm text-neutral-dark truncate mr-3">{f.name}</span>
                              <button type="button" className="px-2 py-1 text-xs rounded-md border border-neutral-soft hover:bg-white" onClick={() => setRawForm((prev)=> ({...prev, docFiles: prev.docFiles.filter((_, idx)=> idx!==i)}))}>Remove</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <input ref={addDocInputRef} type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*" onChange={(e)=> setRawForm((prev)=> ({...prev, docFiles: Array.from(e.target.files || [])}))} />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isSavingRaw}
                      className={`px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white shadow ${isSavingRaw ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {isSavingRaw ? 'Creating…' : 'Create Material'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Inventory
   