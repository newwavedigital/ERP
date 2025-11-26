import React, { useState, useEffect, useRef } from 'react'
import { Plus, Search, Filter, Edit, Trash2, Eye, X, User, Package, Box, Scale, Calendar, FileText, Upload, CheckCircle2, FlaskConical, List, Grid3X3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Formulas from './Formulas'

// Map filename extension to themed badge styles
const getFileMeta = (name?: string) => {
  const raw = String(name || '').toLowerCase()
  const ext = raw.includes('.') ? raw.split('.').pop() || '' : ''
  let cls = 'bg-neutral-100 text-neutral-700'
  let label = (ext || 'file').toUpperCase()
  if (ext === 'pdf') { cls = 'bg-red-100 text-red-700'; label = 'PDF' }
  else if (ext === 'doc' || ext === 'docx') { cls = 'bg-blue-100 text-blue-700'; label = 'DOC' }
  else if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') { cls = 'bg-emerald-100 text-emerald-700'; label = 'XLS' }
  else if (ext === 'ppt' || ext === 'pptx') { cls = 'bg-orange-100 text-orange-700'; label = 'PPT' }
  else if (ext === 'txt' || ext === 'rtf') { cls = 'bg-neutral-100 text-neutral-700'; label = ext.toUpperCase() }
  return { cls, label }
}

// Derive a clean filename for display from a stored URL/safe filename
const prettyFileName = (src?: string) => {
  if (!src) return ''
  try {
    const last = decodeURIComponent(new URL(src).pathname.split('/').pop() || '')
    // remove leading timestamp or numeric prefix like 1699999999999- or 1699999_
    return last.replace(/^\d{6,}[-_]/, '')
  } catch {
    // fallback: just strip numeric prefix if present in raw string
    const base = String(src).split('/').pop() || String(src)
    return base.replace(/^\d{6,}[-_]/, '')
  }
}

interface Product {
  id: string
  product_name: string
  customer_name: string
  product_type: string
  packaging_type: string
  unit_of_measure: string
  shelf_life_days: number
  created_at: string | null
  product_image_url: string[]
  description: string
  product_file_url?: string | null
  product_file_urls?: string[]
  formula_id?: string | null
  formula_name?: string | null
  cost?: number | null
  case_dimension?: string | null
  case_qty?: number | null
}

// Supabase client is provided as a singleton from ../lib/supabase

const Products: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [imageModalUrls, setImageModalUrls] = useState<string[]>([])
  const [imageModalDescription, setImageModalDescription] = useState<string>('')
  const [imageModalFiles, setImageModalFiles] = useState<string[]>([])
  const [docsLayout, setDocsLayout] = useState<'list' | 'grid'>('list')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<{
    id: string
    product_name: string
    customer_name: string
    customerId?: string
    product_type: string
    packaging_type: string
    unit_of_measure: string
    shelf_life_days: number | string
    description: string
    product_image_url: string[]
    product_file_url?: string | null
    product_file_urls?: string[]
    formula_id?: string | null
    formula_name?: string | null
    cost?: number | string
    case_dimension?: string | null
    case_qty?: number | string | null
  } | null>(null)

  const [isEditUploading, setIsEditUploading] = useState(false)
  const [editUploadError, setEditUploadError] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; product: Product | null; loading: boolean; error: string | null }>({ open: false, product: null, loading: false, error: null })
  const [productForm, setProductForm] = useState({
    name: '',
    customer: '',
    customerId: '' as string,
    productType: '',
    packagingType: '',
    uom: '',
    shelfLife: '',
    cost: '',
    caseDimension: '',
    caseQty: '',
    docFiles: [] as File[],
    images: [] as File[],
  })
  type Customer = { id: string; name: string }
  const [customers, setCustomers] = useState<Customer[]>([])
  const [productTypes, setProductTypes] = useState<string[]>([])
  const [packagingTypes, setPackagingTypes] = useState<string[]>(['Jars', 'Squeeze Packs', 'Sachets', 'Bottles', 'Boxes'])
  const uoms = ['Grams (g)', 'Pieces', 'Bottles', 'Jars', 'Boxes']

  const [showAddProductType, setShowAddProductType] = useState(false)
  const [showAddPackagingType, setShowAddPackagingType] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [isCustomerOpen, setIsCustomerOpen] = useState(false)
  const [isProductTypeOpen, setIsProductTypeOpen] = useState(false)
  const [isPackagingTypeOpen, setIsPackagingTypeOpen] = useState(false)
  const [isUomOpen, setIsUomOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(true)
  const [customersError, setCustomersError] = useState<string | null>(null)
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  const [docDragOver, setDocDragOver] = useState(false)
  const [editDocDragOver, setEditDocDragOver] = useState(false)
  const [activeTab, setActiveTab] = useState<'products' | 'formulas'>('products')
  const [formulaOpenSignal, setFormulaOpenSignal] = useState(0)

  const customerRef = useRef<HTMLDivElement>(null)
  const productTypeRef = useRef<HTMLDivElement>(null)
  const packagingTypeRef = useRef<HTMLDivElement>(null)
  const uomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docFileInputRef = useRef<HTMLInputElement>(null)
  const editDocFileInputRef = useRef<HTMLInputElement>(null)
  const [editDocFiles, setEditDocFiles] = useState<File[]>([])

  // Formulas dropdown state
  type FormulaItem = { id: string; formula_name: string; product_name?: string; customer_name?: string }
  const [formulas, setFormulas] = useState<FormulaItem[]>([])
  const [formulasLoading, setFormulasLoading] = useState(false)
  const [isFormulaOpen, setIsFormulaOpen] = useState(false)
  const formulaRef = useRef<HTMLDivElement>(null)
  const [selectedFormula, setSelectedFormula] = useState<FormulaItem | null>(null)
  // For Edit modal
  const [isEditFormulaOpen, setIsEditFormulaOpen] = useState(false)
  const editFormulaRef = useRef<HTMLDivElement>(null)
  const [editSelectedFormula, setEditSelectedFormula] = useState<FormulaItem | null>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(event.target as Node)) {
        setIsCustomerOpen(false)
      }

      if (productTypeRef.current && !productTypeRef.current.contains(event.target as Node)) {
        setIsProductTypeOpen(false)
      }
      if (packagingTypeRef.current && !packagingTypeRef.current.contains(event.target as Node)) {
        setIsPackagingTypeOpen(false)
      }
      if (uomRef.current && !uomRef.current.contains(event.target as Node)) {
        setIsUomOpen(false)
      }
      if (formulaRef.current && !formulaRef.current.contains(event.target as Node)) {
        setIsFormulaOpen(false)
      }
      if (editFormulaRef.current && !editFormulaRef.current.contains(event.target as Node)) {
        setIsEditFormulaOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-hide toast after a short delay
  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(() => setToast({ show: false, message: '' }), 3000)
      return () => clearTimeout(t)
    }
  }, [toast.show])

  // Manage body scroll lock and set title when editing
  useEffect(() => {
    const anyModal = isAddOpen || imageModalOpen || !!lightboxUrl || isEditOpen
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = anyModal ? 'hidden' : ''
    if (isEditOpen && editForm) {
      const prevTitle = document.title
      document.title = `Editing: ${editForm.product_name}`
      return () => {
        document.title = prevTitle
        document.body.style.overflow = prevOverflow
      }
    }
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isAddOpen, imageModalOpen, lightboxUrl, isEditOpen, editForm])

  // Load formulas when Add or Edit modal opens
  useEffect(() => {
    const loadFormulas = async () => {
      try {
        setFormulasLoading(true)
        const { data, error } = await supabase
          .from('formulas')
          .select('id, formula_name, products:formulas_product_id_fkey ( product_name ), customers:formulas_customer_id_fkey ( company_name )')
          .order('created_at', { ascending: false })
        if (!error) {
          const items: FormulaItem[] = (data ?? []).map((f: any) => ({
            id: String(f.id),
            formula_name: String(f.formula_name ?? ''),
            product_name: String(f.products?.product_name ?? ''),
            customer_name: String(f.customers?.company_name ?? ''),
          }))
          setFormulas(items)
        }
      } finally {
        setFormulasLoading(false)
      }
    }
    if (isAddOpen || isEditOpen) loadFormulas()
  }, [isAddOpen, isEditOpen])

  // When opening Edit modal, preselect formula from editForm if present
  useEffect(() => {
    if (isEditOpen && editForm) {
      if (editForm.formula_id) {
        setEditSelectedFormula({ id: editForm.formula_id, formula_name: editForm.formula_name || '' } as any)
      } else {
        setEditSelectedFormula(null)
      }
    }
  }, [isEditOpen, editForm?.formula_id, editForm?.formula_name])

  const hiddenEditFileInputRef = useRef<HTMLInputElement | null>(null)
  const handleTriggerEditUpload = () => {
    hiddenEditFileInputRef.current?.click()
  }
  const handleEditImageUpload = async (files: FileList | null) => {
    if (!files || !editForm) return
    setEditUploadError(null)
    setIsEditUploading(true)
    try {
      const uploadedUrls: string[] = []
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
        const path = `products/${editForm.id}/${Date.now()}-${safeName}`
        const { error: upErr } = await supabase.storage.from('ERP_storage').upload(path, file, { upsert: false })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('ERP_storage').getPublicUrl(path)
        if (pub?.publicUrl) uploadedUrls.push(pub.publicUrl)
      }
      setEditForm((prev) => prev ? { ...prev, product_image_url: [...(prev.product_image_url || []), ...uploadedUrls] } : prev)
    } catch (e: any) {
      setEditUploadError(e?.message || 'Failed to upload images')
    } finally {
      setIsEditUploading(false)
      if (hiddenEditFileInputRef.current) hiddenEditFileInputRef.current.value = ''
    }
  }

  // Load products from Supabase and keep in sync with realtime changes
  useEffect(() => {
    const loadProducts = async () => {
      if (!supabase) return
      const { data, error } = await supabase
        .from('products')
        .select('id, product_name, product_type, packaging_type, customer_name, unit_of_measure, shelf_life_days, created_at, product_image_url, product_file_url, formula_id, formula_name, cost, case_dimension, case_qty')

      if (error) {
        console.error('Failed to fetch products', error)
        return
      }

      const rows = (data ?? []) as Array<{
        id: string
        product_name: string | null
        product_type: string | null
        packaging_type: string | null
        customer_name?: string | null
        unit_of_measure?: string | null
        shelf_life_days?: number | null
        created_at?: string | null
        product_image_url?: string | string[] | null
        product_file_url?: string | null
        formula_id?: string | null
        formula_name?: string | null
        cost?: number | null
        case_dimension?: string | null
        case_qty?: number | null
      }>

      // Client-side sort to avoid backend order-related errors
      rows.sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at as string) : 0
        const tb = b.created_at ? Date.parse(b.created_at as string) : 0
        return tb - ta
      })
      const mapped: Product[] = rows.map((r) => {
        let urls: string[] = []
        if (Array.isArray(r.product_image_url)) {
          urls = (r.product_image_url as string[]).filter(Boolean)
        } else if (typeof r.product_image_url === 'string') {
          try {
            const parsed = JSON.parse(r.product_image_url)
            if (Array.isArray(parsed)) urls = parsed.filter(Boolean)
            else if (typeof parsed === 'string') urls = [parsed]
            else urls = r.product_image_url.split(',').map((s) => s.trim()).filter(Boolean)
          } catch {
            urls = r.product_image_url.split(',').map((s) => s.trim()).filter(Boolean)
          }
        }

        // Parse product_file_url which may contain a JSON array string
        let docUrls: string[] = []
        if (r.product_file_url) {
          try {
            const parsed = JSON.parse(r.product_file_url)
            if (Array.isArray(parsed)) docUrls = parsed.filter(Boolean)
            else if (typeof parsed === 'string') docUrls = [parsed]
          } catch {
            // Fallback: accept comma-separated string
            if (typeof r.product_file_url === 'string') {
              docUrls = r.product_file_url.split(',').map((s) => s.trim()).filter(Boolean)
            }
          }
        }

        return {
          id: String(r.id),
          product_name: String(r.product_name ?? ''),
          customer_name: String(r.customer_name ?? ''),
          product_type: String(r.product_type ?? ''),
          packaging_type: String(r.packaging_type ?? ''),
          unit_of_measure: String(r.unit_of_measure ?? ''),
          shelf_life_days: Number(r.shelf_life_days ?? 0),
          created_at: r.created_at ?? null,
          product_image_url: urls,
          description: '',
          product_file_url: r.product_file_url || null,
          product_file_urls: docUrls,
          formula_id: r.formula_id ?? null,
          formula_name: r.formula_name ?? null,
          cost: (typeof r.cost === 'number' ? r.cost : (r.cost ? Number(r.cost) : null)),
          case_dimension: (r.case_dimension ?? null) as any,
          case_qty: (typeof r.case_qty === 'number' ? r.case_qty : (r.case_qty ? Number(r.case_qty) : null)),
        }
      })
      setProducts(mapped)
    }

    loadProducts()

    const channel = supabase
      ?.channel('realtime-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        loadProducts()
      })
      .subscribe()

    return () => {
      if (channel) supabase?.removeChannel(channel)
    }
  }, [])

  // Build and cleanup image preview URLs when images change
  useEffect(() => {
    if (productForm.images && productForm.images.length > 0) {
      const urls: string[] = []
      productForm.images.forEach((f) => {
        if (f.type?.startsWith('image/')) {
          urls.push(URL.createObjectURL(f))
        }
      })
      setImagePreviews(urls)
      return () => urls.forEach((u) => URL.revokeObjectURL(u))
    } else {
      setImagePreviews([])
    }
  }, [productForm.images])

  // Load customers from Supabase on mount
  useEffect(() => {
    const loadCustomers = async () => {
      if (!supabase) {
        console.warn('Supabase client is not configured. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.')
        setCustomersLoading(false)
        setCustomersError('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local')
        return
      }
      setCustomersLoading(true)
      setCustomersError(null)
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name', { ascending: true })

      if (error) {
        console.error('Failed to fetch customers', error)
        setCustomersError('Cannot load customers. Check RLS policies for table "customers".')
        setCustomersLoading(false)
        return
      }
      const rows = ((data ?? []) as Array<{ id: string; company_name: string | null }>)
      const items: Customer[] = rows
        .map((r) => ({ id: String(r.id), name: String(r.company_name ?? '') }))
        .filter((r: Customer) => r.id && r.name.trim().length > 0)
      setCustomers(items)
      setCustomersLoading(false)
    }
    loadCustomers()
  }, [])

  // Load Product Types from inventory_materials (distinct product_name) and subscribe to realtime updates
  useEffect(() => {
    const loadProductTypes = async () => {
      if (!supabase) return
      const { data, error } = await supabase
        .from('inventory_materials')
        .select('product_name')
      if (error) {
        console.error('Failed to fetch product types from inventory_materials', error)
        return
      }
      const names = (data ?? [])
        .map((r: any) => String(r.product_name ?? '').trim())
        .filter((n: string) => n.length > 0)
      const uniqueSorted = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
      setProductTypes(uniqueSorted)
    }
    loadProductTypes()

    const channel = supabase
      ?.channel('realtime-inventory-materials-types')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_materials' }, () => {
        loadProductTypes()
      })
      .subscribe()

    return () => {
      if (channel) supabase?.removeChannel(channel)
    }
  }, [])

  const filteredProducts = products.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        {/* Header (changes with tab) */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-2">{activeTab === 'products' ? 'Products' : 'Formula Manager'}</h1>
              <p className="text-neutral-medium text-lg">{activeTab === 'products' ? 'Manage your product catalog with ease' : 'Manage product recipes and bills of materials'}</p>
            </div>
            {activeTab === 'products' ? (
              <button 
                onClick={() => setIsAddOpen(true)} 
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
              >
                <Plus className="h-5 w-5 mr-3" />
                Add Product
              </button>
            ) : (
              <button 
                onClick={() => setFormulaOpenSignal((s) => s + 1)} 
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
              >
                <Plus className="h-5 w-5 mr-3" />
                Add Formula
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div role="tablist" aria-label="Products navigation" className="relative inline-flex items-center rounded-2xl bg-white shadow border border-neutral-soft/30 p-1">
            {/* sliding highlight */}
            <span
              aria-hidden
              className={`absolute top-1 bottom-1 w-1/2 rounded-xl bg-gradient-to-r from-primary-light/20 to-primary-medium/10 shadow-sm transition-all duration-300 ease-out ${activeTab==='products' ? 'left-1' : 'left-1/2'}`}
            />
            <button
              role="tab"
              aria-selected={activeTab==='products'}
              type="button"
              onClick={() => setActiveTab('products')}
              className={`relative z-10 px-5 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors ${activeTab==='products' ? 'text-primary-dark' : 'text-neutral-medium hover:text-neutral-dark'}`}
            >
              <Package className="h-4 w-4" />
              Products
            </button>
            <button
              role="tab"
              aria-selected={activeTab==='formulas'}
              type="button"
              onClick={() => setActiveTab('formulas')}
              className={`relative z-10 px-5 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors ${activeTab==='formulas' ? 'text-primary-dark' : 'text-neutral-medium hover:text-neutral-dark'}`}
            >
              <FlaskConical className="h-4 w-4" />
              Formulas
            </button>
          </div>
        </div>

        {activeTab === 'formulas' ? (
          <div>
            <Formulas embedded openSignal={formulaOpenSignal} />
          </div>
        ) : (
          <>

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

        {/* Enhanced Search and Filter Section */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <label className="flex items-center text-sm font-semibold text-neutral-dark">
                Search Products
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-medium" />
                <input
                  type="text"
                  placeholder="Search by product name"
                  className="w-full pl-12 pr-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium shadow-sm hover:shadow-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="lg:w-64">
              <label className="flex items-center text-sm font-semibold text-neutral-dark">
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

        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsAddOpen(false)}></div>
            <div className="relative z-10 w-full max-w-5xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Add New Product</h2>
                  <p className="text-sm text-neutral-medium mt-1">Create a new product for your inventory</p>
                </div>
                <button onClick={() => setIsAddOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (isSubmitting) return
                    setIsSubmitting(true)
                    try {
                      const id = (window.crypto && 'randomUUID' in window.crypto)
                        ? (window.crypto as any).randomUUID()
                        : `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

                      // Upload images to Supabase Storage and collect public URLs
                      let imageUrls: string[] = []
                      let docUrls: string[] = []
                      if (supabase && productForm.images?.length) {
                        const bucket = 'ERP_storage'
                        const folder = `products/${id}`
                        const uploads = await Promise.all(
                          productForm.images.map(async (file) => {
                            const safeName = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '_')
                            const filePath = `${folder}/${safeName}`
                            const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
                              upsert: true,
                              contentType: file.type || 'application/octet-stream',
                            })
                            if (uploadError) {
                              console.error('Supabase upload error:', uploadError.message, { bucket, filePath })
                              return null
                            }
                            // Try public URL first (requires bucket to be public)
                            const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath)
                            let url = pub?.publicUrl || ''
                            // Fallback to a long-lived signed URL when bucket is private or public url fails
                            if (!url) {
                              const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60 * 24 * 365) // 1 year
                              url = signed?.signedUrl || ''
                            }
                            return url || null
                          })
                        )
                        imageUrls = uploads.filter((u): u is string => !!u)
                        if (productForm.images.length && imageUrls.length === 0) {
                          throw new Error('All image uploads failed. Please check Storage bucket name, policies, and CORS.')
                        }
                      }

                      // Upload product documents (optional)
                      if (supabase && productForm.docFiles.length) {
                        const bucket = 'ERP_storage'
                        const folder = `product_docs/${id}`
                        const uploads = await Promise.all(
                          productForm.docFiles.map(async (file) => {
                            const safeName = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '-')
                            const path = `${folder}/${safeName}`
                            const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
                              upsert: true,
                              contentType: file.type || 'application/octet-stream',
                            })
                            if (upErr) {
                              console.error('Doc upload error:', upErr.message)
                            } else {
                              const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
                              let url = pub?.publicUrl || null
                              if (!url) {
                                const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365)
                                url = signed?.signedUrl || null
                              }
                              return url || null
                            }
                          })
                        )
                        docUrls = uploads.filter((u): u is string => !!u)
                      }

                    const payload = {
                      id,
                      name: productForm.name,
                      customer: productForm.customer,
                      customerId: productForm.customerId,
                      productType: productForm.productType,
                      packagingType: productForm.packagingType,
                      uom: productForm.uom,
                      shelfLife: productForm.shelfLife,
                      formulaId: selectedFormula?.id || null,
                      formulaName: selectedFormula?.formula_name || null,
                      cost: productForm.cost ? Number(productForm.cost) : null,
                      caseDimension: productForm.caseDimension || '',
                      caseQty: productForm.caseQty ? Number(productForm.caseQty) : null,
                      productFileUrl: docUrls.length ? docUrls[0] : null,
                      productFileUrls: docUrls,
                      images: imageUrls,
                      createdAt: new Date().toISOString(),
                    }

                    await fetch('https://primary-production-6722.up.railway.app/webhook/products', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    })

                    // Also persist to Supabase and optimistically update UI
                    try {
                      await supabase.from('products').insert({
                        id,
                        product_name: productForm.name,
                        customer_name: productForm.customer || null,
                        product_type: productForm.productType || null,
                        packaging_type: productForm.packagingType || null,
                        unit_of_measure: productForm.uom || null,
                        shelf_life_days: Number(productForm.shelfLife) || 0,
                        formula_id: selectedFormula?.id || null,
                        formula_name: selectedFormula?.formula_name || null,
                        cost: productForm.cost ? Number(productForm.cost) : null,
                        case_dimension: productForm.caseDimension || null,
                        case_qty: productForm.caseQty ? Number(productForm.caseQty) : null,
                        // Store all document URLs JSON-stringified into text column
                        product_file_url: docUrls.length ? JSON.stringify(docUrls) : null,
                        product_image_url: imageUrls,
                      })
                    } catch (dbErr) {
                      console.error('Supabase insert failed (products)', dbErr)
                    }

                    // Optimistic UI update
                    setProducts((prev) => [
                      {
                        id,
                        product_name: productForm.name,
                        customer_name: productForm.customer || '',
                        product_type: productForm.productType || '',
                        packaging_type: productForm.packagingType || '',
                        unit_of_measure: productForm.uom || '',
                        shelf_life_days: Number(productForm.shelfLife) || 0,
                        created_at: new Date().toISOString(),
                        product_image_url: imageUrls,
                        description: '',
                        product_file_urls: docUrls,
                        formula_id: selectedFormula?.id || null,
                        formula_name: selectedFormula?.formula_name || null,
                        cost: productForm.cost ? Number(productForm.cost) : null,
                        case_dimension: productForm.caseDimension || null,
                        case_qty: productForm.caseQty ? Number(productForm.caseQty) : null,
                      },
                      ...prev,
                    ])

                    setIsAddOpen(false)
                    setToast({ show: true, message: 'Product created successfully' })
                  } catch (err) {
                    console.error('Failed to send product to webhook', err)
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
                className="p-8 space-y-6"
              >
              {/* Row 1: Product Name and Customer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center text-sm font-semibold text-neutral-dark">
                    <Package className="h-5 w-5 mr-3 text-primary-medium" />
                    Product Name
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Creamy Peanut Butter"
                    className="w-full px-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium shadow-sm hover:shadow-md"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center text-sm font-semibold text-neutral-dark">
                    <User className="h-5 w-5 mr-3 text-primary-medium" />
                    Customer
                  </label>
                  <div className="relative" ref={customerRef}>
                    <button
                      type="button"
                      onClick={() => { if (customersLoading || customers.length === 0) return; setIsCustomerOpen((v) => !v) }}
                      disabled={customersLoading || customers.length === 0}
                      className={`w-full flex items-center justify-between px-4 py-4 border border-neutral-soft rounded-xl text-left bg-white transition-all shadow-sm ${customersLoading || customers.length===0 ? 'opacity-60 cursor-not-allowed' : 'hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:shadow-md'}`}
                    >
                      <span className={productForm.customer ? 'text-neutral-dark' : 'text-neutral-medium'}>
                        {customersLoading ? 'Loading customers...' : (customers.length === 0 ? 'No customers available' : (productForm.customer || 'Select Customer'))}
                      </span>
                      <span className="ml-2 text-neutral-medium">▼</span>
                    </button>
                    {customersError && (
                      <p className="mt-2 text-xs text-accent-danger">{customersError}</p>
                    )}
        
        
        
                    {isCustomerOpen && (
                      <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                        <div className="px-3 py-2 text-xs text-neutral-medium">Select Customer</div>
                        {customers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${productForm.customer===c.name ? 'bg-neutral-light' : ''}`}
                            onClick={() => { setProductForm({ ...productForm, customer: c.name, customerId: c.id }); setIsCustomerOpen(false) }}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2c: Cost (Optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">
                    Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 100.00"
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    value={productForm.cost}
                    onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 2d: Case Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">Case Dimension</label>
                  <input
                    type="text"
                    placeholder="e.g., 40 x 30 x 25 cm"
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    value={productForm.caseDimension}
                    onChange={(e) => setProductForm({ ...productForm, caseDimension: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">Case Qty</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g., 12"
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    value={productForm.caseQty}
                    onChange={(e) => setProductForm({ ...productForm, caseQty: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 2: Product Type and Packaging Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">
                    <Box className="h-4 w-4 mr-2 text-primary-medium" />
                    Product Type
                  </label>
                  <div className="relative" ref={productTypeRef}>
                    <button
                      type="button"
                      onClick={() => { if (!productForm.customer) return; setIsProductTypeOpen((v) => !v) }}
                      disabled={!productForm.customer}
                      className={`w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all ${!productForm.customer ? 'opacity-60 cursor-not-allowed' : 'hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light'}`}
                    >
                      <span className={productForm.productType ? 'text-neutral-dark' : 'text-neutral-medium'}>
                        {productForm.productType || 'Select Type'}
                      </span>
                      <span className="ml-2 text-neutral-medium">▼</span>
                    </button>
                    {isProductTypeOpen && (
                      <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                        <div className="px-3 py-2 text-xs text-neutral-medium">Select Type</div>
                        {productTypes.map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${productForm.productType===t ? 'bg-neutral-light' : ''}`}
                            onClick={() => { setProductForm({ ...productForm, productType: t }); setIsProductTypeOpen(false) }}
                          >
                            {t}
                          </button>
                        ))}
                        <div className="my-1 border-t border-neutral-soft"></div>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-primary-medium hover:text-primary-dark hover:bg-neutral-light"
                          onClick={() => { setNewValue(''); setShowAddProductType(true); setIsProductTypeOpen(false) }}
                        >
                          + Add New Type
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">
                    <Package className="h-4 w-4 mr-2 text-primary-medium" />
                    Packaging Type
                  </label>
                  <div className="relative" ref={packagingTypeRef}>
                    <button
                      type="button"
                      onClick={() => { if (!productForm.customer) return; setIsPackagingTypeOpen((v) => !v) }}
                      disabled={!productForm.customer}
                      className={`w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all ${!productForm.customer ? 'opacity-60 cursor-not-allowed' : 'hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light'}`}
                    >
                      <span className={productForm.packagingType ? 'text-neutral-dark' : 'text-neutral-medium'}>
                        {productForm.packagingType || 'Select Packaging'}
                      </span>
                      <span className="ml-2 text-neutral-medium">▼</span>
                    </button>
                    {isPackagingTypeOpen && (
                      <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                        <div className="px-3 py-2 text-xs text-neutral-medium">Select Packaging</div>
                        {packagingTypes.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${productForm.packagingType===p ? 'bg-neutral-light' : ''}`}
                            onClick={() => { setProductForm({ ...productForm, packagingType: p }); setIsPackagingTypeOpen(false) }}
                          >
                            {p}
                          </button>
                        ))}
                        <div className="my-1 border-t border-neutral-soft"></div>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-primary-medium hover:text-primary-dark hover:bg-neutral-light"
                          onClick={() => { setNewValue(''); setShowAddPackagingType(true); setIsPackagingTypeOpen(false) }}
                        >
                          + Add New Packaging Type
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2b: Formula (optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 relative" ref={formulaRef}>
                  <label className="flex items-center text-sm font-medium text-neutral-dark">
                    <FlaskConical className="h-4 w-4 mr-2 text-primary-medium" />
                    Formula (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => { if (!formulasLoading) setIsFormulaOpen((v)=>!v) }}
                    className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                  >
                    <span className={selectedFormula ? 'text-neutral-dark' : 'text-neutral-medium'}>
                      {selectedFormula ? `${selectedFormula.formula_name}` : (formulasLoading ? 'Loading formulas...' : 'Select Formula')}
                    </span>
                    <span className="ml-2 text-neutral-medium">▼</span>
                  </button>
                  {isFormulaOpen && (
                    <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                      <div className="px-3 py-2 text-xs text-neutral-medium">Select Formula</div>
                      {formulas.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${selectedFormula?.id===f.id ? 'bg-neutral-light' : ''}`}
                          onClick={() => { setSelectedFormula(f); setIsFormulaOpen(false) }}
                        >
                          <div className="text-sm text-neutral-dark font-medium">{f.formula_name}</div>
                        </button>
                      ))}
                      {(!formulasLoading && formulas.length === 0) && (
                        <div className="px-4 py-3 text-sm text-neutral-medium">No formulas found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Unit of Measure and Shelf Life */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">
                    <Scale className="h-4 w-4 mr-2 text-primary-medium" />
                    Unit of Measure
                  </label>
                  <div className="relative" ref={uomRef}>
                    <button
                      type="button"
                      onClick={() => setIsUomOpen((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all"
                    >
                      <span className={productForm.uom ? 'text-neutral-dark' : 'text-neutral-medium'}>
                        {productForm.uom || 'Select UoM'}
                      </span>
                      <span className="ml-2 text-neutral-medium">▼</span>
                    </button>
                    {isUomOpen && (
                      <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                        <div className="px-3 py-2 text-xs text-neutral-medium">Select Unit of Measure</div>
                        {uoms.map((u) => (
                          <button
                            key={u}
                            type="button"
                            className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${productForm.uom===u ? 'bg-neutral-light' : ''}`}
                            onClick={() => { setProductForm({ ...productForm, uom: u }); setIsUomOpen(false) }}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">
                    <Calendar className="h-4 w-4 mr-2 text-primary-medium" />
                    Shelf Life (Days)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 365"
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    value={productForm.shelfLife}
                    onChange={(e) => setProductForm({ ...productForm, shelfLife: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 4: Product File (full width) */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium text-neutral-dark">
                  <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                  Product File
                </label>
                <input
                  ref={docFileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length) {
                      setProductForm({ ...productForm, docFiles: [...productForm.docFiles, ...files] })
                      e.currentTarget.value = ''
                    }
                  }}
                />

                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-300 cursor-pointer ${docDragOver ? 'border-primary-light bg-primary-light/10' : 'border-neutral-soft bg-gradient-to-br from-neutral-light/40 to-neutral-light/20 hover:from-primary-light/10 hover:to-primary-medium/5'}`}
                  onDragOver={(e) => { e.preventDefault(); setDocDragOver(true) }}
                  onDragLeave={() => setDocDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDocDragOver(false)
                    const files = Array.from(e.dataTransfer.files || [])
                    if (files.length) setProductForm({ ...productForm, docFiles: [...productForm.docFiles, ...files] })
                  }}

                  onClick={() => docFileInputRef.current?.click()}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-neutral-medium">PDF, DOCX, XLSX, PPTX, TXT</p>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-medium shadow-sm"
                    >
                      Browse File
                    </button>
                  </div>
                  {productForm.docFiles.length > 0 ? (
                    <div className="space-y-2">
                      {productForm.docFiles.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white border border-neutral-soft rounded-lg px-4 py-3">
                          <span className="text-sm text-neutral-dark truncate">{f.name}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                try {
                                  const name = (f?.name || '').toLowerCase()
                                  const ext = name.split('.').pop() || ''
                                  const previewable = ['pdf','png','jpg','jpeg']
                                  if (previewable.includes(ext)) {
                                    const url = URL.createObjectURL(f)
                                    window.open(url, '_blank')
                                    setTimeout(() => URL.revokeObjectURL(url), 5000)
                                  } else {
                                    alert('Preview is available for PDF or image files before saving. Save first to preview Office documents.')
                                  }
                                } catch {}
                              }}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const copy = [...productForm.docFiles]
                                copy.splice(idx, 1)
                                setProductForm({ ...productForm, docFiles: copy })
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">

                      <div className="mx-auto w-12 h-12 bg-primary-light/20 rounded-full flex items-center justify-center mb-3">
                        <Upload className="h-6 w-6 text-primary-medium" />
                      </div>
                      <p className="text-sm text-neutral-dark font-semibold mb-1">Drag & drop file here, or click to upload</p>
                      <p className="text-xs text-neutral-medium">Max size depends on storage policy</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center text-sm font-semibold text-neutral-dark">
                  <Upload className="h-5 w-5 mr-3 text-primary-medium" />
                  Product Image
                </label>
                <div className="relative border-2 border-dashed border-neutral-soft rounded-xl p-6 hover:border-primary-light transition-all duration-300 bg-gradient-to-br from-neutral-light/40 to-neutral-light/20 hover:from-primary-light/10 hover:to-primary-medium/5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length) {
                        setProductForm({ ...productForm, images: [...productForm.images, ...files] })
                        e.currentTarget.value = ''
                      }
                    }}
                  />

                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-neutral-medium">JPG, PNG, PDF up to 10MB</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-medium shadow-sm"
                    >
                      + Add Images
                    </button>
                  </div>

                  {imagePreviews.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
                        <Upload className="h-8 w-8 text-primary-medium" />
                      </div>
                      <p className="text-base text-neutral-dark font-semibold mb-1">Click “+ Add Images” to upload</p>
                      <p className="text-sm text-neutral-medium">You can add multiple images. They will appear below.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {imagePreviews.map((src, idx) => (
                        <div key={idx} className="relative bg-white rounded-lg border border-neutral-soft overflow-hidden">
                          <img src={src} alt={`Preview ${idx+1}`} className="w-full h-32 object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const newImages = [...productForm.images]
                              newImages.splice(idx, 1)
                              setProductForm({ ...productForm, images: newImages })
                            }}
                            className="absolute top-2 right-2 px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-8 mt-8 border-t border-neutral-soft/50 bg-gradient-to-r from-neutral-light/20 to-transparent -mx-8 px-8 pb-8">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-8 py-4 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center ${isSubmitting ? 'opacity-60 cursor-not-allowed hover:translate-y-0 hover:shadow-lg' : ''}`}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {isSubmitting ? 'Creating...' : 'Create Product'}
                </button>
              </div>
              </form>
            </div>

            {/* Small sub-modals for adding new select options (customer modal removed by request) */}

            {showAddProductType && (
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddProductType(false)}></div>
                <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-soft/20">
                  <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                    <div>
                      <h3 className="text-xl font-semibold text-neutral-dark">Add New Product Type</h3>
                      <p className="text-sm text-neutral-medium mt-1">Create a new product type category</p>
                    </div>
                    <button onClick={() => setShowAddProductType(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="space-y-3">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Box className="h-5 w-5 mr-3 text-primary-medium" />
                        Product Type Name
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Enter product type name"
                        className="w-full px-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-4 pt-6 border-t border-neutral-soft/50">
                      <button 
                        type="button" 
                        className="px-6 py-3 border border-neutral-soft rounded-xl text-neutral-dark hover:bg-neutral-light font-medium transition-all duration-200 hover:shadow-sm" 
                        onClick={() => setShowAddProductType(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        onClick={() => {
                          if (!newValue.trim()) return
                          setProductTypes((prev) => Array.from(new Set([...prev, newValue.trim()])))
                          setProductForm((pf) => ({ ...pf, productType: newValue.trim() }))
                          setShowAddProductType(false)
                        }}
                      >
                        Save Type
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showAddPackagingType && (
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddPackagingType(false)}></div>
                <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-soft/20">
                  <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                    <div>
                      <h3 className="text-xl font-semibold text-neutral-dark">Add New Packaging Type</h3>
                      <p className="text-sm text-neutral-medium mt-1">Create a new packaging option</p>
                    </div>
                    <button onClick={() => setShowAddPackagingType(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="space-y-3">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Package className="h-5 w-5 mr-3 text-primary-medium" />
                        Packaging Type Name
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Enter packaging type name"
                        className="w-full px-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-4 pt-6 border-t border-neutral-soft/50">
                      <button 
                        type="button" 
                        className="px-6 py-3 border border-neutral-soft rounded-xl text-neutral-dark hover:bg-neutral-light font-medium transition-all duration-200 hover:shadow-sm" 
                        onClick={() => setShowAddPackagingType(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        onClick={() => {
                          if (!newValue.trim()) return
                          setPackagingTypes((prev) => Array.from(new Set([...prev, newValue.trim()])))
                          setProductForm((pf) => ({ ...pf, packagingType: newValue.trim() }))
                          setShowAddPackagingType(false)
                        }}
                      >
                        Save Packaging
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

        {/* Enhanced Products Content */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-soft/20 p-16 flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-primary-light/20 rounded-full flex items-center justify-center mb-6">
              <Package className="h-12 w-12 text-primary-medium" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-dark mb-2">No products found</h3>
            <p className="text-neutral-medium mb-6">Add your first product to get started with your inventory.</p>
            <button 
              onClick={() => setIsAddOpen(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Your First Product
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="px-10 py-8 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-dark mb-2">Product Catalog</h3>
                  <p className="text-neutral-medium font-medium">{filteredProducts.length} products in your inventory</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="px-4 py-2 bg-primary-light/10 rounded-xl border border-primary-light/20">
                    <span className="text-sm font-semibold text-primary-dark">{filteredProducts.length} Total</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-primary-medium" />
                        <span>Product</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-primary-medium" />
                        <span>Customer</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Box className="h-4 w-4 text-primary-medium" />
                        <span>Type</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Packaging</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Scale className="h-4 w-4 text-primary-medium" />
                        <span>UoM</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-primary-medium" />
                        <span>Shelf Life</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-center text-sm font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-soft/20">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm">
                      <td className="px-8 py-8">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow duration-300 bg-neutral-light/50 flex items-center justify-center">
                              {product.product_image_url && product.product_image_url.length > 0 ? (
                                <img src={product.product_image_url[0]} alt={product.product_name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="h-7 w-7 text-primary-dark" />
                              )}
                            </div>
                            {/* removed badge per request */}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-bold text-neutral-dark mb-1 truncate">{product.product_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-8">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-accent-success/20 to-accent-success/10 rounded-xl flex items-center justify-center">
                            <User className="h-5 w-5 text-accent-success" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-neutral-dark">{product.customer_name}</div>
                            <div className="text-xs text-neutral-medium">Customer</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-8">
                        <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary-light/20 to-primary-medium/20 text-primary-dark border border-primary-light/30 shadow-sm">
                          {product.product_type}
                        </span>
                      </td>
                      <td className="px-8 py-8">
                        <div className="text-sm font-medium text-neutral-dark bg-neutral-light/50 px-3 py-2 rounded-lg border border-neutral-soft/30">
                          {product.packaging_type}
                        </div>
                      </td>
                      <td className="px-8 py-8">
                        <div className="flex items-center space-x-2">
                          <Scale className="h-4 w-4 text-primary-medium" />
                          <span className="text-sm font-medium text-neutral-dark">{product.unit_of_measure}</span>
                        </div>
                      </td>
                      <td className="px-8 py-8">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-accent-warning/20 rounded-lg flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-accent-warning" />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-neutral-dark">{product.shelf_life_days}</span>
                            <span className="text-xs text-neutral-medium ml-1">days</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-8">
                        <div className="flex items-center justify-center space-x-2">
                          <button type="button" onClick={() => { setImageModalDescription(product.description || ''); setImageModalUrls(product.product_image_url || []); setImageModalFiles((product.product_file_urls && product.product_file_urls.length ? product.product_file_urls : (product.product_file_url ? [product.product_file_url] : []))); setImageModalOpen(true); }} className="group/btn p-3 text-primary-medium hover:text-white hover:bg-primary-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium">
                            <Eye className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              console.log('Edit clicked for', product.id)
                              setIsAddOpen(false)
                              setImageModalOpen(false)
                              setLightboxUrl(null)
                              const matched = customers?.find((c) => c.name === product.customer_name)
                              setEditForm({
                                id: product.id,
                                product_name: product.product_name,
                                customer_name: product.customer_name,
                                customerId: matched?.id || '',
                                product_type: product.product_type,
                                packaging_type: product.packaging_type,
                                unit_of_measure: product.unit_of_measure,
                                shelf_life_days: product.shelf_life_days,
                                description: product.description,
                                product_image_url: product.product_image_url || [],
                                product_file_url: product.product_file_url || null,
                                product_file_urls: product.product_file_urls || [],
                                formula_id: product.formula_id || null,
                                formula_name: product.formula_name || null,
                                cost: typeof product.cost === 'number' ? product.cost : (product.cost ? Number(product.cost) : ''),
                                case_dimension: product.case_dimension ?? '',
                                case_qty: typeof product.case_qty === 'number' ? product.case_qty : (product.case_qty ? Number(product.case_qty) : ''),
                              })
                              setEditSelectedFormula(product.formula_id ? { id: product.formula_id, formula_name: product.formula_name || '' } as any : null)
                              setIsEditOpen(true)
                            }}
                            className="group/btn p-3 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft hover:border-neutral-medium cursor-pointer"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDelete({ open: true, product, loading: false, error: null })
                              }}
                            className="group/btn p-3 text-accent-danger hover:text-white hover:bg-accent-danger rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-accent-danger/30 hover:border-accent-danger"
                          >
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
        {/* Enhanced Image Preview Modal */}
        {imageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setImageModalOpen(false)}></div>
            <div className="relative z-10 w-full max-w-6xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-neutral-soft/30 overflow-hidden flex flex-col">
          {/* ERP Premium Title Header */}
          <div className="relative flex items-center justify-between px-10 py-7 
              bg-gradient-to-r from-neutral-50 via-primary-light/20 to-primary-light/10
              backdrop-blur-md border-b border-neutral-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]
              rounded-t-2xl">

            {/* Left Section */}
            <div className="flex flex-col">
              <h2 className="text-2xl font-semibold text-neutral-800 tracking-tight leading-tight">
                Product Collection
              </h2>

              <p className="text-sm text-neutral-500 leading-snug mt-1">
                Images • Documents • File Attachments
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setImageModalOpen(false)}
              className="p-2.5 rounded-xl hover:bg-neutral-200/70 text-neutral-500 
                hover:text-neutral-900 transition-all duration-300 shadow-sm
                hover:shadow-md hover:scale-105 active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
           
              {/* Modal Body */}
              <div className="flex-1 overflow-auto">
                <div className="p-8">
                  {/* Enhanced Description Card */}
                  {imageModalDescription && (
                    <div className="mb-8 p-6 bg-gradient-to-r from-neutral-light/60 to-neutral-soft/40 border border-neutral-soft/60 rounded-2xl shadow-sm">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-primary-light/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileText className="h-4 w-4 text-primary-medium" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-neutral-dark mb-2 uppercase tracking-wider">Product Description</h4>
                          <p className="text-neutral-dark leading-relaxed">{imageModalDescription}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Product Documents */}
                  {imageModalFiles.length > 0 && (
                    <div className="mb-8 bg-white rounded-3xl border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
                      {/* Header Section */}
                      <div className="relative bg-gradient-to-r from-slate-50 via-neutral-50 to-slate-50/80 border-b border-neutral-200/60 px-6 py-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary-500/10 to-primary-600/20 rounded-2xl flex items-center justify-center">
                              <FileText className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-slate-900 tracking-tight">Product Documents</h3>
                              <p className="text-sm text-slate-500 mt-0.5">{imageModalFiles.length} file{imageModalFiles.length !== 1 ? 's' : ''} attached</p>
                            </div>
                          </div>
                          
                          {/* View Toggle */}
                          <div className="inline-flex items-center bg-white rounded-2xl p-1.5 border border-neutral-200 shadow-sm">
                            <button 
                              type="button" 
                              onClick={() => setDocsLayout('list')} 
                              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 min-w-[80px] justify-center ${
                                docsLayout === 'list' 
                                  ? 'bg-blue-500 text-white shadow-lg border-2 border-blue-600' 
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-2 border-transparent'
                              }`}
                              title="List View"
                            >
                              <List className="w-4 h-4 flex-shrink-0" />
                              <span className="whitespace-nowrap font-semibold">List</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setDocsLayout('grid')} 
                              className={`ml-1 flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 min-w-[80px] justify-center ${
                                docsLayout === 'grid' 
                                  ? 'bg-blue-500 text-white shadow-lg border-2 border-blue-600' 
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-2 border-transparent'
                              }`}
                              title="Grid View"
                            >
                              <Grid3X3 className="w-4 h-4 flex-shrink-0" />
                              <span className="whitespace-nowrap font-semibold">Grid</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="p-6">
                        {docsLayout === 'list' ? (
                          <div className="space-y-3">
                            {imageModalFiles.map((url, idx) => (
                              <div key={idx} className="group relative bg-slate-50/50 hover:bg-white border border-slate-200/60 hover:border-primary-200 rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                                    {(() => { 
                                      const meta = getFileMeta(prettyFileName(url)); 
                                      return (
                                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xs font-bold ${meta.cls.replace('bg-', 'bg-').replace('text-', 'text-')} border border-current/20`}>
                                          {meta.label}
                                        </div>
                                      )
                                    })()}
                                    <div className="min-w-0 flex-1">
                                      <button
                                        type="button"
                                        className="block text-left w-full"
                                        onClick={() => {
                                          const lower = url.toLowerCase()
                                          if (lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
                                            window.open(url, '_blank')
                                          } else {
                                            const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`
                                            window.open(viewer, '_blank')
                                          }
                                        }}
                                      >
                                        <h4 className="text-sm font-semibold text-slate-900 group-hover:text-primary-600 truncate transition-colors">
                                          {prettyFileName(url)}
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-1">Click to open in new tab</p>
                                      </button>
                                    </div>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center">
                                      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {imageModalFiles.map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="group relative bg-slate-50/50 hover:bg-white border border-slate-200/60 hover:border-primary-200 rounded-3xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1"
                                onClick={() => {
                                  const lower = url.toLowerCase()
                                  if (lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
                                    window.open(url, '_blank')
                                  } else {
                                    const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`
                                    window.open(viewer, '_blank')
                                  }
                                }}
                              >
                                <div className="flex flex-col items-center text-center">
                                  {(() => {
                                    const fname = prettyFileName(url).toLowerCase()
                                    const ext = fname.includes('.') ? (fname.split('.').pop() || '') : ''
                                    let color = 'text-slate-600'; let bg = 'bg-slate-100'
                                    if (ext === 'pdf') { color = 'text-red-600'; bg = 'bg-red-50' }
                                    else if (ext === 'doc' || ext === 'docx') { color = 'text-blue-600'; bg = 'bg-blue-50' }
                                    else if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') { color = 'text-emerald-600'; bg = 'bg-emerald-50' }
                                    else if (ext === 'ppt' || ext === 'pptx') { color = 'text-orange-600'; bg = 'bg-orange-50' }
                                    return (
                                      <div className={`w-16 h-16 ${bg} rounded-2xl border border-current/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                                        <FileText className={`w-8 h-8 ${color}`} />
                                      </div>
                                    )
                                  })()}
                                  <h4 className="text-sm font-semibold text-slate-900 group-hover:text-primary-600 transition-colors line-clamp-2" title={prettyFileName(url)}>
                                    {prettyFileName(url)}
                                  </h4>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Enhanced Image Grid */}
                  {imageModalUrls.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-neutral-light/60 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="h-10 w-10 text-neutral-medium" />
                      </div>
                      <h4 className="text-lg font-semibold text-neutral-dark mb-2">No Images Available</h4>
                      <p className="text-neutral-medium">This product doesn't have any images yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {imageModalUrls.map((src, idx) => (
                        <div key={idx} className="group relative bg-white rounded-2xl border border-neutral-soft/40 overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                          <div className="aspect-square overflow-hidden">
                            <img 
                              src={src} 
                              alt={`Product image ${idx + 1}`} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            />
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                              <span className="text-xs font-bold text-neutral-dark">{idx + 1}</span>
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button onClick={() => setLightboxUrl(src)} className="w-full px-3 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white text-sm font-medium hover:bg-white/30 transition-colors">
                              View Full Size
                            </button>
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
        {/* Full-size lightbox viewer */}
        {lightboxUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setLightboxUrl(null)}></div>
            <div className="relative z-10 max-w-6xl max-h-[90vh]">
              <button onClick={() => setLightboxUrl(null)} className="absolute -top-4 -right-4 p-2 rounded-full bg-white/90 text-neutral-dark shadow-lg hover:bg-white">
                <X className="h-5 w-5" />
              </button>
              <img src={lightboxUrl} alt="Full Size" className="block w-auto max-w-full h-auto max-h-[90vh] rounded-xl shadow-2xl" />
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDelete.open && confirmDelete.product && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete({ open: false, product: null, loading: false, error: null })}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/40 overflow-hidden">
              <div className="px-6 py-5 bg-gradient-to-r from-neutral-light to-neutral-light/70 border-b border-neutral-soft/50">
                <h3 className="text-lg font-semibold text-neutral-dark">Delete Product</h3>
                <p className="text-sm text-neutral-medium mt-1">This action cannot be undone.</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-neutral-dark">Are you sure you want to delete "<span className="font-semibold">{confirmDelete.product.product_name}</span>"?</p>
                {confirmDelete.error && (
                  <div className="text-sm text-accent-danger">{confirmDelete.error}</div>
                )}
              </div>
              <div className="px-6 py-4 bg-neutral-light/30 border-t border-neutral-soft/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete({ open: false, product: null, loading: false, error: null })}
                  className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light transition"
                  disabled={confirmDelete.loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirmDelete.product) return
                    setConfirmDelete((s) => ({ ...s, loading: true, error: null }))
                    const id = confirmDelete.product.id
                    const { data: delRows, error } = await supabase
                      .from('products')
                      .delete()
                      .eq('id', id)
                      .select('id')
                    if (error || !delRows || delRows.length === 0) {
                      setConfirmDelete((s) => ({ ...s, loading: false, error: 'Delete failed on the database. Please check permissions and try again.' }))
                    } else {
                      setProducts((p) => p.filter((x) => x.id !== id))
                      setConfirmDelete({ open: false, product: null, loading: false, error: null })
                      setToast({ show: true, message: 'Product deleted successfully' })
                    }
                  }}
                  className="px-5 py-2 rounded-lg bg-accent-danger text-white hover:opacity-95 shadow transition disabled:opacity-60"
                  disabled={confirmDelete.loading}
                >
                  {confirmDelete.loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Edit Product Modal (global, after lightbox) */}
        {isEditOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsEditOpen(false)}></div>
            <div className="relative z-10 w-full max-w-5xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Update Product</h2>
                  <p className="text-sm text-neutral-medium mt-1">Modify product details</p>
                </div>
                <button onClick={() => setIsEditOpen(false)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const ef = editForm ?? {
                      id: '',
                      product_name: '',
                      customer_name: '',
                      product_type: '',
                      packaging_type: '',
                      unit_of_measure: '',
                      shelf_life_days: 0,
                      description: '',
                      product_image_url: [],
                      product_file_url: null,
                    }
                    // If a replacement doc was selected, upload and get URL
                    let uploadedDocUrls: string[] = []
                    try {
                      if (editDocFiles && editDocFiles.length) {
                        const bucket = 'ERP_storage'
                        const uploads = await Promise.all(
                          editDocFiles.map(async (file) => {
                            const safeName = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '-')
                            const path = `product_docs/${ef.id}/${safeName}`
                            const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
                              upsert: true,
                              contentType: file.type || 'application/octet-stream',
                            })
                            if (!upErr) {
                              const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
                              let url = pub?.publicUrl || ''
                              if (!url) {
                                const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365)
                                url = signed?.signedUrl || ''
                              }
                              return url || null
                            }
                            return null
                          })
                        )
                        uploadedDocUrls = uploads.filter((u): u is string => !!u)
                      }
                    } catch {}

                    const update: any = {
                      product_name: ef.product_name,
                      customer_name: ef.customer_name,
                      product_type: ef.product_type,
                      packaging_type: ef.packaging_type,
                      unit_of_measure: ef.unit_of_measure,
                      shelf_life_days: Number(ef.shelf_life_days) || 0,
                      product_image_url: ef.product_image_url,
                      product_file_url: (() => {
                        const base = Array.isArray(ef.product_file_urls) ? ef.product_file_urls : []
                        const next = [...base, ...uploadedDocUrls]
                        return next.length ? JSON.stringify(next) : null
                      })(),
                    }

                    update.cost = (ef.cost === '' || ef.cost === null || typeof ef.cost === 'undefined') ? null : Number(ef.cost as any)
                    update.case_dimension = (ef.case_dimension ?? null)
                    update.case_qty = (ef.case_qty === '' || ef.case_qty === null || typeof ef.case_qty === 'undefined') ? null : Number(ef.case_qty as any)
                    if (editSelectedFormula) {
                      update.formula_id = editSelectedFormula.id
                      update.formula_name = editSelectedFormula.formula_name || null
                    }
                    const { error } = await supabase.from('products').update(update).eq('id', ef.id)
                    if (!error) {
                      const existing = products.find((p) => p.id === ef.id)
                      const resolvedCustomerId = (ef.customerId && ef.customerId.length > 0)
                        ? ef.customerId
                        : (customers?.find((c) => c.name === ef.customer_name)?.id || '')
                      const mergedDocUrls = (() => {
                        const base = Array.isArray(ef.product_file_urls) ? ef.product_file_urls : []
                        return [...base, ...uploadedDocUrls]
                      })()
                      const updated = {
                        id: ef.id,
                        name: ef.product_name,
                        customer: ef.customer_name,
                        customerId: resolvedCustomerId,
                        productType: ef.product_type,
                        packagingType: ef.packaging_type,
                        uom: ef.unit_of_measure,
                        shelfLife: String(ef.shelf_life_days ?? ''),
                        cost: (ef.cost === '' || ef.cost === null || typeof ef.cost === 'undefined') ? null : Number(ef.cost as any),
                        caseDimension: ef.case_dimension ?? '',
                        caseQty: (ef.case_qty === '' || ef.case_qty === null || typeof ef.case_qty === 'undefined') ? null : Number(ef.case_qty as any),
                        images: ef.product_image_url ?? [],
                        createdAt: existing?.created_at ?? new Date().toISOString(),
                        productFileUrls: mergedDocUrls,
                        productFileUrl: mergedDocUrls.length ? mergedDocUrls[0] : null,
                      }
                      setProducts((prev) => prev.map((p) => (p.id === ef.id ? { ...p, ...update, product_file_urls: mergedDocUrls } : p)))

                      try {
                        await fetch('https://primary-production-6722.up.railway.app/webhook/products', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(updated),
                        })
                      } catch (werr) {
                        console.error('Webhook failed', werr)
                      }
                      setEditDocFiles([])
                      setIsEditOpen(false)
                      setToast({ show: true, message: 'Product updated successfully' })
                    } else {
                      console.error('Failed to update product', error)
                    }
                  }}
                  className="p-8 space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Package className="h-5 w-5 mr-3 text-primary-medium" />
                        Product Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md"
                        value={editForm?.product_name ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...(prev ?? { id: '', product_name: '', customer_name: '', product_type: '', packaging_type: '', unit_of_measure: '', shelf_life_days: 0, description: '', product_image_url: [] }), product_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <User className="h-5 w-5 mr-3 text-primary-medium" />
                        Customer
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md"
                        value={editForm?.customer_name ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...(prev ?? { id: '', product_name: '', customer_name: '', product_type: '', packaging_type: '', unit_of_measure: '', shelf_life_days: 0, description: '', product_image_url: [] }), customer_name: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <Box className="h-4 w-4 mr-2 text-primary-medium" />
                        Product Type
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                        value={editForm?.product_type ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...(prev ?? { id: '', product_name: '', customer_name: '', product_type: '', packaging_type: '', unit_of_measure: '', shelf_life_days: 0, description: '', product_image_url: [] }), product_type: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <Package className="h-4 w-4 mr-2 text-primary-medium" />
                        Packaging Type
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                        value={editForm?.packaging_type ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...(prev ?? { id: '', product_name: '', customer_name: '', product_type: '', packaging_type: '', unit_of_measure: '', shelf_life_days: 0, description: '', product_image_url: [] }), packaging_type: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Edit Row: Formula (optional) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 relative" ref={editFormulaRef}>
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <FlaskConical className="h-4 w-4 mr-2 text-primary-medium" />
                        Formula (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={() => { if (!formulasLoading) setIsEditFormulaOpen((v)=>!v) }}
                        className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        <span className={editSelectedFormula ? 'text-neutral-dark' : 'text-neutral-medium'}>
                          {editSelectedFormula ? `${editSelectedFormula.formula_name}` : (formulasLoading ? 'Loading formulas...' : 'Select Formula')}
                        </span>
                        <span className="ml-2 text-neutral-medium">▼</span>
                      </button>
                      {isEditFormulaOpen && (
                        <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                          <div className="px-3 py-2 text-xs text-neutral-medium">Select Formula</div>
                          {formulas.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${editSelectedFormula?.id===f.id ? 'bg-neutral-light' : ''}`}
                              onClick={() => { setEditSelectedFormula(f); setIsEditFormulaOpen(false) }}
                            >
                              <div className="text-sm text-neutral-dark font-medium">{f.formula_name}</div>
                            </button>
                          ))}
                          {(!formulasLoading && formulas.length === 0) && (
                            <div className="px-4 py-3 text-sm text-neutral-medium">No formulas found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edit Row: Cost (Optional) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 100.00"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                        value={typeof editForm?.cost === 'number' ? String(editForm?.cost ?? '') : (editForm?.cost ?? '')}
                        onChange={(e) => setEditForm((prev) => ({ ...(prev ?? { id: '', product_name: '', customer_name: '', product_type: '', packaging_type: '', unit_of_measure: '', shelf_life_days: 0, description: '', product_image_url: [] }), cost: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Edit Row: Case Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Case Dimension</label>
                      <input
                        type="text"
                        placeholder="e.g., 40 x 30 x 25 cm"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                        value={editForm?.case_dimension ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...(prev ?? { id: '', product_name: '', customer_name: '', product_type: '', packaging_type: '', unit_of_measure: '', shelf_life_days: 0, description: '', product_image_url: [] }), case_dimension: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">Case Qty</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="e.g., 12"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                        value={typeof editForm?.case_qty === 'number' ? String(editForm?.case_qty ?? '') : (editForm?.case_qty ?? '')}
                        onChange={(e) => setEditForm((prev) => ({ ...(prev ?? { id: '', product_name: '', customer_name: '', product_type: '', packaging_type: '', unit_of_measure: '', shelf_life_days: 0, description: '', product_image_url: [] }), case_qty: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <Scale className="h-4 w-4 mr-2 text-primary-medium" />
                        Unit of Measure
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                        value={editForm?.unit_of_measure ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...(prev ?? { id: '', product_name: '', customer_name: '', product_type: '', packaging_type: '', unit_of_measure: '', shelf_life_days: 0, description: '', product_image_url: [] }), unit_of_measure: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-neutral-dark">
                        <Calendar className="h-4 w-4 mr-2 text-primary-medium" />
                        Shelf Life (Days)
                      </label>
                      <input
                        type="number"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                        value={editForm?.shelf_life_days ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...(prev ?? { id: '', product_name: '', customer_name: '', product_type: '', packaging_type: '', unit_of_measure: '', shelf_life_days: 0, description: '', product_image_url: [] }), shelf_life_days: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">
                      <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                      Product File
                    </label>
                    <input
                      ref={editDocFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        if (files.length) setEditDocFiles((prev) => [...prev, ...files])
                        if (editDocFileInputRef.current) editDocFileInputRef.current.value = ''
                      }}
                    />

                    <div
                      className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-300 cursor-pointer ${editDocDragOver ? 'border-primary-light bg-primary-light/10' : 'border-neutral-soft bg-gradient-to-br from-neutral-light/40 to-neutral-light/20 hover:from-primary-light/10 hover:to-primary-medium/5'}`}
                      onDragOver={(e) => { e.preventDefault(); setEditDocDragOver(true) }}
                      onDragLeave={() => setEditDocDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setEditDocDragOver(false)
                        const files = Array.from(e.dataTransfer.files || [])
                        if (files.length) setEditDocFiles((prev) => [...prev, ...files])
                      }}
                      onClick={() => editDocFileInputRef.current?.click()}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-neutral-medium">PDF, DOCX, XLSX, PPTX, TXT</p>
                        <button type="button" className="px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-medium shadow-sm">Browse File</button>
                      </div>
                      {(editForm?.product_file_urls && editForm.product_file_urls.length > 0) && (
                        <div className="space-y-2 mb-3">
                          {editForm.product_file_urls.map((url, idx) => (
                            <div key={`exist-${idx}`} className="flex items-center justify-between bg-white border border-neutral-soft rounded-lg px-4 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {(() => { const meta = getFileMeta(prettyFileName(url)); return (<span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>) })()}
                                <span className="text-sm text-neutral-dark truncate">{prettyFileName(url)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm" onClick={(e) => { e.stopPropagation(); const lower = url.toLowerCase(); if (lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) { window.open(url, '_blank') } else { const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`; window.open(viewer, '_blank') } }}>View</button>
                                <button type="button" className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm" onClick={async (e) => { e.stopPropagation(); const prodId = editForm?.id; try { const next = (editForm?.product_file_urls || []).filter((_, i) => i !== idx); setEditForm((prev) => prev ? { ...prev, product_file_urls: next } : prev); if (prodId) { await supabase.from('products').update({ product_file_url: next.length ? JSON.stringify(next) : null }).eq('id', prodId) } try { const marker = '/storage/v1/object/public/ERP_storage/'; const at = url.indexOf(marker); if (at >= 0) { const key = url.substring(at + marker.length); if (key) await supabase.storage.from('ERP_storage').remove([key]) } } catch {} } catch {} }}>Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {(editDocFiles.length > 0) && (
                        <div className="space-y-2 mb-3">
                          {editDocFiles.map((f, idx) => (
                            <div key={`new-${idx}`} className="flex items-center justify-between bg-white border border-neutral-soft rounded-lg px-4 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {(() => { const meta = getFileMeta(f.name); return (<span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>) })()}
                                <span className="text-sm text-neutral-dark truncate">{f.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm" onClick={(e) => { e.stopPropagation(); try { const name = (f?.name || '').toLowerCase(); const ext = name.split('.').pop() || ''; const previewable = ['pdf','png','jpg','jpeg']; if (previewable.includes(ext)) { const url = URL.createObjectURL(f); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 5000) } else { alert('Preview is available after saving for this file type.') } } catch {} }}>View</button>
                                <button type="button" className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm" onClick={(e) => { e.stopPropagation(); setEditDocFiles((prev) => prev.filter((_, i) => i !== idx)) }}>Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {((!editForm?.product_file_urls || editForm.product_file_urls.length === 0) && editDocFiles.length === 0) && (
                        <div className="text-center py-4">
                          <div className="mx-auto w-10 h-10 bg-primary-light/20 rounded-full flex items-center justify-center mb-2">
                            <Upload className="h-5 w-5 text-primary-medium" />
                          </div>
                          <p className="text-sm text-neutral-dark font-semibold">Drag & drop file here, or click to upload</p>
                          <p className="text-xs text-neutral-medium">Max size depends on storage policy</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <Upload className="h-5 w-5 mr-3 text-primary-medium" />
                      Current Images
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {(editForm?.product_image_url ?? []).map((src, idx) => (
                        <div key={idx} className="group relative bg-white rounded-lg border border-neutral-soft overflow-hidden">
                          <img src={src} alt={`Image ${idx + 1}`} className="w-full h-32 object-cover" />
                          <button
                            type="button"
                            onClick={() => setEditForm((prev) => prev ? { ...prev, product_image_url: prev.product_image_url.filter((_, i) => i !== idx) } : prev)}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-accent-danger shadow hover:bg-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleTriggerEditUpload}
                        className="flex items-center justify-center h-32 rounded-lg border-2 border-dashed border-neutral-soft text-neutral-medium hover:border-primary-light hover:text-primary-medium transition"
                      >
                        + Add Images
                      </button>
                      <input ref={hiddenEditFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleEditImageUpload(e.target.files)} />
                    </div>
                    {isEditUploading && <div className="text-sm text-neutral-medium">Uploading...</div>}
                    {editUploadError && <div className="text-sm text-accent-danger">{editUploadError}</div>}
                  </div>

                  <div className="flex items-center justify-end gap-4 pt-8 mt-8 border-t border-neutral-soft/50 bg-gradient-to-r from-neutral-light/20 to-transparent -mx-8 px-8 pb-8">
                    <button
                      type="submit"
                      className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}

export default Products