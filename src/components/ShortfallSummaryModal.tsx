import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export interface ShortfallSummaryProps {
  isOpen: boolean
  onClose: () => void
  poNumber: string
  poStatus: 'allocated' | 'partial' | 'backordered'
  lines: Array<{
    product_name: string
    ordered_qty: number
    allocated_qty: number
    shortfall_qty: number
  }>
  materials?: Array<{
    material_name: string
    required_qty: number
    available_qty: number
    shortage_qty: number
  }>
  autoCreatedBatch?: {
    batch_id: string
    qty: number
    status: string
  }
  autoCreatedPRs?: Array<{
    id: string
    item_name: string
    required_qty: number
    needed_by: string
  }>
}

const statusBadge = (status: 'allocated' | 'partial' | 'backordered') => {
  if (status === 'allocated') return { label: 'Allocated', cls: 'bg-[#16A34A] text-white' }
  if (status === 'partial') return { label: 'Partially Allocated', cls: 'bg-[#D97706] text-white' }
  return { label: 'Backordered', cls: 'bg-[#DC2626] text-white' }
}

const qtyBadge = (shortfall: number, allocated: number, ordered: number) => {
  if (shortfall > 0 && allocated === 0) return { label: 'Backordered', cls: 'bg-[#DC2626] text-white' }
  if (shortfall > 0) return { label: 'Partial', cls: 'bg-[#D97706] text-white' }
  if (ordered > 0 && allocated >= ordered) return { label: 'Allocated', cls: 'bg-[#16A34A] text-white' }
  return { label: 'Pending', cls: 'bg-gray-200 text-gray-600' }
}

