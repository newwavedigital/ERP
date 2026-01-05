import React, { useEffect, useMemo, useState } from 'react'
import { Calculator, RefreshCw, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SupplyChainProcurement: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [selectedPo, setSelectedPo] = useState<any | null>(null)
  const [calcLoading, setCalcLoading] = useState<boolean>(false)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [poLines, setPoLines] = useState<Array<{ id: string; product_id: string | null; product_name: string; quantity: number }>>([])
  const [rawMaterials, setRawMaterials] = useState<Array<{ material_id: string; material_name: string; uom: string; required_qty: number }>>([])
  const [packagingMaterials, setPackagingMaterials] = useState<Array<{ material_id: string; material_name: string; uom: string; required_qty: number }>>([])
  const [missingFormulas, setMissingFormulas] = useState<Array<{ product_name: string; quantity: number }>>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const procurementStatuses = useMemo(
    () => ['Move to Procurement', 'move_to_procurement', 'procurement', 'Procurement'],
    []
  )

  const load = async () => {
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

  const loadCalculator = async (po: any) => {
    const poId = String(po?.id || '')
    if (!poId) return

    setCalcLoading(true)
    setCalcError(null)
    setPoLines([])
    setRawMaterials([])
    setPackagingMaterials([])
    setMissingFormulas([])

    try {
      const { data: linesData, error: linesErr } = await supabase
        .from('purchase_order_lines')
        .select('id, product_name, quantity')
        .eq('purchase_order_id', poId)
        .order('created_at', { ascending: true })
      if (linesErr) throw linesErr
      const baseLines = (linesData || []).map((r: any) => ({
        id: String(r.id),
        product_id: null as string | null,
        product_name: String(r.product_name || ''),
        quantity: Number(r.quantity || 0),
      }))

      // Resolve product_id by product_name (purchase_order_lines doesn't store product_id)
      const uniqueNames = Array.from(new Set(baseLines.map((l) => l.product_name).map((s) => String(s || '').trim()).filter(Boolean)))
      const idByName = new Map<string, string>()
      for (const nm of uniqueNames) {
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
        const { data: formulas, error: fErr } = await supabase
          .from('formulas')
          .select('id, product_id, formula_name, version')
          .in('product_id', productIds)
        if (fErr) throw fErr
        ;(formulas || []).forEach((f: any) => {
          const pid = f.product_id != null ? String(f.product_id) : ''
          if (!pid) return
          const prev = formulasByProduct.get(pid)
          if (!prev) {
            formulasByProduct.set(pid, f)
            return
          }
          const pv = Number(prev.version ?? 0)
          const nv = Number(f.version ?? 0)
          if (nv >= pv) formulasByProduct.set(pid, f)
        })
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

      lines.forEach((ln) => {
        const pid = ln.product_id ? String(ln.product_id) : ''
        const formula = pid ? formulasByProduct.get(pid) : null
        const fid = formula?.id != null ? String(formula.id) : ''
        const items = fid ? itemsByFormula.get(fid) || [] : []

        if (!pid || !fid || items.length === 0) {
          missing.push({ product_name: ln.product_name || '—', quantity: ln.quantity })
          return
        }

        items.forEach((it) => {
          const required = Number(ln.quantity || 0) * Number(it.qty_per_unit || 0)
          const isPackaging = String(it.category || '').toLowerCase() === 'packaging'
          const target = isPackaging ? packAgg : rawAgg
          const prev = target.get(it.material_id)
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
      })

      const sortByName = (a: any, b: any) => String(a.material_name || '').localeCompare(String(b.material_name || ''))
      setRawMaterials(Array.from(rawAgg.values()).sort(sortByName))
      setPackagingMaterials(Array.from(packAgg.values()).sort(sortByName))
      setMissingFormulas(missing)
    } catch (e: any) {
      setCalcError(e?.message || 'Failed to calculate materials')
    } finally {
      setCalcLoading(false)
    }
  }

  const approvePO = async (po: any) => {
    const poId = String(po?.id || '')
    if (!poId) return
    
    setApprovingId(poId)
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'Ready to Schedule' })
        .eq('id', poId)
      
      if (error) throw error
      
      // Refresh the list to reflect the change
      await load()
      
      // If this was the selected PO, clear selection since it's no longer in procurement queue
      if (selectedPo?.id && String(selectedPo.id) === poId) {
        setSelectedPo(null)
        setPoLines([])
        setRawMaterials([])
        setPackagingMaterials([])
        setMissingFormulas([])
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to approve PO')
    } finally {
      setApprovingId(null)
    }
  }

  useEffect(() => {
    load()
    // Intentionally no realtime subscription added here to avoid changing existing backend behavior.
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-2 sm:p-4 lg:p-6">
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-dark mb-1">Supply Chain & Procurement</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-neutral-soft bg-white hover:bg-neutral-light/40 text-neutral-dark transition-all disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

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
                <div className="text-sm text-neutral-medium">Select a PO from the Procurement Queue to calculate raw materials and packaging requirements.</div>
              </div>
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
                  const created = po.created_at ? new Date(po.created_at).toLocaleDateString() : '—'
                  const poNumber = String(po.po_number ?? po.number ?? id.slice(0, 8))
                  const isSelected = selectedPo?.id != null && String(selectedPo.id) === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setSelectedPo(po); loadCalculator(po) }}
                      className={`w-full text-left rounded-xl border border-neutral-soft/40 transition-colors p-3 sm:p-4 ${isSelected ? 'bg-primary-light/10 border-primary-light' : 'bg-white hover:bg-neutral-light/20'}`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-semibold text-neutral-dark">PO #{poNumber}</div>
                            <div className="text-xs text-neutral-medium">Customer: {String(po.customer_name || '—')}</div>
                          </div>
                          <div className="flex flex-col items-start sm:items-end gap-1">
                            <span className="text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-200">{String(po.status || 'Unknown')}</span>
                            <span className="text-xs text-neutral-medium">{created}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-soft/40">
                          <div className="text-xs text-neutral-medium">
                            Product: {String(po.product_name || '—')} • Qty: {Number(po.quantity || 0)}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              approvePO(po)
                            }}
                            disabled={approvingId === id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {approvingId === id ? 'Approving...' : 'Approve for Scheduling'}
                          </button>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {selectedPo && (
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
                                  {Number(m.required_qty || 0).toFixed(3)}{m.uom ? ` ${m.uom}` : ''}
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
                                  {Number(m.required_qty || 0).toFixed(3)}{m.uom ? ` ${m.uom}` : ''}
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
      </div>
    </div>
  )
}

export default SupplyChainProcurement
