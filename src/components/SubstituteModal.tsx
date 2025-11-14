import React from 'react'

interface Props {
  open: boolean
  items: Array<{ product_name: string }>
  productsIndex: Record<string, any>
  onUseSubstitute: () => void
  onCancel: () => void
}

const SubstituteModal: React.FC<Props> = ({ open, items, productsIndex, onUseSubstitute, onCancel }) => {
  if (!open) return null
  const list = items.map(it => {
    const p = productsIndex[it.product_name] || {}
    return { line: it.product_name, substitute: p?.substitute_sku || null }
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel}></div>
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Use Substitute SKU?</h3>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <p className="text-neutral-dark">This SKU is discontinued. Do you want to use its substitute instead?</p>
          <div className="space-y-2">
            {list.map((row, i) => (
              <div key={i} className="flex items-center justify-between border border-neutral-soft rounded-lg px-3 py-2">
                <div>
                  <div className="text-xs text-neutral-medium">Original</div>
                  <div className="font-medium">{row.line}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-medium">Substitute</div>
                  <div className="font-semibold text-primary-dark">{row.substitute || '—'}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 rounded-lg border" onClick={onCancel}>Cancel Approval</button>
            <button className="px-4 py-2 rounded-lg bg-primary-dark text-white" onClick={onUseSubstitute}>Use Substitute</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubstituteModal
