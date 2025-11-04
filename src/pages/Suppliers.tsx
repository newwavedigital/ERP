import React, { useState } from 'react'
import { Plus, Search, Filter, Truck, Building2, MapPin, Phone, Star, User, Mail, Globe, CreditCard, X } from 'lucide-react'

interface Supplier {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  address: string
  category: string
  rating: number
  status: string
}

const Suppliers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [suppliers] = useState<Supplier[]>([]) // Empty for now, will be populated from backend
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [addForm, setAddForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    payment_terms: '',
    address: '',
    materials: '',
  })

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalSuppliers = suppliers.length
  const activeSuppliers = suppliers.filter(s => s.status === 'Active').length
  const averageRating = suppliers.length ? suppliers.reduce((sum, s) => sum + s.rating, 0) / suppliers.length : 0
  const categories = [...new Set(suppliers.map(s => s.category))].length

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-2">Suppliers</h1>
              <p className="text-neutral-medium text-lg">Manage your supplier relationships and procurement</p>
            </div>
            <button onClick={() => setIsAddOpen(true)} className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center">
              <Plus className="h-5 w-5 mr-3" />
              Add Supplier
            </button>
          </div>
        </div>

        {/* Add Supplier Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !isSubmitting && setIsAddOpen(false)}></div>
            <div className="relative z-10 w-full max-w-5xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Add New Supplier</h2>
                  <p className="text-sm text-neutral-medium mt-1">Create a new supplier profile</p>
                </div>
                <button onClick={() => !isSubmitting && setIsAddOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (isSubmitting) return
                    setIsSubmitting(true)
                    try {
                      // Placeholder: integrate with backend later
                      setIsAddOpen(false)
                      setAddForm({ company_name: '', contact_person: '', email: '', phone: '', website: '', payment_terms: '', address: '', materials: '' })
                    } finally {
                      setIsSubmitting(false)
                    }
                  }}
                  className="p-8 space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Building2 className="h-4 w-4 mr-2 text-primary-medium" />
                        Company Name<span className="text-accent-danger ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={addForm.company_name}
                        onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })}
                        placeholder="e.g., Premium Peanut Co."
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <User className="h-4 w-4 mr-2 text-primary-medium" />
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={addForm.contact_person}
                        onChange={(e) => setAddForm({ ...addForm, contact_person: e.target.value })}
                        placeholder="e.g., John Smith"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Mail className="h-4 w-4 mr-2 text-primary-medium" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={addForm.email}
                        onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                        placeholder="contact@supplier.com"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Phone className="h-4 w-4 mr-2 text-primary-medium" />
                        Phone
                      </label>
                      <input
                        type="text"
                        value={addForm.phone}
                        onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                        placeholder="555-0123"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Globe className="h-4 w-4 mr-2 text-primary-medium" />
                        Website
                      </label>
                      <input
                        type="url"
                        value={addForm.website}
                        onChange={(e) => setAddForm({ ...addForm, website: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <CreditCard className="h-4 w-4 mr-2 text-primary-medium" />
                        Payment Terms
                      </label>
                      <select
                        value={addForm.payment_terms}
                        onChange={(e) => setAddForm({ ...addForm, payment_terms: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark hover:border-neutral-medium"
                      >
                        <option value="">Select Payment Terms</option>
                        <option>Prepaid</option>
                        <option>COD</option>
                        <option>Net 15</option>
                        <option>Net 30</option>
                        <option>Net 45</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <MapPin className="h-4 w-4 mr-2 text-primary-medium" />
                      Address
                    </label>
                    <textarea
                      value={addForm.address}
                      onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                      placeholder="Full business address including city, state, ZIP"
                      className="w-full min-h-[80px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <Truck className="h-4 w-4 mr-2 text-primary-medium" />
                      Materials Supplied
                    </label>
                    <textarea
                      value={addForm.materials}
                      onChange={(e) => setAddForm({ ...addForm, materials: e.target.value })}
                      placeholder="Hold Ctrl/Cmd to select multiple materials (for now, list materials)"
                      className="w-full min-h-[100px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md disabled:opacity-60"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Saving...' : 'Save Supplier'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-medium/20 to-primary-medium/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <Truck className="h-7 w-7 text-primary-medium" />
              </div>
              <div className="w-2 h-2 bg-primary-medium rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Total Suppliers</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">{totalSuppliers}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-primary-medium to-primary-light rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Suppliers</span>
              </div>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-accent-success/20 to-accent-success/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <Building2 className="h-7 w-7 text-accent-success" />
              </div>
              <div className="w-2 h-2 bg-accent-success rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Active Suppliers</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">{activeSuppliers}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-accent-success to-accent-success/40 rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Active</span>
              </div>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-accent-warning/25 to-accent-warning/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <Star className="h-7 w-7 text-accent-warning" />
              </div>
              <div className="w-2 h-2 bg-accent-warning rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Avg Rating</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">{averageRating.toFixed(1)}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-accent-warning to-accent-warning/40 rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Stars</span>
              </div>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-dark/20 to-primary-dark/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <MapPin className="h-7 w-7 text-primary-dark" />
              </div>
              <div className="w-2 h-2 bg-primary-dark rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Categories</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">{categories}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-primary-dark to-primary-medium rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Types</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">
                Search Suppliers
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-medium" />
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  className="w-full pl-12 pr-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="md:w-64">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">
                <Filter className="h-5 w-5 mr-3 text-primary-medium" />
                Filter & Sort
              </label>
              <button className="w-full px-4 py-4 border border-neutral-soft rounded-xl text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all shadow-sm hover:shadow-md flex items-center justify-between">
                <span className="text-neutral-medium">All Categories</span>
                <Filter className="h-5 w-5 text-neutral-medium" />
              </button>
            </div>
          </div>
        </div>

        {/* Table or Empty State */}
        {filteredSuppliers.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="px-10 py-8 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-dark mb-2">Supplier Directory</h3>
                <div className="px-4 py-2 bg-primary-light/10 rounded-xl border border-primary-light/20">
                  <span className="text-sm font-semibold text-primary-dark">0 Total</span>
                </div>
              </div>
            </div>
            <div className="p-16 text-center">
              <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
                <Truck className="h-8 w-8 text-primary-medium" />
              </div>
              <p className="text-neutral-medium mb-1">No suppliers found</p>
              <p className="text-sm text-neutral-medium">Add suppliers to manage your raw material sourcing.</p>
              <button className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md flex items-center mx-auto">
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Supplier
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
            {/* Gradient header section */}
            <div className="px-10 py-8 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-dark mb-2">Supplier Directory</h3>
                <div className="px-4 py-2 bg-primary-light/10 rounded-xl border border-primary-light/20">
                  <span className="text-sm font-semibold text-primary-dark">{filteredSuppliers.length} Total</span>
                </div>
              </div>
            </div>
            {/* Column headers */}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-primary-medium" />
                        <span>Supplier</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Contact</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Category</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Rating</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Status</th>
                    <th className="px-8 py-6 text-center text-sm font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-soft/20">
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm">
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-neutral-light/60 rounded-xl flex items-center justify-center shadow-sm">
                            <Truck className="h-6 w-6 text-primary-dark" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-neutral-dark truncate max-w-[260px]">{supplier.name}</div>
                            <div className="text-xs text-neutral-medium truncate max-w-[260px]">{supplier.address}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-medium text-neutral-dark">{supplier.contact}</div>
                        <div className="text-xs text-neutral-medium">{supplier.email}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-light/10 text-primary-dark border border-primary-light/30">{supplier.category}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-accent-warning mr-1" />
                          <span className="text-sm font-medium text-neutral-dark">{supplier.rating.toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                          supplier.status === 'Active' 
                            ? 'bg-accent-success/10 text-accent-success border-accent-success/30'
                            : 'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
                        }`}>{supplier.status}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center space-x-2">
                          <button className="group/btn p-3 text-primary-medium hover:text-white hover:bg-primary-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium">
                            <Phone className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Suppliers
