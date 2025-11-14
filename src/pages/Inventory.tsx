import React, { useState, useEffect, useRef } from 'react'
import { Plus, Package, Box, Factory, LineChart, Inbox, Landmark, X, Tag, User, Scale, DollarSign, ClipboardList, Eye, Edit, Trash2, CheckCircle2, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
  total_available?: string | null
  created_at?: string | null
}

const Inventory: React.FC = () => {
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
  })
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false)
  const [deleteTarget, setDeleteTarget] = useState<RawMaterial | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  // Finished goods state
  const [fg, setFg] = useState<Array<{ id: string; product_name: string; available_qty: number; reserved_qty: number; location?: string | null; reorder_point?: number | null; updated_at?: string | null }>>([])
  const [fgLoading, setFgLoading] = useState<boolean>(false)
  const [fgRefreshing, setFgRefreshing] = useState<boolean>(false)
  const [fgError, setFgError] = useState<string | null>(null)
  const [fgLastSynced, setFgLastSynced] = useState<string>('')
  const [highlightedRows, setHighlightedRows] = useState<Record<string, number>>({})
  const [recentlyAllocated, setRecentlyAllocated] = useState<Record<string, boolean>>({})
  const [fgBanner, setFgBanner] = useState<{ show: boolean; count: number; poNumber?: string | null }>({ show: false, count: 0, poNumber: null })
  const [fgPoMap, setFgPoMap] = useState<Record<string, { po_id: string; customer_name: string }>>({})
  // Reservation history modal state
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false)
  const [historyData, setHistoryData] = useState<Array<{ po_id: string; line_id: string; qty: number; created_at: string }>>([])
  const [historyLoading, setHistoryLoading] = useState<boolean>(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null)
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
  })
  const rawCategories = ['Ingredient', 'Packaging', 'Additive']
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState<boolean>(true)
  const [suppliersError, setSuppliersError] = useState<string | null>(null)
  const uoms = ['Kilograms (kg)', 'Grams (g)', 'Pounds (lbs)', 'Ounces (oz)', 'Pieces', 'Bottles', 'Boxes', 'Liters (L)']
  const categoryRef = useRef<HTMLDivElement>(null)
  const supplierRef = useRef<HTMLDivElement>(null)
  const uomRef = useRef<HTMLDivElement>(null)

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
          setHistoryData((data as any[]) || [])
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
        .select('id, product_name, available_qty, reserved_qty, location, updated_at')
        .order('product_name', { ascending: true, nullsFirst: true })

      if (error) {
        setFg([])
        setFgError('Cannot load finished goods')
        setFgLoading(false)
        setFgRefreshing(false)
        return
      }

      const items = (data ?? []).map((r: any) => ({
        id: String(r.id),
        product_name: String(r.product_name ?? ''),
        available_qty: Number(r.available_qty ?? 0),
        reserved_qty: Number(r.reserved_qty ?? 0),
        location: r.location ?? null,
        updated_at: r.updated_at ?? null,
      }))

      setFg(items)
      // Fetch latest PO and customer for these products
      try {
        const names = Array.from(new Set(items.map((i) => i.product_name).filter(Boolean)))
        if (names.length) {
          const { data: pol } = await supabase
            .from('purchase_order_lines')
            .select('purchase_order_id, product_name, created_at, update_at')
            .in('product_name', names)
          const poIds = Array.from(new Set((pol ?? []).map((l: any) => String(l.purchase_order_id)).filter(Boolean)))
          let poRows: any[] = []
          if (poIds.length) {
            const { data: poData } = await supabase
              .from('purchase_orders')
              .select('id, customer_name, status, created_at')
              .in('id', poIds)
            poRows = poData ?? []
          }
          const poIndex = new Map(poRows.map((p: any) => [String(p.id), p]))
          const map: Record<string, { po_id: string; customer_name: string }> = {}
          ;(pol ?? []).sort((a: any, b: any) => new Date(b.update_at || b.created_at || 0).getTime() - new Date(a.update_at || a.created_at || 0).getTime())
            .forEach((l: any) => {
              const p = poIndex.get(String(l.purchase_order_id))
              if (!p) return
              const st = String(p.status || '').toLowerCase()
              if (st === 'canceled' || st === 'closed') return
              const key = String(l.product_name || '')
              if (!map[key]) map[key] = { po_id: String(p.id), customer_name: String(p.customer_name || '') }
            })
          setFgPoMap(map)
        } else {
          setFgPoMap({})
        }
      } catch {
        setFgPoMap({})
      }
      setFgLoading(false)
      setFgRefreshing(false)
      setFgLastSynced(new Date().toLocaleString())
    } catch {
      setFg([])
      setFgError('Cannot load finished goods')
      setFgLoading(false)
      setFgRefreshing(false)
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
      .select('id, product_name, category, supplier_id, supplier_name, unit_of_measure, unit_weight, cost_per_unit, total_available, reserved_qty, created_at')
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
        total_available: r.total_available ?? null,
        reserved_qty: r.reserved_qty ?? 0,   // ✅ ADD THIS
        created_at: r.created_at ?? null,
      }))
      setMaterials(mapped)
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

  

  const titleByTab = {
    raw: 'Raw Materials',
    packaging: 'Packaging Management',
    finished: 'Finished Goods',
  } as const

  const addLabelByTab = {
    raw: 'Add Raw Material',
    packaging: 'Update Inventory',
    finished: 'Add Finished Good',
  } as const

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-dark mb-2">Inventory Management</h1>
            <p className="text-neutral-medium text-lg">Manage raw materials, packaging, and finished goods inventory</p>
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
            <p className="text-neutral-medium">{mainTab === 'raw' ? 'Manage ingredients and forecast consumption' : mainTab === 'packaging' ? 'Track packaging materials and forecast needs' : 'Track your completed products ready for shipment'}</p>
          </div>
          <div className="flex items-center gap-2">
            {(mainTab === 'raw' || mainTab === 'packaging') && (
              <button className="inline-flex items-center gap-2 border border-neutral-soft rounded-lg px-4 py-2 text-sm bg-white hover:border-neutral-medium hover:bg-neutral-light/40 text-neutral-dark">
                <LineChart className="h-4 w-4 text-primary-medium" /> {mainTab === 'packaging' ? 'Generate Monthly Forecast' : 'Generate Forecast'}
              </button>
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
                  <div className="p-6 text-center text-accent-danger text-sm">{historyError}</div>
                ) : historyData.length === 0 ? (
                  <div className="p-6 text-center text-neutral-medium text-sm">No reservation history found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                          <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">PO Number</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Line ID</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Quantity Reserved</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Date Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-soft/20">
                        {historyData.map((h, i) => (
                          <tr key={i} className="group">
                            <td className="px-6 py-3 text-sm text-neutral-dark">{h.po_id}</td>
                            <td className="px-6 py-3 text-sm text-neutral-dark">{h.line_id}</td>
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
            {mainTab !== 'finished' && (
              <button onClick={() => { if (mainTab==='raw') setIsAddRawOpen(true) }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow-md">
                <Plus className="h-4 w-4" /> {addLabelByTab[mainTab]}
              </button>
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
                Raw Materials ({materials.length})
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
        {mainTab === 'raw' && subTab === 'forecast' ? (
          <div className="bg-white rounded-2xl border border-neutral-soft/20 shadow-md p-14 flex flex-col items-center justify-center">
            <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
              <LineChart className="h-8 w-8 text-primary-medium" />
            </div>
            <div className="text-neutral-dark font-semibold mb-1">No forecasts available</div>
            <p className="text-sm text-neutral-medium mb-6 text-center">Generate monthly raw material forecasts to optimize planning.</p>
            <button className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow">
              <Plus className="h-4 w-4" /> Generate First Forecast
            </button>
          </div>
        ) : mainTab === 'packaging' && subTab === 'forecast' ? (
          <div className="bg-white rounded-2xl border border-neutral-soft/20 shadow-md p-14 flex flex-col items-center justify-center">
            <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
              <LineChart className="h-8 w-8 text-primary-medium" />
            </div>
            <div className="text-neutral-dark font-semibold mb-1">No forecasts available</div>
            <p className="text-sm text-neutral-medium mb-6 text-center">Generate monthly packaging forecasts to optimize planning.</p>
            <button className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow">
              <Plus className="h-4 w-4" /> Generate Monthly Forecast
            </button>
          </div>
        ) : mainTab === 'finished' ? (
          <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-dark">Finished Goods Inventory</h3>
                <button onClick={async () => { setFgRefreshing(true); await loadFinished() }} className="px-3 py-2 text-sm border border-neutral-soft rounded-lg hover:bg-neutral-light/40 min-w-[120px] flex items-center justify-center gap-2">
                  {fgRefreshing ? <span className="animate-spin inline-block w-4 h-4 border-2 border-primary-medium border-t-transparent rounded-full" /> : null}
                  <span>{fgRefreshing ? 'Refreshing…' : 'Refresh Inventory'}</span>
                </button>
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
                <table className="min-w-full table-fixed">
                  <thead>
                    <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                      <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider whitespace-nowrap">Product</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider whitespace-nowrap">Location</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider whitespace-nowrap w-28">Available Qty</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider whitespace-nowrap w-28">Reserved Qty</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-neutral-dark uppercase tracking-wider whitespace-nowrap w-32">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider whitespace-nowrap">Customer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-soft/20">
                    {fg.map(item => {
                      const allocated = Number(item.reserved_qty || 0)
                      const key = item.product_name || item.id
                      const highlighted = highlightedRows[key] !== undefined
                      const hasStock = Number(item.available_qty || 0) > 0
                      const status = hasStock ? 'Sufficient' : 'No Stock'
                      const statusColor = hasStock ? 'text-emerald-600' : 'text-accent-danger'
                      return (
                        <tr key={item.id} className={`transition ${highlighted ? 'ring-2 ring-teal-400/70 ring-offset-2 ring-offset-teal-50 bg-teal-50/30' : 'hover:bg-neutral-light/20'}`}>
                          <td className="px-6 py-4 text-sm text-neutral-dark font-medium flex items-center gap-2 whitespace-nowrap">
                            {item.product_name}
                            {recentlyAllocated[key] && highlighted && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-300">Recently Allocated</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-dark whitespace-nowrap">{item.location || '—'}</td>
                          <td className="px-6 py-4 text-sm text-neutral-dark text-right whitespace-nowrap">{item.available_qty}</td>
                          <td className="px-6 py-4 text-sm text-neutral-dark text-right whitespace-nowrap">{allocated}</td>
                          <td className={`px-6 py-4 text-sm font-medium text-center whitespace-nowrap ${statusColor}`}>{status}</td>
                          <td className="px-6 py-4 text-sm text-neutral-dark whitespace-nowrap">{fgPoMap[item.product_name]?.customer_name || '—'}</td>
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
          </div>
        ) : (
          <>
            {mainTab === 'packaging' && subTab === 'list' ? (
              <div className="bg-white rounded-2xl border border-neutral-soft/20 shadow-md p-14 flex flex-col items-center justify-center">
                <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
                  <Landmark className="h-8 w-8 text-primary-medium" />
                </div>
                <div className="text-neutral-dark font-semibold mb-1">No inventory records found</div>
                <p className="text-sm text-neutral-medium mb-6 text-center">Start tracking your inventory by updating stock levels.</p>
                <button className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow">
                  <Plus className="h-4 w-4" /> Update Inventory
                </button>
              </div>
            ) : (
              materialsLoading || materials.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-soft/20 shadow-md p-12 flex flex-col items-center justify-center">
                  <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
                    <Inbox className="h-8 w-8 text-primary-medium" />
                  </div>
                  <div className="text-neutral-dark font-semibold mb-1">{materialsLoading ? 'Loading raw materials...' : 'No raw materials found'}</div>
                  {!materialsLoading && (
                    <>
                      <p className="text-sm text-neutral-medium mb-6">Add a new item to track your inventory.</p>
                      <button onClick={() => { if (mainTab==='raw') setIsAddRawOpen(true) }} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow">
                        <Plus className="h-4 w-4" /> Add Your First Raw Material
                      </button>
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
                        {materials.map((m) => (
                          <tr key={m.id} className="hover:bg-neutral-light/20 transition">
                            <td className="px-6 py-4 text-sm text-neutral-dark font-medium">{m.product_name}</td>
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
                            <td className="px-6 py-4 text-sm text-neutral-dark">{Number(m.total_available || 0) - Number(((m as any).reserved_qty ?? 0))}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button type="button" onClick={() => { setViewData(m); setIsViewOpen(true) }} className="p-2 text-primary-medium hover:text-white hover:bg-primary-medium rounded-lg border border-primary-light/30">
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => { setEditId(m.id); setEditForm({
                                  product_name: m.product_name || '',
                                  category: m.category || '',
                                  supplier_id: m.supplier_id || '',
                                  supplier_name: m.supplier_name || '',
                                  unit_of_measure: m.unit_of_measure || '',
                                  unit_weight: m.unit_weight || '',
                                  cost_per_unit: m.cost_per_unit || '',
                                  total_available: m.total_available || '',
                                }); setIsEditOpen(true) }} className="p-2 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-lg border border-neutral-soft">
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => { setDeleteTarget(m); setIsDeleteOpen(true) }} className="p-2 text-accent-danger hover:text-white hover:bg-accent-danger rounded-lg border border-accent-danger/30">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
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
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsViewOpen(false)}></div>
            <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">View Material</h2>
                  <p className="text-sm text-neutral-medium mt-1">Material information overview</p>
                </div>
                <button onClick={() => setIsViewOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all">✕</button>
              </div>
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Product</div>
                    <div className="text-neutral-dark font-semibold">{viewData.product_name}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Category</div>
                    <div className="text-neutral-dark">{viewData.category || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Supplier</div>
                    <div className="text-neutral-dark">{viewData.supplier_name || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">UoM</div>
                    <div className="text-neutral-dark">{viewData.unit_of_measure || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Unit Weight</div>
                    <div className="text-neutral-dark">{viewData.unit_weight || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Cost/Unit</div>
                    <div className="text-neutral-dark">{viewData.cost_per_unit || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Total Available</div>
                    <div className="text-neutral-dark">{viewData.total_available || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Material Modal */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !isUpdating && setIsEditOpen(false)}></div>
            <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
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
                      const payload: any = {
                        product_name: editForm.product_name || null,
                        category: editForm.category || null,
                        supplier_id: editForm.supplier_id || null,
                        supplier_name: editForm.supplier_name || null,
                        unit_of_measure: editForm.unit_of_measure || null,
                        unit_weight: editForm.unit_weight || null,
                        cost_per_unit: editForm.cost_per_unit || null,
                        total_available: editForm.total_available || null,
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
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsAddRawOpen(false)}></div>
            <div className="relative z-10 w-full max-w-5xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Add New Raw Material</h2>
                  <p className="text-sm text-neutral-medium mt-1">Create a new material for your inventory</p>
                </div>
                <button onClick={() => setIsAddRawOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (isSavingRaw) return
                    setIsSavingRaw(true)
                    try {
                      const category = (rawForm.newCategory || '').trim() || rawForm.category || null
                      const payload: any = {
                        product_name: rawForm.name || null,
                        category,
                        supplier_id: rawForm.supplierId || null,
                        supplier_name: rawForm.supplier || null,
                        unit_of_measure: rawForm.uom || null,
                        unit_weight: rawForm.unitWeight ? String(rawForm.unitWeight) : null,
                        cost_per_unit: rawForm.costPerUnit ? String(rawForm.costPerUnit) : null,
                        total_available: rawForm.totalAvailable ? String(rawForm.totalAvailable) : null,
                      }
                      const { error } = await supabase.from('inventory_materials').insert(payload)
                      if (error) throw error
                      setIsAddRawOpen(false)
                      setRawForm({ name: '', category: '', newCategory: '', supplier: '', supplierId: '', uom: 'Kilograms (kg)', unitWeight: '', costPerUnit: '', totalAvailable: '' })
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
                    <label className="flex items-center text-sm font-medium text-neutral-dark"><ClipboardList className="h-4 w-4 mr-2 text-primary-medium"/>Total Available</label>
                    <input type="number" placeholder="Can be added later with the pencil icon" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium" value={rawForm.totalAvailable} onChange={(e)=>setRawForm({...rawForm, totalAvailable:e.target.value})} />
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
