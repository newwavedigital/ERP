import React, { useRef, useState } from 'react'
import { Calendar, X, Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import { evaluateRules } from '../rules/engine'
import { productionRules } from '../rules/production.rules'
import { RULES_CONFIG } from '../config/rules-config'
import { Status } from '../domain/enums'
import { supabase } from '../lib/supabase'
import { useEffect } from 'react'

interface ScheduleItem {
  id: string
  product: string
  quantity: number
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  status: string
  priority: string
  assignedTo: string
}

const ProductionSchedule: React.FC = () => {

  const [open, setOpen] = useState(false)

  const [items, setItems] = useState<ScheduleItem[]>([])

  // tabs / filters
  const tabs: Array<{ key: string; label: string; color?: string }> = [
    { key: 'All', label: 'All' },
    { key: 'Main Room', label: 'Main Room', color: 'bg-blue-500' },
    { key: 'Bnutty Room', label: 'Bnutty Room', color: 'bg-green-500' },
    { key: "Dilly's Room", label: "Dilly's Room", color: 'bg-amber-500' },
  ]
  const [activeTab, setActiveTab] = useState<string>('All')

  // form refs
  const dateRef = useRef<HTMLInputElement>(null)
  const goalRef = useRef<HTMLInputElement>(null)

  // dropdown state/values
  type Customer = { id: string; name: string }
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [customersError, setCustomersError] = useState<string | null>(null)

  const [selectedCustomer, setSelectedCustomer] = useState<{ id?: string; name: string }>({ name: '' })
  const [selectedProduct, setSelectedProduct] = useState<string>('Chocolate Chip Cookies')
  const [selectedFormula, setSelectedFormula] = useState<string>('')
  const [selectedRoom, setSelectedRoom] = useState<string>('Main Room')
  const [samplesReceived, setSamplesReceived] = useState<string>('No')

  const productsList = ['Chocolate Chip Cookies', 'Vanilla Cupcakes']
  const formulasList = ['Formula A', 'Formula B']
  const roomsList = ['Main Room', 'Room A', 'Room B']
  const yesNo = ['No', 'Yes']

  const customerRef = useRef<HTMLDivElement>(null)
  const productRef = useRef<HTMLDivElement>(null)
  const formulaRef = useRef<HTMLDivElement>(null)
  const roomRef = useRef<HTMLDivElement>(null)
  const samplesRef = useRef<HTMLDivElement>(null)

  const [isCustomerOpen, setIsCustomerOpen] = useState(false)
  const [isProductOpen, setIsProductOpen] = useState(false)
  const [isFormulaOpen, setIsFormulaOpen] = useState(false)
  const [isRoomOpen, setIsRoomOpen] = useState(false)
  const [isSamplesOpen, setIsSamplesOpen] = useState(false)

  const onCreate = async () => {
    const startDate = dateRef.current?.value || new Date().toISOString().slice(0, 10)
    const product = selectedProduct || 'New Product'
    const room = selectedRoom || 'Main Room'
    const qty = Number(goalRef.current?.value || 0)

    // Build ProductionOrder for rule evaluation
    const prod = {
      id: `P-${Date.now()}`,
      productSku: product,
      qty,
      room,
      startDate,
      status: Status.Scheduled,
      requiredCapacity: qty,
    }

    const { entity: evaluated } = evaluateRules(prod as any, productionRules as any, {
      now: new Date(),
      config: RULES_CONFIG,
    })

    const newRow: ScheduleItem = {
      id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      product,
      quantity: qty,
      startDate,
      endDate: startDate,
      startTime: '08:00',
      endTime: '12:00',
      status: evaluated.status,
      priority: 'Medium',
      assignedTo: room,
    }

    // Try to persist to Supabase
    try {
      const { error } = await supabase.from('production_batches').insert({
        product_sku: product,
        qty,
        room,
        start_date: startDate,
        end_date: startDate,
        status: evaluated.status,
        required_capacity: qty,
        assigned_line: room,
        flags: evaluated.flags ?? null,
      })
      if (error) {
        console.warn('Supabase insert error:', error)
      }
    } catch (e) {
      console.warn('Supabase insert exception:', e)
    } finally {
      // Optimistic UI
      setItems((prev) => [newRow, ...prev])
      setOpen(false)
    }
  }

  // Load from Supabase (reusable)
  const loadItems = async () => {
    const { data, error } = await supabase
      .from('production_batches')
      .select('id, product_sku, qty, room, start_date, end_date, status')
      .order('start_date', { ascending: false })
      .limit(50)

    if (error) {
      console.warn('Supabase fetch error:', error)
      return
    }
    const mapped: ScheduleItem[] = (data || []).map((r: any, idx: number) => ({
      id: (r.id && String(r.id)) || ((typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${idx}`),
      product: r.product_sku,
      quantity: Number(r.qty ?? 0),
      startDate: r.start_date,
      endDate: r.end_date ?? r.start_date,
      startTime: '08:00',
      endTime: '12:00',
      status: r.status ?? 'Scheduled',
      priority: 'Medium',
      assignedTo: r.room ?? 'Main Room',
    }))
    setItems(mapped)
  }

  // Initial load
  useEffect(() => {
    loadItems()
  }, [])

  // load customers for dropdown
  useEffect(() => {
    const loadCustomers = async () => {
      if (!supabase) {
        setCustomersLoading(false)
        setCustomersError('Supabase not configured')
        return
      }
      setCustomersLoading(true)
      setCustomersError(null)
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name', { ascending: true })
      if (error) {
        setCustomersError('Cannot load customers')
        setCustomersLoading(false)
        return
      }
      const rows = (data ?? []) as Array<{ id: string; company_name: string | null }>
      const items: Customer[] = rows.map((r) => ({ id: String(r.id), name: String(r.company_name ?? '') }))
      setCustomers(items)
      setCustomersLoading(false)
    }
    loadCustomers()
  }, [])

  // outside click to close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setIsCustomerOpen(false)
      if (productRef.current && !productRef.current.contains(e.target as Node)) setIsProductOpen(false)
      if (formulaRef.current && !formulaRef.current.contains(e.target as Node)) setIsFormulaOpen(false)
      if (roomRef.current && !roomRef.current.contains(e.target as Node)) setIsRoomOpen(false)
      if (samplesRef.current && !samplesRef.current.contains(e.target as Node)) setIsSamplesOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'Delayed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filtered = activeTab === 'All' ? items : items.filter((i) => (i.assignedTo || '').toLowerCase() === activeTab.toLowerCase())

  // CRUD: view/edit/delete states
  const [viewItem, setViewItem] = useState<ScheduleItem | null>(null)
  const [editItem, setEditItem] = useState<ScheduleItem | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [delItem, setDelItem] = useState<ScheduleItem | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-1">Production Schedule</h1>
              <p className="text-neutral-medium text-lg">Schedule production with material requirements</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadItems}
                className="px-5 py-3 rounded-xl bg-neutral-light hover:bg-neutral-soft text-neutral-dark text-sm font-semibold transition-all shadow-sm hover:shadow-md"
              >
                Reload
              </button>
              <button
                onClick={() => setOpen(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all shadow-lg hover:shadow-xl flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Schedule Production
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="mt-6">
            <div className="flex items-center gap-6 text-sm font-medium text-neutral-dark">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`pb-2 border-b-2 transition-colors ${activeTab===t.key ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'}`}
                >
                  <span className="inline-flex items-center">
                    {t.color && <span className={`w-2 h-2 rounded-full mr-2 ${t.color}`}></span>}
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 border-t border-neutral-soft"></div>
          </div>
        </div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="mx-auto w-16 h-16 bg-neutral-light rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-neutral-medium" />
            </div>
            <p className="text-neutral-dark font-semibold mb-1">No production scheduled</p>
            <p className="text-neutral-medium mb-6">Create a production schedule to get started.</p>
            <button
              onClick={() => setOpen(true)}
              className="px-6 py-3 rounded-xl bg-primary-medium hover:bg-primary-dark text-white font-semibold shadow-sm"
            >
              Schedule Production
            </button>
          </div>
        )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)}></div>
          <div className="relative z-10 w-full max-w-4xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-dark">Add Production Schedule</h2>
                <p className="text-sm text-neutral-medium mt-1">Plan a new production run</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-neutral-dark">Scheduled Date</label>
                  <input ref={dateRef} type="date" className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium" />
                </div>

                <div className="space-y-3 relative" ref={customerRef}>
                  <label className="text-sm font-semibold text-neutral-dark">Customer</label>
                  <button
                    type="button"
                    onClick={() => { if (customersLoading || customers.length===0) return; setIsCustomerOpen((v)=>!v) }}
                    disabled={customersLoading || customers.length===0}
                    className={`w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white transition-all shadow-sm ${customersLoading || customers.length===0 ? 'opacity-60 cursor-not-allowed' : 'hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:shadow-md'}`}
                  >
                    <span className={selectedCustomer.name ? 'text-neutral-dark' : 'text-neutral-medium'}>
                      {customersLoading ? 'Loading customers...' : (customers.length===0 ? 'No customers available' : (selectedCustomer.name || 'Select Customer'))}
                    </span>
                    <span className="ml-2 text-neutral-medium">▼</span>
                  </button>
                  {customersError && <p className="text-xs text-accent-danger">{customersError}</p>}
                  {isCustomerOpen && (
                    <div className="absolute z-[100] mt-2 w-[calc(100%-4rem)] bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                      <div className="px-3 py-2 text-xs text-neutral-medium">Select Customer</div>
                      {customers.map((c) => (
                        <button key={c.id} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${selectedCustomer.name===c.name ? 'bg-neutral-light' : ''}`}
                          onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setIsCustomerOpen(false) }}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 relative" ref={productRef}>
                  <label className="text-sm font-semibold text-neutral-dark">Product</label>
                  <button
                    type="button"
                    onClick={() => setIsProductOpen((v)=>!v)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all shadow-sm"
                  >
                    <span className={selectedProduct ? 'text-neutral-dark' : 'text-neutral-medium'}>{selectedProduct || 'Select Product'}</span>
                    <span className="ml-2 text-neutral-medium">▼</span>
                  </button>
                  {isProductOpen && (
                    <div className="absolute z-[100] mt-2 w-[calc(100%-4rem)] bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                      <div className="px-3 py-2 text-xs text-neutral-medium">Select Product</div>
                      {productsList.map((p) => (
                        <button key={p} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${selectedProduct===p ? 'bg-neutral-light' : ''}`} onClick={() => { setSelectedProduct(p); setIsProductOpen(false) }}>{p}</button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 relative" ref={formulaRef}>
                  <label className="text-sm font-semibold text-neutral-dark">Formula</label>
                  <button
                    type="button"
                    onClick={() => setIsFormulaOpen((v)=>!v)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all shadow-sm"
                  >
                    <span className={selectedFormula ? 'text-neutral-dark' : 'text-neutral-medium'}>{selectedFormula || 'Select Formula'}</span>
                    <span className="ml-2 text-neutral-medium">▼</span>
                  </button>
                  {isFormulaOpen && (
                    <div className="absolute z-[100] mt-2 w-[calc(100%-4rem)] bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                      <div className="px-3 py-2 text-xs text-neutral-medium">Select Formula</div>
                      {formulasList.map((f) => (
                        <button key={f} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${selectedFormula===f ? 'bg-neutral-light' : ''}`} onClick={() => { setSelectedFormula(f); setIsFormulaOpen(false) }}>{f}</button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-neutral-dark">Lot #</label>
                    <input placeholder="e.g., LOT-2024-001" className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-neutral-dark">Purchase Order #</label>
                    <input placeholder="e.g., PO-2024-001" className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium" />
                  </div>
                </div>

                <div className="space-y-3 relative" ref={roomRef}>
                  <label className="text-sm font-semibold text-neutral-dark">Production Room</label>
                  <button
                    type="button"
                    onClick={() => setIsRoomOpen((v)=>!v)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all shadow-sm"
                  >
                    <span className={selectedRoom ? 'text-neutral-dark' : 'text-neutral-medium'}>{selectedRoom || 'Select Room'}</span>
                    <span className="ml-2 text-neutral-medium">▼</span>
                  </button>
                  {isRoomOpen && (
                    <div className="absolute z-[100] mt-2 w-[calc(100%-4rem)] bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                      <div className="px-3 py-2 text-xs text-neutral-medium">Select Room</div>
                      {roomsList.map((r) => (
                        <button key={r} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${selectedRoom===r ? 'bg-neutral-light' : ''}`} onClick={() => { setSelectedRoom(r); setIsRoomOpen(false) }}>{r}</button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-neutral-dark">Goal</label>
                    <input ref={goalRef} placeholder="Target quantity" type="number" className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-neutral-dark">Completed</label>
                    <input defaultValue={0} className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 relative" ref={samplesRef}>
                    <label className="text-sm font-semibold text-neutral-dark">Samples Received</label>
                    <button
                      type="button"
                      onClick={() => setIsSamplesOpen((v)=>!v)}
                      className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all shadow-sm"
                    >
                      <span className={samplesReceived ? 'text-neutral-dark' : 'text-neutral-medium'}>{samplesReceived || 'Select'}</span>
                      <span className="ml-2 text-neutral-medium">▼</span>
                    </button>
                    {isSamplesOpen && (
                      <div className="absolute z-[100] mt-2 w-[calc(100%-4rem)] bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                        <div className="px-3 py-2 text-xs text-neutral-medium">Select</div>
                        {yesNo.map((o) => (
                          <button key={o} type="button" className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${samplesReceived===o ? 'bg-neutral-light' : ''}`} onClick={() => { setSamplesReceived(o); setIsSamplesOpen(false) }}>{o}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-neutral-dark">Samples Sent</label>
                    <input type="date" className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium" />
                  </div>
                </div>
                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={onCreate}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white text-sm font-semibold shadow-md"
                  >
                    Create Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {filtered.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-soft">
                <thead className="bg-neutral-light/60">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">Room</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-soft">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-light/40">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-neutral-dark">{item.product}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">{item.assignedTo}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>{item.status}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button className="p-2 rounded-md hover:bg-neutral-light" onClick={()=>setViewItem(item)} title="View"><Eye className="h-4 w-4"/></button>
                          <button className="p-2 rounded-md hover:bg-neutral-light" onClick={()=>setEditItem(item)} title="Edit"><Pencil className="h-4 w-4"/></button>
                          <button className="p-2 rounded-md hover:bg-red-50 text-accent-danger" onClick={()=>setDelItem(item)} title="Delete"><Trash2 className="h-4 w-4"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* View Modal */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setViewItem(null)}></div>
          <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Production Batch</h3>
              <button onClick={()=>setViewItem(null)} className="p-2"><X className="h-5 w-5"/></button>
            </div>
            <div className="p-6 text-sm space-y-2">
              <div><strong>Product:</strong> {viewItem.product}</div>
              <div><strong>Qty:</strong> {viewItem.quantity}</div>
              <div><strong>Room:</strong> {viewItem.assignedTo}</div>
              <div><strong>Start:</strong> {viewItem.startDate}</div>
              <div><strong>Status:</strong> {viewItem.status}</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>!editSaving && setEditItem(null)}></div>
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Edit Production Batch</h3>
              <button onClick={()=>!editSaving && setEditItem(null)} className="p-2"><X className="h-5 w-5"/></button>
            </div>
            <div className="p-6">
              <form onSubmit={async (e)=>{
                e.preventDefault(); if(!editItem) return; setEditSaving(true)
                try{
                  const payload:any = {
                    product_sku: editItem.product,
                    qty: editItem.quantity,
                    room: editItem.assignedTo,
                    start_date: editItem.startDate,
                    end_date: editItem.endDate,
                    status: editItem.status,
                    assigned_line: editItem.assignedTo,
                  }
                  const { error } = await supabase.from('production_batches').update(payload).eq('id', editItem.id)
                  if (error) throw error
                  await loadItems()
                  setEditItem(null)
                }catch(err){ console.warn(err) } finally { setEditSaving(false) }
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Product</label>
                    <input value={editItem.product} onChange={(e)=>setEditItem({...editItem, product: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Quantity</label>
                    <input type="number" value={editItem.quantity} onChange={(e)=>setEditItem({...editItem, quantity: Number(e.target.value||0)})} className="w-full px-3 py-2 border rounded-lg"/>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Room</label>
                    <input value={editItem.assignedTo} onChange={(e)=>setEditItem({...editItem, assignedTo: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <input type="date" value={editItem.startDate} onChange={(e)=>setEditItem({...editItem, startDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <select value={editItem.status} onChange={(e)=>setEditItem({...editItem, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                      {['Scheduled','In Progress','Completed','Delayed'].map(s=> <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-5 py-2.5 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-semibold" disabled={editSaving}>{editSaving? 'Saving…':'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {delItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setDelItem(null)}></div>
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
            <div className="px-6 py-4 border-b"><div className="text-lg font-semibold">Delete Batch</div></div>
            <div className="p-6 text-sm">Are you sure you want to delete "{delItem.product}"?</div>
            <div className="px-6 py-4 flex justify-end gap-3 border-t">
              <button className="px-4 py-2 rounded-lg border" onClick={()=>setDelItem(null)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-accent-danger text-white" onClick={async()=>{ try{ await supabase.from('production_batches').delete().eq('id', delItem.id); await loadItems(); setDelItem(null) }catch(e){ console.warn(e) } }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default ProductionSchedule
