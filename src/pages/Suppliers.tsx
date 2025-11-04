import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Truck, Building2, MapPin, Phone, Star, User, Mail, Globe, CreditCard, X, Eye, Edit, Trash2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Supplier {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  website: string
  address: string
  payment_terms?: string
  materials_supplied?: string
  category: string
  rating: number
  status: string
}

const Suppliers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false)
  const [viewData, setViewData] = useState<Supplier | null>(null)
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    payment_terms: '',
    address: '',
    materials_supplied: '',
  })
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  const [addForm, setAddForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    payment_terms: '',
    address: '',
    materials_supplied: '',
  })

  const filteredSuppliers = suppliers.filter(supplier => {
    const q = searchTerm.toLowerCase()
    return (
      supplier.name.toLowerCase().includes(q) ||
      supplier.contact.toLowerCase().includes(q) ||
      supplier.email.toLowerCase().includes(q) ||
      supplier.phone.toLowerCase().includes(q) ||
      supplier.website.toLowerCase().includes(q)
    )
  })

  const totalSuppliers = suppliers.length
  const activeSuppliers = suppliers.filter(s => s.status === 'Active').length
  const averageRating = suppliers.length ? suppliers.reduce((sum, s) => sum + s.rating, 0) / suppliers.length : 0
  const categories = [...new Set(suppliers.map(s => s.category))].length

  const refresh = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('company_name', { ascending: true })
    if (error) {
      console.error('Failed to load suppliers', error)
      return
    }
    const rows = (data ?? []) as any[]
    const mapped: Supplier[] = rows.map((r) => ({
      id: String(r.id ?? ''),
      name: String(r.company_name ?? r.name ?? ''),
      contact: String(r.contact_person ?? r.contact ?? ''),
      email: r.email ? String(r.email) : '',
      phone: r.phone ? String(r.phone) : '',
      website: r.website ? String(r.website) : '',
      address: r.address ? String(r.address) : '',
      payment_terms: r.payment_terms ? String(r.payment_terms) : '',
      materials_supplied: r.materials_supplied ? String(r.materials_supplied) : '',
      category: r.category ? String(r.category) : '',
      rating: typeof r.rating === 'number' ? r.rating : 0,
      status: r.status ? String(r.status) : '',
    }))
    setSuppliers(mapped)
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(() => setToast({ show: false, message: '' }), 3000)
      return () => clearTimeout(t)
    }
  }, [toast.show])

  const handleView = (s: Supplier) => {
    setViewData(s)
    setIsViewOpen(true)
  }

  const handleEdit = (s: Supplier) => {
    setEditId(s.id)
    setEditForm({
      company_name: s.name || '',
      contact_person: s.contact || '',
      email: s.email || '',
      phone: s.phone || '',
      website: s.website || '',
      payment_terms: s.payment_terms || '',
      address: s.address || '',
      materials_supplied: s.materials_supplied || '',
    })
    setIsEditOpen(true)
  }

  const handleDelete = (s: Supplier) => {
    setDeleteTarget(s)
    setIsDeleteOpen(true)
  }

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

        {/* Success Toast */}
        {toast.show && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70]">
            <div className="flex items-center gap-3 bg-white rounded-xl shadow-2xl border border-neutral-soft/40 px-4 py-3 animate-fade-in">
              <div className="w-8 h-8 bg-accent-success/15 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-accent-success" />
              </div>
              <span className="text-sm font-semibold text-neutral-dark">{toast.message}</span>
            </div>
          </div>
        )}

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
                      // Map to your suppliers table columns
                      const payload: any = {
                        company_name: addForm.company_name,
                        contact_person: addForm.contact_person || null,
                        email: addForm.email || null,
                        phone: addForm.phone || null,
                        website: addForm.website || null,
                        payment_terms: addForm.payment_terms || null,
                        address: addForm.address || null,
                        materials_supplied: addForm.materials_supplied || null,
                      }
                      const { error } = await supabase.from('suppliers').insert(payload)
                      if (error) throw error
                      await refresh()
                      setIsAddOpen(false)
                      setAddForm({ company_name: '', contact_person: '', email: '', phone: '', website: '', payment_terms: '', address: '', materials_supplied: '' })
                      setToast({ show: true, message: 'Supplier added successfully' })
                    } catch (err: any) {
                      console.error('Failed to add supplier', err?.message || err, err)
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
                        <option>50% Deposits 50% Upon Completion </option>
                        <option>100% Upfront</option>
                        <option>Net 15</option>
                        <option>Net 30</option>
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
                      value={addForm.materials_supplied}
                      onChange={(e) => setAddForm({ ...addForm, materials_supplied: e.target.value })}
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
                      {isSubmitting ? 'Adding...' : 'Add Supplier'}
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
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Email</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Phone</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Website</th>
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
                            <div className="text-xs text-neutral-medium truncate max-w-[260px]">{supplier.website}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-medium text-neutral-dark">{supplier.contact}</div>
                      </td>
                      <td className="px-8 py-6">
                        <a href={`mailto:${supplier.email}`} className="text-sm text-primary-medium hover:underline">{supplier.email || '—'}</a>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-neutral-dark">{supplier.phone || '—'}</div>
                      </td>
                      <td className="px-8 py-6">
                        {supplier.website ? (
                          <a href={supplier.website} target="_blank" rel="noreferrer" className="text-sm text-primary-medium hover:underline truncate inline-block max-w-[220px]">{supplier.website}</a>
                        ) : (
                          <span className="text-sm text-neutral-medium">—</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center space-x-2">
                          <button type="button" onClick={() => handleView(supplier)} className="group/btn p-3 text-primary-medium hover:text-white hover:bg-primary-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium">
                            <Eye className="h-5 w-5" />
                          </button>
                          <button type="button" onClick={() => handleEdit(supplier)} className="group/btn p-3 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft hover:border-neutral-medium">
                            <Edit className="h-5 w-5" />
                          </button>
                          <button type="button" onClick={() => handleDelete(supplier)} className="group/btn p-3 text-accent-danger hover:text-white hover:bg-accent-danger rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-accent-danger/30 hover:border-accent-danger">
                            <Trash2 className="h-5 w-5" />
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

        {/* View Supplier Modal */}
        {isViewOpen && viewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsViewOpen(false)}></div>
            <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">View Supplier</h2>
                  <p className="text-sm text-neutral-medium mt-1">Supplier information overview</p>
                </div>
                <button onClick={() => setIsViewOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">✕</button>
              </div>
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Name</div>
                    <div className="text-neutral-dark font-semibold">{viewData.name}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Contact</div>
                    <div className="text-neutral-dark">{viewData.contact || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Email</div>
                    <div className="text-neutral-dark break-words">{viewData.email || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Phone</div>
                    <div className="text-neutral-dark">{viewData.phone || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Website</div>
                    <div className="text-neutral-dark break-words">{viewData.website || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Address</div>
                    <div className="text-neutral-dark break-words">{viewData.address || '—'}</div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setIsViewOpen(false)} className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Supplier Modal */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !isEditing && setIsEditOpen(false)}></div>
            <div className="relative z-10 w-full max-w-5xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Edit Supplier</h2>
                  <p className="text-sm text-neutral-medium mt-1">Update supplier information</p>
                </div>
                <button onClick={() => !isEditing && setIsEditOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (isEditing || !editId) return
                    setIsEditing(true)
                    try {
                      const payload: any = {
                        company_name: editForm.company_name,
                        contact_person: editForm.contact_person || null,
                        email: editForm.email || null,
                        phone: editForm.phone || null,
                        website: editForm.website || null,
                        payment_terms: editForm.payment_terms || null,
                        address: editForm.address || null,
                        materials_supplied: editForm.materials_supplied || null,
                      }
                      const { error } = await supabase.from('suppliers').update(payload).eq('id', editId)
                      if (error) throw error
                      await refresh()
                      setIsEditOpen(false)
                      setToast({ show: true, message: 'Supplier updated successfully' })
                    } catch (e: any) {
                      console.error(e?.message || e)
                    } finally {
                      setIsEditing(false)
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
                        value={editForm.company_name}
                        onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
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
                        value={editForm.contact_person}
                        onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
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
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
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
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
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
                        value={editForm.website}
                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
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
                        value={editForm.payment_terms}
                        onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark hover:border-neutral-medium"
                      >
                        <option value="">Select Payment Terms</option>
                        <option>50% Deposits 50% Upon Completion </option>
                        <option>100% Upfront</option>
                        <option>Net 15</option>
                        <option>Net 30</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <MapPin className="h-4 w-4 mr-2 text-primary-medium" />
                      Address
                    </label>
                    <textarea
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
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
                      value={editForm.materials_supplied}
                      onChange={(e) => setEditForm({ ...editForm, materials_supplied: e.target.value })}
                      placeholder="List materials supplied"
                      className="w-full min-h-[100px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md disabled:opacity-60"
                      disabled={isEditing}
                    >
                      {isEditing ? 'Updating...' : 'Update'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteOpen && deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setIsDeleteOpen(false)}></div>
            <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <h2 className="text-2xl font-semibold text-neutral-dark">Delete Supplier</h2>
                <p className="text-sm text-neutral-medium mt-1">This action cannot be undone.</p>
              </div>
              <div className="p-8">
                <p className="text-neutral-dark">Are you sure you want to delete "<span className="font-semibold">{deleteTarget.name}</span>"?</p>
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all disabled:opacity-60"
                    onClick={() => !deleting && setIsDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-5 py-2.5 rounded-xl bg-accent-danger text-white font-semibold hover:opacity-90 shadow-md disabled:opacity-60"
                    onClick={async () => {
                      if (!deleteTarget?.id || deleting) return
                      setDeleting(true)
                      try {
                        const { error } = await supabase.from('suppliers').delete().eq('id', deleteTarget.id)
                        if (error) throw error
                        await refresh()
                        setIsDeleteOpen(false)
                        setDeleteTarget(null)
                        setToast({ show: true, message: 'Supplier deleted successfully' })
                      } catch (e: any) {
                        console.error(e?.message || e)
                      } finally {
                        setDeleting(false)
                      }
                    }}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Suppliers