const ShortfallSummaryModal: React.FC<ShortfallSummaryProps> = ({
  isOpen,
  onClose,
  poNumber,
  poStatus,
  lines,
  materials,
  autoCreatedBatch,
  autoCreatedPRs,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [noFgForProducts, setNoFgForProducts] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const hasShortfall = useMemo(
    () => (lines || []).some(l => Number(l.shortfall_qty || 0) > 0),
    [lines]
  )

  useEffect(() => {
    const run = async () => {
      try {
        setNoFgForProducts(false)
        if (!isOpen) return
        const names = Array.from(new Set((lines || []).map(l => String(l.product_name || '').trim()).filter(Boolean)))
        if (names.length === 0) return
        const { data, error } = await supabase
          .from('finished_goods')
          .select('product_name, available_qty')
          .in('product_name', names)
        if (error) return
        // Banner shows when none of the products have available_qty > 0 (or no rows)
        const hasAvailable = Array.isArray(data) && data.some(r => Number(r?.available_qty || 0) > 0)
        setNoFgForProducts(!hasAvailable)
      } catch {
        // Non-fatal: do not block modal
      }
    }
    run()
  }, [isOpen, lines])

  if (!isOpen) return null

  const stat = statusBadge(poStatus)

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[80] flex items-start md:items-center justify-center bg-black/40 p-3 md:p-6" onClick={(e)=>{ if (e.target===overlayRef.current) onClose() }}>
      <div
        ref={containerRef}
        className="w-full max-w-5xl bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] overflow-hidden transform transition-all duration-200 animate-[slideDown_160ms_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alloc-title"
      >
        {/* Top */}
        <div className="px-5 md:px-8 py-5 border-b border-[#E5E7EB] bg-white relative">
          <div className="flex items-start md:items-center justify-between gap-3">
            <div>
              <h2 id="alloc-title" className="text-xl md:text-2xl font-semibold text-[#111827]">Allocation Summary</h2>
              <p className="text-sm text-[#4B5563] mt-1">PO #: {poNumber}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs md:text-sm font-semibold px-2.5 py-1.5 rounded-full ${stat.cls}`}>{stat.label}</span>
              <button aria-label="Close" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-[#4B5563] hover:text-[#111827]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 space-y-8">
          {noFgForProducts && (
            <div className="mb-2 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm flex items-center justify-between">
              <div>
                <div className="font-semibold">No finished goods available for this product.</div>
                <div>Please create a production schedule.</div>
              </div>
              <button onClick={() => { onClose(); navigate('/production-schedule') }} className="ml-4 px-3 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-medium">
                Go to Production Schedule
              </button>
            </div>
          )}
          {/* Section 1: Product Allocation Table */}
          <section className="w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base md:text-lg font-semibold text-[#111827]">Product Allocation</h3>
            </div>
            <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
              <table className="min-w-full divide-y divide-[#E5E7EB]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-3 text-left text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Product</th>
                    <th className="px-4 md:px-6 py-3 text-right text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Ordered</th>
                    <th className="px-4 md:px-6 py-3 text-right text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Allocated</th>
                    <th className="px-4 md:px-6 py-3 text-right text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Shortfall</th>
                    <th className="px-4 md:px-6 py-3 text-left text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#E5E7EB]">
                  {lines && lines.length > 0 ? (
                    lines.map((l, idx) => {
                      const badge = qtyBadge(l.shortfall_qty, l.allocated_qty, l.ordered_qty)
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 md:px-6 py-3 text-sm text-[#111827]">{l.product_name}</td>
                          <td className="px-4 md:px-6 py-3 text-sm text-[#111827] text-right">{l.ordered_qty}</td>
                          <td className="px-4 md:px-6 py-3 text-sm text-[#111827] text-right">{l.allocated_qty}</td>
                          <td className={`px-4 md:px-6 py-3 text-sm text-right ${l.shortfall_qty>0? 'text-[#DC2626] font-semibold':'text-[#111827]'}`}>{l.shortfall_qty}</td>
                          <td className="px-4 md:px-6 py-3 text-sm">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td className="px-4 md:px-6 py-6 text-center text-sm text-gray-500" colSpan={5}>No lines to display.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 2: Raw Material Requirements */}
          {hasShortfall && (
            <section className="w-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base md:text-lg font-semibold text-[#111827]">Raw Material Shortages</h3>
              </div>
              <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
                <table className="min-w-full divide-y divide-[#E5E7EB]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Material</th>
                      <th className="px-4 md:px-6 py-3 text-right text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Required</th>
                      <th className="px-4 md:px-6 py-3 text-right text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Available</th>
                      <th className="px-4 md:px-6 py-3 text-right text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Shortage</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E5E7EB]">
                    {materials && materials.length > 0 ? (
                      materials.map((m, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 md:px-6 py-3 text-sm text-[#111827]">{m.material_name}</td>
                          <td className="px-4 md:px-6 py-3 text-sm text-[#111827] text-right">{m.required_qty}</td>
                          <td className="px-4 md:px-6 py-3 text-sm text-[#111827] text-right">{m.available_qty}</td>
                          <td className={`px-4 md:px-6 py-3 text-sm text-right ${m.shortage_qty>0? 'text-[#DC2626] font-semibold':'text-[#111827]'}`}>{m.shortage_qty}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 md:px-6 py-6 text-center" colSpan={4}>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#16A34A] text-white">All materials sufficient</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section 3: Auto-created Production Batch */}
          {autoCreatedBatch && (
            <section className="w-full">
              <h3 className="text-base md:text-lg font-semibold text-[#111827] mb-3">Auto-created Production Batch</h3>
              <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-sm text-[#111827]"><span className="text-[#4B5563]">Batch ID:</span> {autoCreatedBatch.batch_id}</div>
                <div className="text-sm text-[#111827]"><span className="text-[#4B5563]">Quantity:</span> {autoCreatedBatch.qty}</div>
                <div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${autoCreatedBatch.status.toLowerCase()==='scheduled' ? 'bg-[#1E90FF] text-white' : autoCreatedBatch.status.toLowerCase()==='in progress' ? 'bg-[#D97706] text-white' : 'bg-gray-200 text-gray-600'}`}>{autoCreatedBatch.status}</span>
                </div>
              </div>
            </section>
          )}

          {/* Section 4: Auto-created Purchase Requisitions */}
          {autoCreatedPRs && autoCreatedPRs.length > 0 && (
            <section className="w-full">
              <h3 className="text-base md:text-lg font-semibold text-[#111827] mb-3">Auto-created Purchase Requisitions</h3>
              <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
                <table className="min-w-full divide-y divide-[#E5E7EB]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">PR ID</th>
                      <th className="px-4 md:px-6 py-3 text-left text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Item</th>
                      <th className="px-4 md:px-6 py-3 text-right text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Required Qty</th>
                      <th className="px-4 md:px-6 py-3 text-left text-[11px] md:text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Needed By</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E5E7EB]">
                    {autoCreatedPRs.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-3 text-sm text-[#111827]">{p.id}</td>
                        <td className="px-4 md:px-6 py-3 text-sm text-[#111827]">{p.item_name}</td>
                        <td className="px-4 md:px-6 py-3 text-sm text-[#111827] text-right">{p.required_qty}</td>
                        <td className="px-4 md:px-6 py-3 text-sm text-[#111827]">{p.needed_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

export default ShortfallSummaryModal
