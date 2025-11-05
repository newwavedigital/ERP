import React, { useEffect, useRef, useState } from 'react'
import { Plus, X, User, Package, Calendar, FileText, Eye, Pencil, Trash2, MapPin } from 'lucide-react'
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
  const [packagingTypes, setPackagingTypes] = useState<string[]>(['Jars','Squeeze packs','Sachets'])
  const [packagingReady, setPackagingReady] = useState<boolean>(true)
  const [showManagePackaging, setShowManagePackaging] = useState(false)
  const [newPackaging, setNewPackaging] = useState('')
  const [selectedPackagingTypes, setSelectedPackagingTypes] = useState<string[]>([])
  const [extraLines, setExtraLines] = useState<Array<{ id: string; product: string; qty: number }>>([])
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
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setIsCustomerOpen(false)
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) setIsLocationOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])
  
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
        // Reset PO items for simplicity
        await supabase.from('purchase_order_items').delete().eq('purchase_order_id', newOrderId)
        const mainQty = Number(form.quantity || 0)
        const items: any[] = []
        if (form.product && mainQty > 0) {
          items.push({ purchase_order_id: newOrderId, product_name: form.product, quantity: mainQty })
        }
        extraLines.forEach(l => {
          if (l.product && l.qty > 0) items.push({ purchase_order_id: newOrderId, product_name: l.product, quantity: l.qty })
        })
        if (items.length) await supabase.from('purchase_order_items').insert(items)
      }
    } catch {}

    const { data } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })
    setOrders(data ?? [])
    resetForm()
    setIsAddOpen(false)
    setIsEditOpen(null)

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
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
    if (error) { setError('Failed to delete order'); return }
    setOrders(orders.filter(o => o.id !== id))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-2">Purchase Orders</h1>
              <p className="text-neutral-medium text-lg">Manage inbound customer purchase orders</p>
            </div>
            <button onClick={() => setIsAddOpen(true)} className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center">
              <Plus className="h-5 w-5 mr-3" />
              Add Purchase Order
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-6">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Search customer or product"
              className="flex-1 px-4 py-2 border border-neutral-soft rounded-lg"
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
            />
            <select className="px-3 py-2 border border-neutral-soft rounded-lg" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}>
              {['All', ...Object.values(Status)].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="px-3 py-2 border border-neutral-soft rounded-lg" value={rushFilter} onChange={(e)=>setRushFilter(e.target.value)}>
              {['All','Rush Only','Non-Rush'].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
          {loading ? (
            <div className="p-12 text-center text-neutral-medium">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-neutral-medium">No purchase orders yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-medium border-b">
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4">Customer</th>
                    <th className="py-3 pr-4">Product</th>
                    <th className="py-3 pr-4">Qty</th>
                    <th className="py-3 pr-4">Ship Date</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Rush</th>
                    <th className="py-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter((o:any)=>{
                      const hit = (o.customer_name||'').toLowerCase().includes(search.toLowerCase()) || (o.product_name||'').toLowerCase().includes(search.toLowerCase())
                      const statusOk = statusFilter==='All' ? true : o.status===statusFilter
                      const rushOk = rushFilter==='All' ? true : rushFilter==='Rush Only' ? !!o.is_rush : !o.is_rush
                      return hit && statusOk && rushOk
                    })
                    .map((o:any) => (
                    <tr key={o.id} className="border-b hover:bg-neutral-light/30">
                      <td className="py-3 pr-4">{o.date || '-'}</td>
                      <td className="py-3 pr-4">{o.customer_name || o.customer_id}</td>
                      <td className="py-3 pr-4">{o.product_name || o.product_id}</td>
                      <td className="py-3 pr-4">{o.quantity}</td>
                      <td className="py-3 pr-4">{o.requested_ship_date || '-'}</td>
                      <td className="py-3 pr-4">{o.status}</td>
                      <td className="py-3 pr-4">{o.is_rush ? 'Yes' : 'No'}</td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <button className="p-2 rounded-md hover:bg-neutral-light" onClick={() => setIsViewOpen(o)} title="View"><Eye className="h-4 w-4" /></button>
                          <button className="p-2 rounded-md hover:bg-neutral-light" onClick={() => { setIsEditOpen(o); setIsAddOpen(true); setForm({
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
                          }) }} title="Edit"><Pencil className="h-4 w-4" /></button>
                          <button className="p-2 rounded-md hover:bg-red-50 text-red-600" onClick={() => removeOrder(o.id)} title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsAddOpen(false)}></div>
            <div className="relative z-10 w-full max-w-3xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Add Purchase Order</h2>
                </div>
                <button onClick={() => setIsAddOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
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
            <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">Purchase Order</h3>
                <button onClick={() => setIsViewOpen(null)} className="p-2"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-2 text-sm">
                <div><strong>Customer:</strong> {isViewOpen.customer_name || isViewOpen.customer_id}</div>
                <div><strong>Product:</strong> {isViewOpen.product_name || isViewOpen.product_id}</div>
                <div><strong>Quantity:</strong> {isViewOpen.quantity}</div>
                <div><strong>Requested Ship Date:</strong> {isViewOpen.requested_ship_date || '-'}</div>
                <div><strong>Status:</strong> {isViewOpen.status}</div>
                <div><strong>Location:</strong> {isViewOpen.location || '-'}</div>
                <div><strong>Rush:</strong> {isViewOpen.is_rush ? 'Yes' : 'No'}</div>
                <div><strong>Comments:</strong> {isViewOpen.comments || '-'}</div>
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

