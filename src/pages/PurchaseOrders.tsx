import React, { useEffect, useRef, useState } from 'react'
import { Plus, X, User, Package, Calendar, FileText, Eye, Pencil, Trash2, MapPin, BadgeCheck, Search, Filter, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Status } from '../domain/enums'

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
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  const [isAllocOpen, setIsAllocOpen] = useState(false)
  const [allocSummary, setAllocSummary] = useState<any | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    date: '',
    customer: '',
    product: '',
    packagingType: '',
    requestedShipDate: '',
    quantity: '',
    caseQty: '',
    notes: '',
    invoice: '',
    paymentTerms: '',
    status: 'Open',
    comments: '',
    location: ''
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

  const validate = (): { ok: boolean; msg?: string } => {
    if (!form.customer) return { ok: false, msg: 'Customer is required' }
    if (!form.product) return { ok: false, msg: 'Product/SKU is required' }
    if (!form.quantity || Number(form.quantity) <= 0) return { ok: false, msg: 'Quantity must be greater than 0' }
    if (!form.requestedShipDate) return { ok: false, msg: 'Requested ship date is required' }
    if (!form.location) return { ok: false, msg: 'Location is required' }
    const customer = customers.find(c => c.name === form.customer)
    if (customer && (customer.credit_hold || (customer.overdue_balance ?? 0) > 0)) {
      setForm({ ...form, status: Status.OnHold })
    }
    const prod = products.find(p => p.name === form.product)
    if (prod?.is_discontinued) {
      return { ok: false, msg: `Product is discontinued. Suggested substitute: ${prod.substitute_sku || 'N/A'}` }
    }
    return { ok: true }
  }

  const resetForm = () => {
    setForm({
      date: '',
      customer: '',
      product: '',
      packagingType: '',
      requestedShipDate: '',
      quantity: '',
      caseQty: '',
      notes: '',
      invoice: '',
      paymentTerms: '',
      status: 'Open',
      comments: '',
      location: ''
    })
  }

  const saveOrder = async () => {
    setError(null)
    const wasEdit = !!isEditOpen?.id
    const v = validate()
    if (!v.ok) { setError(v.msg || 'Validation failed'); return }
    const isRush = (() => {
      const today = new Date()
      const req = new Date(form.requestedShipDate)
      const diff = Math.ceil((req.getTime() - new Date(today.toDateString()).getTime()) / (1000*60*60*24))
      return diff >= 0 && diff <= 3
    })()
    const customer = customers.find(c => c.name === form.customer)
    const prod = products.find(p => p.name === form.product)
    const willHold = !!(customer && (customer.credit_hold || (customer.overdue_balance ?? 0) > 0))
    const row = {
      date: form.date || null,
      customer_id: customer?.id || null,
      customer_name: form.customer || null,
      product_id: prod?.id || null,
      product_name: form.product || null,
      packaging_type: form.packagingType || null,
      requested_ship_date: form.requestedShipDate || null,
      quantity: Number(form.quantity),
      case_qty: form.caseQty ? Number(form.caseQty) : null,
      notes: form.notes || null,
      invoice: form.invoice || null,
      payment_terms: form.paymentTerms || null,
      status: willHold ? Status.OnHold : form.status,
      comments: form.comments || null,
      location: form.location || null,
      is_rush: isRush,
      flags: isRush ? ['RushOrder'] : null,
      hold_reason: willHold ? 'Credit hold or overdue balance' : null,
    }
    let newOrderId: string | null = null
    if (isEditOpen?.id) {
      const { error } = await supabase.from('purchase_orders').update(row).eq('id', isEditOpen.id)
      if (error) { setError('Failed to update order'); return }
      newOrderId = String(isEditOpen.id)
    } else {
      const { data, error } = await supabase.from('purchase_orders').insert(row).select('*').single()
      if (error) { setError('Failed to create order'); return }
      newOrderId = data?.id ? String(data.id) : null
    }
    // Notify Finance and Sales if order is placed on hold
    try {
      if (row.status === Status.OnHold) {
        const webhook = (import.meta as any).env?.VITE_ONHOLD_WEBHOOK_URL as string | undefined
        if (webhook) {
          await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'PO_ON_HOLD',
              reason: row.hold_reason,
              customer_id: row.customer_id,
              customer_name: row.customer_name,
              product_id: row.product_id,
              product_name: row.product_name,
              quantity: row.quantity,
              requested_ship_date: row.requested_ship_date,
              status: row.status,
              created_at: new Date().toISOString(),
            }),
          })
        }
      }
    } catch {}
    // Persist packaging types (array) and line items
    try {
      if (newOrderId) {
        await supabase.from('purchase_orders').update({ packaging_types: selectedPackagingTypes.length ? selectedPackagingTypes : null }).eq('id', newOrderId)
        // Reset PO lines for simplicity
        await supabase.from('purchase_order_lines').delete().eq('purchase_order_id', newOrderId)
        const mainQty = Number(form.quantity || 0)
        const items: any[] = []
        if (form.product && mainQty > 0) {
          items.push({ purchase_order_id: newOrderId, product_name: form.product, quantity: mainQty })
        }
        extraLines.forEach(l => {
          if (l.product && l.qty > 0) items.push({ purchase_order_id: newOrderId, product_name: l.product, quantity: l.qty })
        })
        if (items.length) await supabase.from('purchase_order_lines').insert(items)
      }
    } catch {}

    const { data } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })
    setOrders(data ?? [])
    resetForm()
    setIsAddOpen(false)
    setIsEditOpen(null)
    setToast({ show: true, message: wasEdit ? 'Purchase order updated' : 'Purchase order created' })

    // Auto-allocation workflow when PO is Approved
    try {
      const shouldAllocate = (row.status === Status.Approved)
      if (shouldAllocate && newOrderId) {
        // Lookup available finished goods for the product
        const { data: fgRows } = await supabase
          .from('finished_goods')
          .select('id, product_name, available_qty')
          .eq('product_name', row.product_name)
          .limit(1)
        const available = Number(fgRows?.[0]?.available_qty ?? 0)
        const allocateQty = Math.min(available, row.quantity)
        const shortfall = Math.max(0, row.quantity - allocateQty)

        // Update finished goods stock
        if (allocateQty > 0 && fgRows && fgRows[0]?.id) {
          await supabase.from('finished_goods')
            .update({ available_qty: available - allocateQty })
            .eq('id', fgRows[0].id)
        }

        // Update PO with allocation outcome
        const nextStatus = shortfall === 0 ? Status.Allocated : Status.Backordered
        await supabase.from('purchase_orders')
          .update({ allocated_qty: allocateQty, backorder_qty: shortfall, status: nextStatus })
          .eq('id', newOrderId)

        // If shortfall, create a production batch suggestion
        if (shortfall > 0) {
          await supabase.from('production_batches').insert({
            product_sku: row.product_name,
            qty: shortfall,
            room: row.location || 'Main Room',
            start_date: row.requested_ship_date || new Date().toISOString().slice(0,10),
            status: Status.Scheduled,
            required_capacity: shortfall,
            assigned_line: row.location || 'Main Room',
            flags: ['AutoCreatedFromPO'],
          })
        }

        // Refresh orders again to reflect status change
        const { data: refreshed } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })
        setOrders(refreshed ?? [])
      }
    } catch { /* swallow allocation errors to not block UI */ }
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

  // Approve + Allocate for a single PO
  const approveAndAllocate = async (poId: string) => {
    try {
      setError(null)
      // 1) Mark PO approved
      const { error: upErr } = await supabase
        .from('purchase_orders')
        .update({ status: 'approved' })
        .eq('id', poId)
      if (upErr) throw upErr

      // 2) Call RPC allocate_stock
      const { data: summary, error: rpcErr } = await supabase.rpc('allocate_stock', { p_po_id: poId })
      if (rpcErr) throw rpcErr
      if (summary?.status === 'error') {
        const msg = Array.isArray(summary?.errors) && summary.errors.length > 0
          ? (summary.errors[0]?.error || summary.errors[0])
          : 'Allocation RPC returned error'
        setToast({ show: true, message: `Allocation failed: ${String(msg)}` })
        return
      }

      // 2b) Reflect allocation to Finished Goods as well (client-side adjustment)
      try {
        const lines: any[] = Array.isArray(summary?.lines) ? summary.lines : []
        const agg: Record<string, number> = {}
        for (const ln of lines) {
          const name = String(ln.product_name || '').trim()
          const alloc = Number(ln.allocated_qty || 0)
          if (!name || !(alloc > 0)) continue
          agg[name] = (agg[name] || 0) + alloc
        }
        const entries = Object.entries(agg)
        if (entries.length) {
          await Promise.all(entries.map(async ([productName, dec]) => {
            const { data: fg } = await supabase
              .from('finished_goods')
              .select('id, available_qty')
              .eq('product_name', productName)
              .limit(1)
            const row = fg?.[0]
            if (!row?.id) {
              // create a new FG row with 0 available (no negative stock), so it appears in Inventory list
              await supabase.from('finished_goods').insert({ product_name: productName, available_qty: 0 })
            } else {
              const current = Number(row.available_qty || 0)
              const next = Math.max(0, current - Number(dec))
              await supabase.from('finished_goods').update({ available_qty: next }).eq('id', row.id)
            }
          }))
        }
      } catch { /* do not block UI on FG sync errors */ }

      // 3) Refresh purchase orders
      const { data: poRows } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false })
      setOrders(poRows ?? [])

      // 4) Show summary modal and toast
      setAllocSummary(summary)
      setIsAllocOpen(true)
      setToast({ show: true, message: `Allocation: ${summary?.status ?? 'done'}` })
    } catch (e: any) {
      setError(e?.message || 'Failed to approve and allocate')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
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

        {isAllocOpen && allocSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsAllocOpen(false)}></div>
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <h2 className="text-2xl font-semibold text-neutral-dark">Allocation Summary</h2>
                <p className="text-sm text-neutral-medium mt-1">Status: {String(allocSummary?.status || '')}</p>
              </div>
              <div className="p-6">
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
                            <div className="text-sm text-neutral-dark truncate max-w-[260px]">{o.product_name || o.product_id}</div>
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
                                onClick={() => approveAndAllocate(o.id)}
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
                                setForm({
                                  date: o.date || '',
                                  customer: o.customer_name || '',
                                  product: o.product_name || '',
                                  packagingType: o.packaging_type || '',
                                  requestedShipDate: o.requested_ship_date || '',
                                  quantity: String(o.quantity),
                                  caseQty: o.case_qty ? String(o.case_qty) : '',
                                  notes: o.notes || '',
                                  invoice: o.invoice || '',
                                  paymentTerms: o.payment_terms || '',
                                  status: o.status || 'Open',
                                  comments: o.comments || '',
                                  location: o.location || ''
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
                                    .from('purchase_order_items')
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
                              <button key={c.id} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${form.customer===c.name?'bg-neutral-light':''}`} onClick={()=>{setForm({...form, customer:c.name}); setIsCustomerOpen(false)}}>{c.name}{(c.credit_hold || (c.overdue_balance??0)>0)? ' • On Hold Risk' : ''}</button>
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
                      <input type="date" className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" value={form.requestedShipDate} onChange={(e)=>setForm({...form, requestedShipDate:e.target.value})} />
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
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsViewOpen(null)}></div>
            <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Purchase Order Details</h2>
                  <p className="text-sm text-neutral-medium mt-1">Order information overview</p>
                </div>
                <button onClick={() => setIsViewOpen(null)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-8 space-y-6">
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
                            : 'bg-neutral-light/40 text-neutral-dark border-neutral-soft/60'
                        return (
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${statusClass}`}>
                            {isViewOpen.status || '—'}
                          </span>
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

