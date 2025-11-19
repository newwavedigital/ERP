import React, { useMemo, useState } from 'react'
import { X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react'

export interface CopackSummaryProps {
  summary: any | null
  onClose: () => void
}

const StatCard: React.FC<{ label: string; value: number; tone?: 'default' | 'ok' | 'warn' }>=({ label, value, tone='default' })=>{
  const toneCls = tone==='ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : tone==='warn' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-neutral-light/40 text-neutral-dark border-neutral-soft/60'
  return (
    <div className={`rounded-xl border ${toneCls} p-4 shadow-sm`}> 
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{Number(value || 0).toLocaleString()}</div>
    </div>
  )
}

const EmptyCard: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl border border-neutral-soft/40 bg-neutral-light/30 text-neutral-medium p-4 text-sm">
    {children || 'No items to display.'}
  </div>
)

const Badge: React.FC<{ tone?: 'green'|'red'|'amber'|'indigo'|'slate'; children: React.ReactNode }>=({ tone='slate', children })=>{
  const map: Record<string,string>={
    green: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    red: 'bg-rose-100 text-rose-700 border-rose-300',
    amber: 'bg-amber-100 text-amber-800 border-amber-300',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    slate: 'bg-neutral-light/60 text-neutral-dark border-neutral-soft/60'
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${map[tone]}`}>{children}</span>
}

const CopackAllocationSummary: React.FC<CopackSummaryProps> = ({ summary, onClose }) => {
  const [showBOM, setShowBOM] = useState(true)

  if (!summary) return null

  const status = String(summary.status || '').toLowerCase()
  const statusTone = status === 'allocated' ? 'green' : status === 'backordered' ? 'red' : 'amber'

  const lines: any[] = Array.isArray(summary.lines) ? summary.lines : []

  const clientShorts = useMemo(() => lines.filter(l => !!l.is_client_material && Number(l.shortfall_qty || 0) > 0), [lines])
  const opsShorts = useMemo(() => lines.filter(l => !l.is_client_material && Number(l.shortfall_qty || 0) > 0), [lines])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-neutral-dark">Copack Allocation Summary</h2>
            <Badge tone={statusTone as any}>
              {status === 'allocated' ? 'Allocated' : status === 'backordered' ? 'Backordered' : 'Partial'}
            </Badge>
          </div>
          <button className="p-2 rounded-lg hover:bg-white/60" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-neutral-medium" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Required Qty" value={Number(summary.total_required || 0)} />
            <StatCard label="Allocated Qty" value={Number(summary.total_allocated || 0)} tone="ok" />
            <StatCard label="Shortfall" value={Number(summary.total_shortfall || 0)} tone={Number(summary.total_shortfall||0)>0 ? 'warn' : 'default'} />
          </div>

          {/* Client-Supplied Material Requests */}
          {clientShorts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-dark">Client-Supplied Material Requests</h3>
                <Badge tone="indigo">Client Requests</Badge>
              </div>
              <div className="overflow-x-auto border border-neutral-soft/40 rounded-xl">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-light/40 border-b border-neutral-soft/40">
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Material</th>
                      <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Required</th>
                      <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Allocated</th>
                      <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Shortfall</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-soft/20">
                    {clientShorts.map((l, i) => (
                      <tr key={l.material_id || i} className="bg-white">
                        <td className="px-4 py-2 text-neutral-dark">{l.material_name}</td>
                        <td className="px-4 py-2 text-right">{Number(l.required_qty||0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{Number(l.allocated_qty||0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-amber-700 font-semibold">{Number(l.shortfall_qty||0).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3.5 w-3.5" /> Client Request Needed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Operations PRs */}
          {opsShorts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-dark">Operations Purchase Requisitions</h3>
                <Badge tone="amber">Ops PRs</Badge>
              </div>
              <div className="overflow-x-auto border border-neutral-soft/40 rounded-xl">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-light/40 border-b border-neutral-soft/40">
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Material</th>
                      <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Required</th>
                      <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Allocated</th>
                      <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Shortfall</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-soft/20">
                    {opsShorts.map((l, i) => (
                      <tr key={l.material_id || i} className="bg-white">
                        <td className="px-4 py-2 text-neutral-dark">{l.material_name}</td>
                        <td className="px-4 py-2 text-right">{Number(l.required_qty||0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{Number(l.allocated_qty||0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-amber-700 font-semibold">{Number(l.shortfall_qty||0).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3.5 w-3.5" /> PR Needed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BOM Allocation Summary (Expandable) */}
          <div className="space-y-3">
            <button type="button" className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-soft/50 bg-white hover:bg-neutral-light/40" onClick={()=>setShowBOM(v=>!v)}>
              <div className="text-sm font-semibold text-neutral-dark">BOM Allocation Summary</div>
              {showBOM ? <ChevronUp className="h-5 w-5 text-neutral-medium" /> : <ChevronDown className="h-5 w-5 text-neutral-medium" />}
            </button>
            {showBOM && (
              lines.length === 0 ? <EmptyCard /> : (
                <div className="overflow-x-auto border border-neutral-soft/40 rounded-xl">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-light/40 border-b border-neutral-soft/40">
                        <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Material</th>
                        <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Required</th>
                        <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Allocated</th>
                        <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Shortfall</th>
                        <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-soft/20">
                      {lines.map((l, i) => {
                        const short = Number(l.shortfall_qty || 0) > 0
                        return (
                          <tr key={(l.material_id || '') + i} className={short ? 'bg-rose-50' : ''}>
                            <td className="px-4 py-2 text-neutral-dark">{l.material_name}</td>
                            <td className="px-4 py-2 text-right">{Number(l.required_qty||0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{Number(l.allocated_qty||0).toLocaleString()}</td>
                            <td className={`px-4 py-2 text-right ${short ? 'text-rose-700 font-semibold' : ''}`}>{Number(l.shortfall_qty||0).toLocaleString()}</td>
                            <td className="px-4 py-2">
                              {l.is_client_material ? (
                                <Badge tone="indigo">Client Material</Badge>
                              ) : (
                                <Badge tone="amber">OPS Material</Badge>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-2">
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all" onClick={onClose}>
              <CheckCircle className="h-5 w-5 text-emerald-600" /> Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CopackAllocationSummary
