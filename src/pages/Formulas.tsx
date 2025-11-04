import React, { useEffect, useRef, useState } from 'react'
import { Plus, Inbox, X } from 'lucide-react'

const Formulas: React.FC = () => {
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [category, setCategory] = useState('All Products')
  const categoryRef = useRef<HTMLDivElement>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const [form, setForm] = useState({
    product: '',
    customer: '',
    comments: '',
  })
  type Ingredient = { material: string; quantity: string; unit: string; percent: string }
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { material: '', quantity: '', unit: 'Grams', percent: '' },
  ])

  const addIngredient = () => setIngredients((prev) => [...prev, { material: '', quantity: '', unit: 'Grams', percent: '' }])
  const updateIngredient = (idx: number, patch: Partial<Ingredient>) =>
    setIngredients((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="min-h-screen bg-neutral-light/20">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-dark">Formula Manager</h1>
            <p className="text-neutral-medium">Manage product recipes and bills of materials</p>
          </div>
          <button onClick={() => setIsAddOpen(true)} className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-md hover:shadow-lg flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Add Formula
          </button>
        </div>

        {/* Top Filters */}
        <div className="mt-6 max-w-xs" ref={categoryRef}>
          <label className="mb-2 block text-sm font-medium text-neutral-dark">Category</label>
          <button
            type="button"
            onClick={() => setIsCategoryOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light shadow-sm"
          >
            <span className={category ? 'text-neutral-dark' : 'text-neutral-medium'}>
              {category || 'All Products'}
            </span>
            <span className="ml-2 text-neutral-medium">▼</span>
          </button>
          {isCategoryOpen && (
            <div className="absolute z-[100] mt-2 w-[calc(theme(width.full)_-_0px)] max-w-xs bg-white border border-neutral-soft rounded-xl shadow-xl overflow-hidden">
              <div className="px-3 py-2 text-xs text-neutral-medium">Select Category</div>
              {['All Products', 'Active', 'Draft'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${category===opt ? 'bg-neutral-light' : ''}`}
                  onClick={() => { setCategory(opt); setIsCategoryOpen(false) }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center text-center mt-16">
          <Inbox className="h-14 w-14 text-neutral-medium/40 mb-3" />
          <div className="text-neutral-dark font-semibold">No formulas found</div>
          <p className="text-sm text-neutral-medium">Create product formulas to enable accurate production planning.</p>
          <button className="mt-4 px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white text-sm font-medium shadow-sm hover:shadow-md">Create Your First Formula</button>
        </div>

        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsAddOpen(false)}></div>
            <div className="relative z-10 w-full max-w-6xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-dark">Create New Formula</h2>
                </div>
                <button onClick={() => setIsAddOpen(false)} className="p-2 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-dark">Product</label>
                  <select
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                    value={form.product}
                    onChange={(e) => setForm({ ...form, product: e.target.value })}
                  >
                    <option value="">Select Product</option>
                    <option>Sample Product A</option>
                    <option>Sample Product B</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-dark">Customer</label>
                  <select
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                    value={form.customer}
                    onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  >
                    <option value="">Select Customer</option>
                    <option>ABC Foods Inc.</option>
                    <option>Delicioso Brands</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-dark">Ingredients</h3>
                    <button type="button" onClick={addIngredient} className="px-3 py-2 rounded-lg bg-white border border-neutral-soft hover:border-neutral-medium text-sm text-neutral-dark shadow-sm">Add Ingredient</button>
                  </div>

                  {ingredients.map((ing, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-1">
                        <label className="text-xs text-neutral-medium block mb-1">Raw Material</label>
                        <select
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                          value={ing.material}
                          onChange={(e) => updateIngredient(idx, { material: e.target.value })}
                        >
                          <option value="">Select Material</option>
                          <option>Peanut</option>
                          <option>Sugar</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">Quantity</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                          placeholder="0"
                          value={ing.quantity}
                          onChange={(e) => updateIngredient(idx, { quantity: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">Unit</label>
                        <select
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                          value={ing.unit}
                          onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                        >
                          <option>Grams</option>
                          <option>Kg</option>
                          <option>Pieces</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">%</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                          placeholder="0-100"
                          value={ing.percent}
                          onChange={(e) => updateIngredient(idx, { percent: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-dark">Comments</label>
                  <textarea
                    className="w-full min-h-[100px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium resize-none"
                    placeholder="Additional notes or comments about this formula..."
                    value={form.comments}
                    onChange={(e) => setForm({ ...form, comments: e.target.value })}
                  />
                </div>
              </div>

              <div className="px-8 py-5 bg-white border-t border-neutral-soft/60 flex items-center justify-end gap-3">
                <button onClick={() => setIsAddOpen(false)} className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark bg-white hover:border-neutral-medium text-sm shadow-sm">Cancel</button>
                <button className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white text-sm font-semibold shadow-sm">Create Formula</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Formulas
