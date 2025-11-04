import React, { useState, useEffect, useRef } from 'react'
import { Plus, Package, Box, Factory, LineChart, Inbox, Landmark, CheckCircle, X, Tag, User, Scale, DollarSign, ClipboardList } from 'lucide-react'

interface InventoryItem {
  id: number
  name: string
}

const Inventory: React.FC = () => {
  const [mainTab, setMainTab] = useState<'raw' | 'packaging' | 'finished'>('raw')
  const [subTab, setSubTab] = useState<'list' | 'forecast'>('list')
  const [items] = useState<InventoryItem[]>([])
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isSupplierOpen, setIsSupplierOpen] = useState(false)
  const [isUomOpen, setIsUomOpen] = useState(false)
  const [isAddRawOpen, setIsAddRawOpen] = useState(false)
  const [rawForm, setRawForm] = useState({
    name: '',
    category: '',
    newCategory: '',
    supplier: '',
    uom: 'Kilograms (kg)',
    unitWeight: '',
    costPerUnit: '',
    totalAvailable: '',
  })
  const rawCategories = ['Ingredient', 'Packaging', 'Additive']
  const suppliers: string[] = []
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
                Raw Materials ({items.length})
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
          <div className="bg-white rounded-2xl border border-neutral-soft/20 shadow-md p-14 flex flex-col items-center justify-center">
            <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-5">
              <Factory className="h-8 w-8 text-primary-medium" />
            </div>
            <div className="text-neutral-dark font-semibold mb-2">Finished Goods Inventory</div>
            <p className="text-sm text-neutral-medium mb-8 text-center">Track your completed products ready for shipment.</p>
            <div className="w-full max-w-xl bg-neutral-light/60 border border-neutral-soft rounded-xl p-6">
              <p className="text-sm text-neutral-medium mb-4 text-center">This section will display your finished goods inventory including:</p>
              <ul className="space-y-3 mx-auto max-w-md">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent-success mt-0.5" />
                  <span className="text-neutral-dark text-sm">Completed product quantities by SKU</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent-success mt-0.5" />
                  <span className="text-neutral-dark text-sm">Storage location and batch information</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent-success mt-0.5" />
                  <span className="text-neutral-dark text-sm">Quality control status and certifications</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent-success mt-0.5" />
                  <span className="text-neutral-dark text-sm">Available vs allocated stock levels</span>
                </li>
              </ul>
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
              <div className="bg-white rounded-2xl border border-neutral-soft/20 shadow-md p-12 flex flex-col items-center justify-center">
                <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
                  <Inbox className="h-8 w-8 text-primary-medium" />
                </div>
                <div className="text-neutral-dark font-semibold mb-1">No {titleByTab[mainTab].toLowerCase()} found</div>
                <p className="text-sm text-neutral-medium mb-6">Add a new item to track your inventory.</p>
                <button onClick={() => { if (mainTab==='raw') setIsAddRawOpen(true) }} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm text-white bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light shadow">
                  <Plus className="h-4 w-4" /> Add Your First {titleByTab[mainTab].slice(0, -1)}
                </button>
              </div>
            )}
          </>
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
                <form onSubmit={(e)=>{e.preventDefault(); setIsAddRawOpen(false)}} className="p-8 space-y-6">
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
                        onClick={() => { if (suppliers.length>0) setIsSupplierOpen((v)=>!v) }}
                        disabled={suppliers.length===0}
                        className={`w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all ${suppliers.length===0 ? 'opacity-60 cursor-not-allowed' : 'hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light'}`}
                      >
                        <span className={rawForm.supplier ? 'text-neutral-dark' : 'text-neutral-medium'}>
                          {rawForm.supplier || 'Select Supplier'}
                        </span>
                        <span className="ml-2 text-neutral-medium">▼</span>
                      </button>
                      {suppliers.length===0 && (
                        <p className="text-xs text-accent-danger">No suppliers found. Add suppliers first in the Suppliers section.</p>
                      )}
                      {isSupplierOpen && (
                        <div className="relative">
                          <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                            <div className="px-3 py-2 text-xs text-neutral-medium">Select Supplier</div>
                            {suppliers.map((s) => (
                              <button
                                key={s}
                                type="button"
                                className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${rawForm.supplier===s ? 'bg-neutral-light' : ''}`}
                                onClick={() => { setRawForm({ ...rawForm, supplier: s }); setIsSupplierOpen(false) }}
                              >
                                {s}
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
                    <button type="submit" className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white shadow">Create Material</button>
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
