import React, { useEffect, useRef, useState } from 'react'
import { Plus, Search, Filter, Users, User, Mail, Phone, Globe, BadgeCheck, Eye, Edit, Trash2, Building2, MapPin, FileText, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const Customers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false)
  const [viewData, setViewData] = useState<Customer | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    comments: '',
    status: 'Active',
  })
  const [addForm, setAddForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    comments: '',
    status: 'Active',
  })
  type Customer = {
    id: string
    name: string
    contact?: string
    email?: string
    phone?: string
    website?: string
    status?: string
    address?: string
    comments?: string
  }
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ show: boolean; message: string }>(() => ({ show: false, message: '' }))

  const refresh = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as any[]
      const mapped: Customer[] = rows.map((r) => ({
        id: String(r.id ?? ''),
        name: String(r.company_name ?? r.name ?? ''),
        contact: r.contact_person ? String(r.contact_person) : undefined,
        email: r.email ? String(r.email) : undefined,
        phone: r.phone ? String(r.phone) : undefined,
        website: r.website ? String(r.website) : undefined,
        status: r.status ? String(r.status) : undefined,
        address: r.address ? String(r.address) : undefined,
        comments: r.comments ? String(r.comments) : undefined,
      }))
      setCustomers(mapped)
    } catch (e: any) {
      setError(e?.message || 'Failed to load customers')
    } finally {
      setLoading(false)
    }
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

  const handleView = (c: Customer) => {
    setViewData(c)
    setIsViewOpen(true)
  }

  const handleEdit = (c: Customer) => {
    setEditId(c.id)
    setEditForm({
      company_name: c.name || '',
      contact_person: c.contact || '',
      email: c.email || '',
      phone: c.phone || '',
      website: c.website || '',
      address: c.address || '',
      comments: c.comments || '',
      status: c.status || 'Active',
    })
    setIsEditOpen(true)
  }

  const handleDelete = async (c: Customer) => {
    if (!c?.id) return
    // open confirmation modal
    setDeleteTarget(c)
    setIsDeleteOpen(true)
  }

  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setIsStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = customers.filter((c) => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q)
    )
  })
  .filter((c) => {
    if (statusFilter === 'All') return true
    const st = (c.status || 'Active').toLowerCase()
    return statusFilter === 'Active' ? st === 'active' : st === 'inactive'
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-2">Customers</h1>
              <p className="text-neutral-medium text-lg">Manage your customer relationships and data</p>
            </div>
            <button 
              onClick={() => setIsAddOpen(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
            >
              <Plus className="h-5 w-5 mr-3" />
              Add Customer
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-accent-danger/30 bg-accent-danger/10 text-accent-danger">
            {error}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteOpen && deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setIsDeleteOpen(false)}></div>
            <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <h2 className="text-2xl font-semibold text-neutral-dark">Delete Customer</h2>
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
                        const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id)
                        if (error) throw error
                        setCustomers((prev) => prev.filter((x) => x.id !== deleteTarget.id))
                        setIsDeleteOpen(false)
                        setDeleteTarget(null)
                        setToast({ show: true, message: 'Customer deleted successfully' })
                      } catch (e: any) {
                        setError(e?.message || 'Failed to delete customer')
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary-medium" />
              <div className="ml-4">
                <p className="text-sm font-medium text-neutral-medium">Total Customers</p>
                <p className="text-2xl font-bold text-neutral-dark">{customers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">
                Search Customers
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-medium" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className="w-full pl-12 pr-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="md:w-64 relative" ref={statusRef}>
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">
                <Filter className="h-5 w-5 mr-3 text-primary-medium" />
                Filter & Sort
              </label>
              <button
                type="button"
                onClick={() => setIsStatusOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-4 border border-neutral-soft rounded-xl text-left bg-white transition-all shadow-sm hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:shadow-md"
              >
                <span className={statusFilter === 'All' ? 'text-neutral-medium' : 'text-neutral-dark'}>
                  {statusFilter === 'All' ? 'All Segments' : statusFilter}
                </span>
                <span className="ml-2 text-neutral-medium">▼</span>
              </button>
              {isStatusOpen && (
                <div className="absolute left-0 right-0 z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                  <div className="px-3 py-2 text-xs text-neutral-medium">Select Status</div>
                  {(['All','Active','Inactive'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${statusFilter===opt ? 'bg-neutral-light' : ''}`}
                      onClick={() => { setStatusFilter(opt); setIsStatusOpen(false) }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

        {/* View Details Modal */}
        {isViewOpen && viewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsViewOpen(false)}></div>
            <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">View Details</h2>
                  <p className="text-sm text-neutral-medium mt-1">Customer information overview</p>
                </div>
                <button onClick={() => setIsViewOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">✕</button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Users className="h-4 w-4 mr-2 text-primary-medium" /> Name
                    </label>
                    <div className="text-neutral-dark font-semibold">{viewData.name || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <User className="h-4 w-4 mr-2 text-primary-medium" /> Contact
                    </label>
                    <div className="text-neutral-dark">{viewData.contact || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Mail className="h-4 w-4 mr-2 text-primary-medium" /> Email
                    </label>
                    <div className="text-neutral-dark">{viewData.email || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Phone className="h-4 w-4 mr-2 text-primary-medium" /> Phone
                    </label>
                    <div className="text-neutral-dark">{viewData.phone || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Globe className="h-4 w-4 mr-2 text-primary-medium" /> Website
                    </label>
                    <div className="text-neutral-dark break-words">{viewData.website || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" /> Status
                    </label>
                    <div>
                      <span
                        className={
                          `inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ` +
                          ((viewData.status || 'Active').toLowerCase() === 'inactive'
                            ? 'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
                            : 'bg-accent-success/10 text-accent-success border-accent-success/30')
                        }
                      >
                        {viewData.status || 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setIsViewOpen(false)} className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Customer Modal */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !isEditing && setIsEditOpen(false)}></div>
            <div className="relative z-10 w-full max-w-5xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Edit Customer</h2>
                  <p className="text-sm text-neutral-medium mt-1">Update customer information</p>
                </div>
                <button onClick={() => !isEditing && setIsEditOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  ✕
                </button>
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
                        address: editForm.address || null,
                        comments: editForm.comments || null,
                        status: editForm.status || 'Active',
                      }
                      const { error } = await supabase.from('customers').update(payload).eq('id', editId)
                      if (error) throw error
                      await refresh()
                      setIsEditOpen(false)
                      setToast({ show: true, message: 'Customer updated successfully' })
                    } catch (e: any) {
                      setError(e?.message || 'Failed to update customer')
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
                        placeholder="e.g., ABC Foods Inc."
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
                        placeholder="e.g., John Dela Cruz"
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
                        placeholder="john@company.com"
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
                        placeholder="+63 900 000 0000"
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
                        <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" />
                        Status
                      </label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark hover:border-neutral-medium"
                      >
                        <option>Active</option>
                        <option>Inactive</option>
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
                      placeholder="Street, City, Country"
                      className="w-full min-h-[80px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                      Comments
                    </label>
                    <textarea
                      value={editForm.comments}
                      onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })}
                      placeholder="Additional notes about this customer"
                      className="w-full min-h-[80px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
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

        {/* Add Customer Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !isSubmitting && setIsAddOpen(false)}></div>
            <div className="relative z-10 w-full max-w-5xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Add New Customer</h2>
                  <p className="text-sm text-neutral-medium mt-1">Create a new customer profile</p>
                </div>
                <button onClick={() => !isSubmitting && setIsAddOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (isSubmitting) return
                    setIsSubmitting(true)
                    try {
                      const payload: any = {
                        company_name: addForm.company_name,
                        contact_person: addForm.contact_person || null,
                        email: addForm.email || null,
                        phone: addForm.phone || null,
                        website: addForm.website || null,
                        address: addForm.address || null,
                        comments: addForm.comments || null,
                        status: addForm.status || 'Active',
                      }
                      const { error } = await supabase.from('customers').insert(payload)
                      if (error) throw error
                      await refresh()
                      setIsAddOpen(false)
                      setToast({ show: true, message: 'Customer added successfully' })
                      setAddForm({ company_name: '', contact_person: '', email: '', phone: '', website: '', address: '', comments: '', status: 'Active' })
                    } catch (e: any) {
                      setError(e?.message || 'Failed to save customer')
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
                        placeholder="e.g., ABC Foods Inc."
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
                        placeholder="e.g., John Dela Cruz"
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
                        placeholder="john@company.com"
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
                        placeholder="+63 900 000 0000"
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
                        <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" />
                        Status
                      </label>
                      <select
                        value={addForm.status}
                        onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark hover:border-neutral-medium"
                      >
                        <option>Active</option>
                        <option>Inactive</option>
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
                      placeholder="Street, City, Country"
                      className="w-full min-h-[80px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                      Comments
                    </label>
                    <textarea
                      value={addForm.comments}
                      onChange={(e) => setAddForm({ ...addForm, comments: e.target.value })}
                      placeholder="Additional notes about this customer"
                      className="w-full min-h-[80px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md disabled:opacity-60"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Adding...' : 'Add Customer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table + Empty State (Products-style header) */}
        <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
          {/* Gradient header section */}
          <div className="px-10 py-8 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-neutral-dark mb-2">Customer Directory</h3>
              </div>
              <div className="px-4 py-2 bg-primary-light/10 rounded-xl border border-primary-light/20">
                <span className="text-sm font-semibold text-primary-dark">{filtered.length} Total</span>
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
                      <Users className="h-4 w-4 text-primary-medium" />
                      <span>Name</span>
                    </div>
                  </th>
                  <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-primary-medium" />
                      <span>Contact</span>
                    </div>
                  </th>
                  <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-primary-medium" />
                      <span>Email</span>
                    </div>
                  </th>
                  <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-primary-medium" />
                      <span>Phone</span>
                    </div>
                  </th>
                  <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-primary-medium" />
                      <span>Website</span>
                    </div>
                  </th>
                  <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <BadgeCheck className="h-4 w-4 text-primary-medium" />
                      <span>Status</span>
                    </div>
                  </th>
                  <th className="px-8 py-6 text-center text-sm font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-soft/20">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-8 py-10 text-center text-neutral-medium">Loading customers…</td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-8 py-10 text-center text-neutral-medium">No customers found</td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id} className="group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-neutral-light/60 rounded-xl flex items-center justify-center shadow-sm">
                          <Users className="h-6 w-6 text-primary-dark" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-dark truncate max-w-[260px]">{c.name || '—'}</div>
                          {c.website && <div className="text-xs text-neutral-medium truncate max-w-[260px]">{c.website}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-medium text-neutral-dark">{c.contact || '—'}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm text-neutral-dark">{c.email || '—'}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm text-neutral-dark">{c.phone || '—'}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm text-neutral-dark truncate max-w-[220px]">{c.website || '—'}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span
                        className={
                          `inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ` +
                          ((c.status || 'Active').toLowerCase() === 'inactive'
                            ? 'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
                            : 'bg-accent-success/10 text-accent-success border-accent-success/30')
                        }
                      >
                        {c.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center space-x-2">
                        <button type="button" onClick={() => handleView(c)} className="group/btn p-3 text-primary-medium hover:text-white hover:bg-primary-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium">
                          <Eye className="h-5 w-5" />
                        </button>
                        <button type="button" onClick={() => handleEdit(c)} className="group/btn p-3 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft hover:border-neutral-medium">
                          <Edit className="h-5 w-5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(c)} className="group/btn p-3 text-accent-danger hover:text-white hover:bg-accent-danger rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-accent-danger/30 hover:border-accent-danger">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && (
            <div className="p-16 text-center">
              <p className="text-neutral-medium mb-4">No customers found</p>
              <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md">
                Add Your First Customer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Customers
