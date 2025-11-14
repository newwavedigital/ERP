import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle2, X, ChevronDown } from 'lucide-react'

export type ShortfallLine = {
  product: string
  product_id?: string | null
  needed: number
  allocated: number
  shortfall: number
  suggestion?: 'production' | 'purchase' | null
}

export type AllocationResult = {
  po_id: string
  po_number?: string | null
  lines: ShortfallLine[]
}

type ActionChoice = 'production' | 'purchase' | 'skip' | ''

interface Props {
  poId: string
  data: AllocationResult
  onClose: () => void
}

const ACTION_LABEL: Record<ActionChoice, string> = {
  '': 'Select Action',
  production: 'Create Production Order',
  purchase: 'Generate Purchase Requisition',
  skip: 'Skip / Review Later',
}

const ShortfallModal: React.FC<Props> = ({ poId, data, onClose }) => {
  const [open, setOpen] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; message: string; kind?: 'success' | 'error' }>({ show: false, message: '' })
  const containerRef = useRef<HTMLDivElement>(null)

  // Build editable rows state with auto-suggestions
  interface Row {
    id: string
    product: string
    product_id: string | null
    needed: number
    allocated: number
    shortfall: number
    suggestion: 'production' | 'purchase' | null
    action: ActionChoice
    optimistic?: string
  }

  const initialRows: Row[] = useMemo(() => {
    return (data?.lines || [])
      .filter(l => Number(l.shortfall || 0) > 0)
      .map((l, idx) => {
        let action: ActionChoice = ''
        if (l.suggestion === 'production') action = 'production'
        else if (l.suggestion === 'purchase') action = 'purchase'
        return {
          id: String(idx),
          product: l.product,
          product_id: l.product_id ?? null,
          needed: Number(l.needed || 0),
          allocated: Number(l.allocated || 0),
          shortfall: Number(l.shortfall || 0),
          suggestion: (l.suggestion ?? null) as Row['suggestion'],
          action,
        }
      })
  }, [data])

  const [rows, setRows] = useState<Row[]>(initialRows)

  useEffect(() => setRows(initialRows), [initialRows])

  // auto hide toast
  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(() => setToast({ show: false, message: '' }), 2800)
      return () => clearTimeout(t)
    }
  }, [toast.show])

  // Close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Auto-focus first row select
  const firstSelectRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) setTimeout(() => firstSelectRef.current?.focus(), 50)
  }, [open])

  const anyMissingAction = rows.some(r => !r.action)

  const changeAction = (id: string, action: ActionChoice) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, action } : r))
  }

  const confirmAndGenerate = async () => {
    try {
      setSubmitting(true)
      // Optimistic labels
      setRows(prev => prev.map(r => ({ ...r, optimistic: r.action === 'production' ? 'Pending Production' : r.action === 'purchase' ? 'Pending Requisition' : r.optimistic } as any)))

      const hasProd = rows.some(r => r.action === 'production')
      const hasPr = rows.some(r => r.action === 'purchase')

      // Call RPCs conditionally
      if (hasProd) {
        const { error } = await supabase.rpc('fn_generate_po_for_batch_shortages', { p_po_id: poId })
        if (error) throw error
      }
      if (hasPr) {
        const { error } = await supabase.rpc('fn_generate_pr_for_shortages', { p_po_id: poId })
        if (error) throw error
      }

      setToast({ show: true, message: 'Production Orders / PRs created successfully.', kind: 'success' })
      setOpen(false)
      onClose()
    } catch (e: any) {
      setToast({ show: true, message: e?.message || 'Failed to generate actions', kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const remindMeLater = async () => {
    try {
      setSubmitting(true)
      // Insert one alert row per shortfall line for planner review
      const payload = rows.map(r => ({ po_id: poId, product_id: r.product_id, shortfall: r.shortfall, suggestion: r.suggestion }))
      if (payload.length) {
        const { error } = await supabase.from('allocation_alerts').insert(payload)
        if (error) throw error
      }
      setOpen(false)
      onClose()
    } catch (e: any) {
      setToast({ show: true, message: e?.message || 'Failed to save reminder', kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* back-drop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => { setOpen(false); onClose() }} />

      {/* toast */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80]">
          <div className={`flex items-center gap-3 bg-white rounded-xl shadow-2xl border px-4 py-3 ${toast.kind==='error' ? 'border-accent-danger/40' : 'border-neutral-soft/40'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.kind==='error' ? 'bg-accent-danger/10' : 'bg-accent-success/15'}`}>
              <CheckCircle2 className={`h-5 w-5 ${toast.kind==='error' ? 'text-accent-danger' : 'text-accent-success'}`} />
            </div>
            <span className="text-sm font-semibold text-neutral-dark">{toast.message}</span>
          </div>
        </div>
      )}

      {/* modal */}
      <div ref={containerRef} className="relative z-[75] w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden animate-[fadeIn_160ms_ease-out]">
        <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-dark">Allocation Results — Action Required</h2>
            <p className="text-sm text-neutral-medium mt-1">Some products have insufficient finished goods. Please choose what to do next.</p>
          </div>
          <button onClick={() => { setOpen(false); onClose() }} className="p-2 rounded-lg hover:bg-white/70 text-neutral-medium hover:text-neutral-dark transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                  <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider">Needed</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider">Allocated</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-neutral-dark uppercase tracking-wider">Shortfall</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-neutral-dark uppercase tracking-wider">Suggested Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-soft/20">
                {rows.map((r, idx) => {
                  const missingChoice = !r.action
                  const suggested = r.suggestion === 'production' ? 'Create Production Order' : r.suggestion === 'purchase' ? 'Generate Purchase Requisition' : ''
                  return (
                    <tr key={r.id} className={`group ${missingChoice ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-6 py-3 text-sm text-neutral-dark font-medium flex items-center gap-2">
                        {r.product}
                        {!r.action && (
                          <span className="text-amber-700 text-xs inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/> Action required</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-dark text-right">{r.needed}</td>
                      <td className="px-6 py-3 text-sm text-neutral-dark text-right">{r.allocated}</td>
                      <td className={`px-6 py-3 text-sm text-right font-semibold ${r.shortfall>0 ? 'text-accent-danger' : 'text-neutral-dark'}`}>{r.shortfall}</td>
                      <td className="px-6 py-3 text-sm text-neutral-dark">
                        <div className="relative inline-block">
                          <Dropdown
                            buttonRef={idx===0 ? firstSelectRef : undefined}
                            value={r.action}
                            onChange={(v)=>changeAction(r.id, v)}
                            options={[
                              { value: 'production', label: ACTION_LABEL.production },
                              { value: 'purchase', label: ACTION_LABEL.purchase },
                              { value: 'skip', label: ACTION_LABEL.skip },
                            ]}
                            placeholder={suggested || ACTION_LABEL['']}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* actions */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-xs text-neutral-medium">Use Tab/Enter to navigate. Press Esc to close.</div>
            <div className="flex items-center gap-3">
              <button
                disabled={submitting}
                onClick={remindMeLater}
                className="px-4 py-2 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition disabled:opacity-60"
              >
                Remind Me Later
              </button>
              <button
                disabled={submitting || rows.length===0}
                onClick={confirmAndGenerate}
                className={`px-5 py-2.5 rounded-xl text-white shadow disabled:opacity-60 ${anyMissingAction ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary-medium hover:bg-primary-dark'}`}
                title={anyMissingAction ? 'Some rows have no action selected' : 'Generate actions'}
              >
                {submitting ? 'Processing…' : 'Confirm & Generate'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

// Simple dropdown with keyboard nav
const Dropdown: React.FC<{
  value: ActionChoice
  options: Array<{ value: ActionChoice; label: string }>
  onChange: (v: ActionChoice) => void
  placeholder?: string
  buttonRef?: React.RefObject<HTMLButtonElement>
}> = ({ value, options, onChange, placeholder, buttonRef }) => {
  const [open, setOpen] = useState(false)
  const btnRef = buttonRef || useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [btnRef])

  const label = value ? options.find(o => o.value === value)?.label || '' : (placeholder || 'Select Action')

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(v => !v)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={listRef}>
      <button
        type="button"
        ref={btnRef}
        onKeyDown={onKey}
        onClick={() => setOpen(v => !v)}
        className={`min-w-[240px] flex items-center justify-between px-3 py-2 border rounded-lg text-left bg-white transition shadow-sm hover:border-neutral-medium ${value ? 'border-neutral-soft text-neutral-dark' : 'border-amber-300 text-amber-800 bg-amber-50'}`}
      >
        <span className="text-sm font-medium truncate">{label}</span>
        <ChevronDown className="w-4 h-4 text-neutral-medium" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-[100] mt-1 w-full bg-white border border-neutral-soft rounded-xl shadow-xl overflow-hidden">
          {options.map(opt => (
            <button
              type="button"
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-neutral-light ${value===opt.value ? 'bg-neutral-light' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ShortfallModal
