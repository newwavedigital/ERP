import React, { useState, useEffect, useRef } from 'react'
import { Plus, Search, Filter, X, Package, Calendar, FileText, CheckCircle2, FlaskConical, List, Grid3X3, User, Box, Scale, Upload, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Formulas from './Formulas'
import { useAuth } from '../contexts/AuthContext'

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
  updated_at?: string | null
  is_discontinued?: boolean | null
  substitute_sku?: string | null
  allergen_profile?: any
  customer_id?: string | null
}

// Supabase client is provided as a singleton from ../lib/supabase

const Products: React.FC = () => {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const isSalesRepViewOnly = String(currentUserRole || '').toLowerCase() === 'sales_representative'

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
    is_discontinued?: boolean | null
    substitute_sku?: string | null
    allergen_profile?: any
  } | null>(null)

  const [isEditUploading, setIsEditUploading] = useState(false)
  const [editUploadError, setEditUploadError] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; product: Product | null; loading: boolean; error: string | null }>({ open: false, product: null, loading: false, error: null })
  const [productForm, setProductForm] = useState({
    name: '',
    customer: '',
    customerId: '' as string,
    productSize: '',
    productType: '',
    packagingType: '',
    uom: '',
    shelfLife: '',
    cost: '',
    caseDimension: '',
    caseQty: '',
    docFiles: [] as File[],
    images: [] as File[],
    isDiscontinued: false,
    substituteSku: '',
    allergens: [] as string[],
  })
  type Customer = { id: string; name: string }
  const [customers, setCustomers] = useState<Customer[]>([])
  const baseProductTypes = ['Peanut Butter', 'Nut Butter', 'Spreadable', 'Pet Treat']
  const [productTypes, setProductTypes] = useState<string[]>(baseProductTypes)
  const [packagingTypes, setPackagingTypes] = useState<string[]>(['Jars', 'Squeeze Packs', 'Sachets', 'Bottles', 'Boxes'])
  const uoms = ['Grams (g)', 'Ounces (oz)', 'Pounds (lb)', 'Kilograms (kg)']
  const commonAllergens = ['Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame']

  const [showAddProductType, setShowAddProductType] = useState(false)
  const [showAddPackagingType, setShowAddPackagingType] = useState(false)
  const [showAddUom, setShowAddUom] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

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
  const [imgDragOver, setImgDragOver] = useState(false)
  const [editDocDragOver, setEditDocDragOver] = useState(false)
  const [activeTab, setActiveTab] = useState<'products' | 'formulas'>('products')
  const [formulaOpenSignal, setFormulaOpenSignal] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

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

  // Handler functions for Add New modals
  const handleAddCustomer = async () => {
    if (!newCustomerName.trim() || !supabase) return
    
    setIsCreatingCustomer(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({ company_name: newCustomerName.trim() })
        .select('id, company_name')
        .single()
      
      if (error) {
        setToast({ show: true, message: 'Cannot create customer. Check permissions.' })
        return
      }
      
      // Add to customers list and select it
      const newCustomer = { id: data.id, name: data.company_name }
      setCustomers(prev => [...prev, newCustomer])
      setProductForm(prev => ({ ...prev, customer: newCustomer.name, customerId: newCustomer.id }))
      
      // Close modal and reset
      setShowAddCustomer(false)
      setNewCustomerName('')
      setToast({ show: true, message: 'Customer added successfully' })
    } catch (err) {
      setToast({ show: true, message: 'Cannot create customer. Check permissions.' })
    } finally {
      setIsCreatingCustomer(false)
    }
  }

  const handleAddUom = () => {
    if (!newValue.trim()) return
    
    // Select the new UOM
    setProductForm(prev => ({ ...prev, uom: newValue.trim() }))
    
    // Close modal and reset
    setShowAddUom(false)
    setNewValue('')
    setToast({ show: true, message: 'UOM added successfully' })
  }

  const handleAddProductType = () => {
    const v = newValue.trim()
    if (!v) return

    setProductTypes((prev) => {
      const base = baseProductTypes
      const custom = prev.filter((t) => !base.includes(t))
      const nextCustom = Array.from(new Set([...custom, v]))
      return [...base, ...nextCustom]
    })

    setProductForm((prev) => ({ ...prev, productType: v }))
    setShowAddProductType(false)
    setNewValue('')
    setToast({ show: true, message: 'Product type added successfully' })
  }

  // Silence TS noUnusedLocals for states/refs kept for future features (add/edit flows)
  useEffect(() => {
    void setImageModalOpen; void imageModalUrls; void setImageModalUrls; void setImageModalDescription; void imageModalFiles; void setImageModalFiles
    void setProductForm
    void productTypes; void packagingTypes; void setPackagingTypes
    void showAddProductType; void setShowAddProductType
    void showAddPackagingType; void setShowAddPackagingType
    void isCustomerOpen; void isProductTypeOpen; void isPackagingTypeOpen; void isUomOpen
    void isSubmitting; void setIsSubmitting
    void customersLoading; void customersError
    void imagePreviews
    void docDragOver; void setDocDragOver
    void fileInputRef; void docFileInputRef
    void isFormulaOpen; void selectedFormula; void setSelectedFormula
  }, [])

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
        .select('id, product_name, product_type, packaging_type, customer_name, unit_of_measure, shelf_life_days, created_at, updated_at, product_image_url, product_file_url, formula_id, formula_name, cost, case_dimension, case_qty, is_discontinued, substitute_sku, allergen_profile, customer_id')

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
        updated_at?: string | null
        product_image_url?: string | string[] | null
        product_file_url?: string | null
        formula_id?: string | null
        formula_name?: string | null
        cost?: number | null
        case_dimension?: string | null
        case_qty?: number | null
        is_discontinued?: boolean | null
        substitute_sku?: string | null
        allergen_profile?: string | null
        customer_id?: string | null
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
          updated_at: (r as any).updated_at ?? null,
          product_image_url: urls,
          description: '',
          product_file_url: r.product_file_url || null,
          product_file_urls: docUrls,
          formula_id: r.formula_id ?? null,
          formula_name: r.formula_name ?? null,
          cost: (typeof r.cost === 'number' ? r.cost : (r.cost ? Number(r.cost) : null)),
          case_dimension: (r.case_dimension ?? null) as any,
          case_qty: (typeof r.case_qty === 'number' ? r.case_qty : (r.case_qty ? Number(r.case_qty) : null)),
          is_discontinued: (r as any).is_discontinued ?? null,
          substitute_sku: (r as any).substitute_sku ?? null,
          allergen_profile: (r as any).allergen_profile ?? null,
          customer_id: (r as any).customer_id ?? null,
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

  useEffect(() => {
    let active = true
    const loadRole = async () => {
      try {
        if (!user?.id) return
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if (!active) return
        setCurrentUserRole((data as any)?.role ? String((data as any).role) : null)
      } catch {
        if (!active) return
        setCurrentUserRole(null)
      }
    }
    loadRole()
    return () => { active = false }
  }, [user?.id])

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

            </div>
            {!isSalesRepViewOnly && (
              activeTab === 'products' ? (
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
              )
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

        {/* Add Product Modal */}
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
                              return null
                            } else {
                              const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
                              let url = pub?.publicUrl || null
                              if (!url) {
                                const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365)
                                url = signed?.signedUrl || null
                              }
                              return url
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
                      isDiscontinued: !!productForm.isDiscontinued,
                      substituteSku: productForm.substituteSku || null,
                      allergenProfile: productForm.allergens,
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
                        is_discontinued: !!productForm.isDiscontinued,
                        substitute_sku: productForm.substituteSku || null,
                        allergen_profile: productForm.allergens,
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
                        is_discontinued: !!productForm.isDiscontinued,
                        substitute_sku: productForm.substituteSku || null,
                        allergen_profile: productForm.allergens,
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Row 1: Product Name and Customer */}
                  <div className="space-y-3 lg:col-span-2">
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
                          <div className="my-1 border-t border-neutral-soft"></div>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-primary-medium hover:text-primary-dark hover:bg-neutral-light"
                            onClick={() => { setIsCustomerOpen(false); setShowAddCustomer(true); }}
                          >
                            + Add New Customer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Product Size and Unit of Measure */}
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">
                      <Box className="h-4 w-4 mr-2 text-primary-medium" />
                      Product Size
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 8oz, 12oz, 16oz"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                      value={productForm.productSize}
                      onChange={(e) => setProductForm({ ...productForm, productSize: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">
                      <Scale className="h-4 w-4 mr-2 text-primary-medium" />
                      Unit of Measure
                    </label>
                    <div className="relative" ref={uomRef}>
                      <button
                        type="button"
                        onClick={() => setIsUomOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        <span className={productForm.uom ? 'text-neutral-dark' : 'text-neutral-medium'}>
                          {productForm.uom || 'Select UOM'}
                        </span>
                        <span className="ml-2 text-neutral-medium">▼</span>
                      </button>
                      {isUomOpen && (
                        <div className="absolute z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                          <div className="px-3 py-2 text-xs text-neutral-medium">Select Unit</div>
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
                          <div className="my-1 border-t border-neutral-soft"></div>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-primary-medium hover:text-primary-dark hover:bg-neutral-light"
                            onClick={() => { setIsUomOpen(false); setShowAddUom(true); }}
                          >
                            + Add New UOM
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Packaging Type and Product Type */}
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">
                      <Box className="h-4 w-4 mr-2 text-primary-medium" />
                      Packaging Type
                    </label>
                    <div className="relative" ref={packagingTypeRef}>
                      <button
                        type="button"
                        onClick={() => setIsPackagingTypeOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        <span className={productForm.packagingType ? 'text-neutral-dark' : 'text-neutral-medium'}>
                          {productForm.packagingType || 'Select Packaging Type'}
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

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">
                      <Package className="h-4 w-4 mr-2 text-primary-medium" />
                      Product Type
                    </label>
                    <div className="relative" ref={productTypeRef}>
                      <button
                        type="button"
                        onClick={() => setIsProductTypeOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-lg text-left bg-white transition-all hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        <span className={productForm.productType ? 'text-neutral-dark' : 'text-neutral-medium'}>
                          {productForm.productType || 'Select Product Type'}
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
                            + Add New Product Type
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Formula and Shelf Life */}
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">
                      <FlaskConical className="h-4 w-4 mr-2 text-primary-medium" />
                      Formula
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative" ref={formulaRef}>
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
                          <div className="my-1 border-t border-neutral-soft"></div>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-primary-medium hover:text-primary-dark hover:bg-neutral-light"
                            onClick={() => { setIsFormulaOpen(false); setActiveTab('formulas'); }}
                          >
                            + Add New Formula
                          </button>
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

                  {/* Row 6.5: Discontinued and Substitute SKU */}
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">Discontinued</label>
                    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-neutral-soft text-primary-medium focus:ring-primary-light"
                        checked={productForm.isDiscontinued}
                        onChange={(e) => setProductForm({ ...productForm, isDiscontinued: e.target.checked })}
                      />
                      <span className="text-neutral-dark text-sm">Mark product as discontinued</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">UPC/SKU</label>
                    <input
                      type="text"
                      placeholder="e.g., SKU-ALT-1234"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                      value={productForm.substituteSku}
                      onChange={(e) => setProductForm({ ...productForm, substituteSku: e.target.value })}
                    />
                  </div>

                  {/* Row 7: Price */}
                  <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">
                    <span className="text-neutral-dark">Price</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 12.99"
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    value={productForm.cost}
                    onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                  />

                  </div>

                  {/* Row 8: Case Qty and Case Dimensions (One Line) */}
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">Case Qty</label>
                    <input
                      type="number"
                      placeholder="e.g., 12"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                      value={productForm.caseQty}
                      onChange={(e) => setProductForm({ ...productForm, caseQty: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-medium text-neutral-dark">Case Dimensions</label>
                    <input
                      type="text"
                      placeholder="e.g., 12x8x6 inches"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                      value={productForm.caseDimension}
                      onChange={(e) => setProductForm({ ...productForm, caseDimension: e.target.value })}
                    />
                  </div>

                  {/* Row 6.6: Allergen Profile */}
                  <div className="space-y-3 md:col-span-2 lg:col-span-3">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">Allergen Profile</label>
                  <div className="flex flex-wrap gap-2">
                    {commonAllergens.map((a: string) => {
                      const active = productForm.allergens.includes(a)
                      return (
                        <button
                          key={a}
                          type="button"
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active ? 'bg-primary-light/20 text-primary-dark border-primary-light' : 'bg-white text-neutral-dark border-neutral-soft hover:border-neutral-medium'}`}
                          onClick={() => {
                            const exists = productForm.allergens.includes(a)
                            setProductForm({
                              ...productForm,
                              allergens: exists ? productForm.allergens.filter((al) => al !== a) : [...productForm.allergens, a],
                            })
                          }}
                        >
                          {a}
                        </button>
                      )
                    })}
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Type custom allergen and press Enter"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      onKeyDown={(e) => {
                        const v = (e.target as HTMLInputElement).value.trim()
                        if (e.key === 'Enter' && v) {
                          e.preventDefault()
                          if (!productForm.allergens.includes(v)) setProductForm({ ...productForm, allergens: [...productForm.allergens, v] })
                          ;(e.target as HTMLInputElement).value = ''
                        }
                      }}
                    />
                    {productForm.allergens.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {productForm.allergens.map((a, i) => (
                          <span key={`${a}-${i}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-neutral-soft">
                            {a}
                            <button type="button" className="text-neutral-medium hover:text-neutral-dark" onClick={() => setProductForm({ ...productForm, allergens: productForm.allergens.filter((_, idx) => idx !== i) })}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                {/* Row 7: Product Files */}
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-neutral-dark">
                    <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                    Spec Sheet
                  </label>
                  <input
                    ref={docFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length) setProductForm({ ...productForm, docFiles: [...productForm.docFiles, ...files] })
                      if (docFileInputRef.current) docFileInputRef.current.value = ''
                    }}
                  />

                  <div
                    className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-300 cursor-pointer ${docDragOver ? 'border-primary-light bg-primary-light/10' : 'border-neutral-soft bg-gradient-to-br from-neutral-light/40 to-neutral-light/20 hover:from-primary-light/10 hover:to-primary-medium/5'}`}
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
                      <button type="button" className="px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-medium shadow-sm">Browse File</button>
                    </div>

                    {productForm.docFiles.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {productForm.docFiles.map((f, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white border border-neutral-soft rounded-lg px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {(() => { const meta = getFileMeta(f.name); return (<span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>) })()}
                              <span className="text-sm text-neutral-dark truncate">{f.name}</span>
                            </div>
                            <button type="button" className="px-2 py-1 text-xs rounded-md bg-white/90 hover:bg-white border border-neutral-soft shadow-sm" onClick={(e) => { e.stopPropagation(); setProductForm({ ...productForm, docFiles: productForm.docFiles.filter((_, i) => i !== idx) }) }}>Delete</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {productForm.docFiles.length === 0 && (
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

                {/* Row 8: Product Images */}
                <div
                  className={`rounded-xl border-2 border-dashed ${imgDragOver ? 'border-primary-light bg-primary-light/10' : 'border-neutral-soft bg-gradient-to-br from-neutral-light/40 to-neutral-light/20'} p-4`}
                  onDragOver={(e) => { e.preventDefault(); setImgDragOver(true) }}
                  onDragLeave={() => setImgDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setImgDragOver(false)
                    const files = Array.from(e.dataTransfer.files || [])
                    if (files.length) setProductForm({ ...productForm, images: [...productForm.images, ...files] })
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <Upload className="h-5 w-5 mr-3 text-primary-medium" />
                      Product Image
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-medium shadow-sm"
                    >
                      + Add Images
                    </button>
                  </div>
                  <div className="text-xs text-neutral-medium mb-3">JPG, PNG, PDF up to 10MB</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length) setProductForm({ ...productForm, images: [...productForm.images, ...files] })
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  />

                  {imagePreviews.length === 0 ? (
                    <div className="text-center py-8" onClick={() => fileInputRef.current?.click()}>
                      <div className="mx-auto w-12 h-12 bg-primary-light/20 rounded-full flex items-center justify-center mb-3">
                        <Upload className="h-6 w-6 text-primary-medium" />
                      </div>
                      <p className="text-sm text-neutral-dark font-semibold">Click "+ Add Images" to upload</p>
                      <p className="text-xs text-neutral-medium">You can add multiple images. They will appear below.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {imagePreviews.map((src, idx) => (
                        <div key={idx} className="group relative bg-white rounded-lg border border-neutral-soft overflow-hidden">
                          <img src={src} alt={`Preview ${idx + 1}`} className="w-full h-32 object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const newImages = productForm.images.filter((_, i) => i !== idx)
                              setProductForm({ ...productForm, images: newImages })
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-accent-danger shadow hover:bg-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-end gap-4 pt-8 mt-8 border-t border-neutral-soft/50 bg-gradient-to-r from-neutral-light/20 to-transparent -mx-8 px-8 pb-8">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        )}

        {/* Add New Customer Modal */}
        {showAddCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-neutral-dark mb-4">Add New Customer</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-dark mb-2">Customer Name</label>
                  <input
                    type="text"
                    placeholder="Enter customer name"
                    className="w-full px-3 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCustomerName.trim()) {
                        handleAddCustomer();
                      }
                    }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowAddCustomer(false); setNewCustomerName(''); }}
                    className="flex-1 px-4 py-2 border border-neutral-soft rounded-lg text-neutral-dark hover:bg-neutral-light"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomer}
                    disabled={!newCustomerName.trim() || isCreatingCustomer}
                    className="flex-1 px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                  >
                    {isCreatingCustomer ? 'Adding...' : 'Add Customer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add New Product Type Modal */}
        {showAddProductType && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-neutral-dark mb-4">Add New Product Type</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-dark mb-2">Product Type</label>
                  <input
                    type="text"
                    placeholder="Enter product type"
                    className="w-full px-3 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newValue.trim()) {
                        handleAddProductType()
                      }
                    }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowAddProductType(false); setNewValue(''); }}
                    className="flex-1 px-4 py-2 border border-neutral-soft rounded-lg text-neutral-dark hover:bg-neutral-light"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddProductType}
                    disabled={!newValue.trim()}
                    className="flex-1 px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                  >
                    Add Product Type
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add New UOM Modal */}
        {showAddUom && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-neutral-dark mb-4">Add New Unit of Measure</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-dark mb-2">Unit Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Milliliters (ml)"
                    className="w-full px-3 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newValue.trim()) {
                        handleAddUom();
                      }
                    }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowAddUom(false); setNewValue(''); }}
                    className="flex-1 px-4 py-2 border border-neutral-soft rounded-lg text-neutral-dark hover:bg-neutral-light"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddUom}
                    disabled={!newValue.trim()}
                    className="flex-1 px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                  >
                    Add UOM
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simple Products List */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-soft/20 p-16 flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-primary-light/20 rounded-full flex items-center justify-center mb-6">
              <Package className="h-12 w-12 text-primary-medium" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-dark mb-2">No products found</h3>
            <p className="text-neutral-medium mb-6">Add your first product to get started with your inventory.</p>
            {!isSalesRepViewOnly && (
              <button 
                onClick={() => setIsAddOpen(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Product
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-neutral-dark mb-1">Product Catalog</h3>
                  <p className="text-neutral-medium text-sm">{filteredProducts.length} products in your inventory</p>
                </div>
                <div className="px-3 py-1 bg-primary-light/10 rounded-lg border border-primary-light/20">
                  <span className="text-sm font-semibold text-primary-dark">{filteredProducts.length} total</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-neutral-light/40 border-b border-neutral-soft/50">
                    <th className="px-8 py-4 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-primary-medium" />
                        <span>Product</span>
                      </div>
                    </th>
                    <th className="px-8 py-4 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-primary-medium" />
                        <span>Created</span>
                      </div>
                    </th>
                    <th className="px-8 py-4 text-center text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-soft/20">
                  {filteredProducts.map((product) => (
                    <tr 
                      key={product.id} 
                      className="group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm cursor-pointer"
                      onClick={() => {
                        setSelectedProduct(product)
                        setIsDetailOpen(true)
                      }}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md group-hover:shadow-lg transition-shadow duration-300 bg-neutral-light/50 flex items-center justify-center">
                            {product.product_image_url && product.product_image_url.length > 0 ? (
                              <img src={product.product_image_url[0]} alt={product.product_name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-primary-dark" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-semibold text-neutral-dark truncate flex items-center gap-2">
                              <span className="truncate">{product.product_name}</span>
                              {product.is_discontinued && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">DISCONTINUED</span>
                              )}
                            </div>
                            <div className="text-sm text-neutral-medium truncate mt-1">
                              {product.customer_name} • {product.product_type}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-neutral-medium">
                          {product.created_at ? new Date(product.created_at).toLocaleDateString() : '—'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center">
                          {!isSalesRepViewOnly && (
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
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Product Detail Modal */}
        {isDetailOpen && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setIsDetailOpen(false)}></div>
            <div className="relative z-10 w-full max-w-6xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-neutral-soft/30 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="relative flex items-center justify-between px-10 py-7 
                  bg-gradient-to-r from-neutral-50 via-primary-light/20 to-primary-light/10
                  backdrop-blur-md border-b border-neutral-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]
                  rounded-t-2xl">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="p-2 rounded-xl hover:bg-neutral-200/70 text-neutral-500 hover:text-neutral-900 transition-all duration-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                  <div className="flex flex-col">
                    <h2 className="text-2xl font-semibold text-neutral-800 tracking-tight leading-tight">
                      {selectedProduct.product_name}
                    </h2>
                    <p className="text-sm text-neutral-500 leading-snug mt-1">
                      {selectedProduct.customer_name} • {selectedProduct.product_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {!isSalesRepViewOnly && (
                  <button
                    onClick={() => {
                      const matched = customers?.find((c) => c.name === selectedProduct.customer_name)
                      setEditForm({
                        id: selectedProduct.id,
                        product_name: selectedProduct.product_name,
                        customer_name: selectedProduct.customer_name,
                        customerId: matched?.id || '',
                        product_type: selectedProduct.product_type,
                        packaging_type: selectedProduct.packaging_type,
                        unit_of_measure: selectedProduct.unit_of_measure,
                        shelf_life_days: selectedProduct.shelf_life_days,
                        description: selectedProduct.description,
                        product_image_url: selectedProduct.product_image_url || [],
                        product_file_url: selectedProduct.product_file_url || null,
                        product_file_urls: selectedProduct.product_file_urls || [],
                        formula_id: selectedProduct.formula_id || null,
                        formula_name: selectedProduct.formula_name || null,
                        cost: typeof selectedProduct.cost === 'number' ? selectedProduct.cost : (selectedProduct.cost ? Number(selectedProduct.cost) : ''),
                        case_dimension: selectedProduct.case_dimension ?? '',
                        case_qty: typeof selectedProduct.case_qty === 'number' ? selectedProduct.case_qty : (selectedProduct.case_qty ? Number(selectedProduct.case_qty) : ''),
                        is_discontinued: !!selectedProduct.is_discontinued,
                        substitute_sku: selectedProduct.substitute_sku || '',
                        allergen_profile: Array.isArray(selectedProduct.allergen_profile) ? selectedProduct.allergen_profile : [],
                      })
                      setEditSelectedFormula(selectedProduct.formula_id ? { id: selectedProduct.formula_id, formula_name: selectedProduct.formula_name || '' } as any : null)
                      setIsDetailOpen(false)
                      setIsEditOpen(true)
                    }}
                    className="px-4 py-2 rounded-xl bg-primary-medium text-white hover:bg-primary-dark transition-all duration-300 shadow-sm hover:shadow-md text-sm font-medium"
                  >
                    Edit Product
                  </button>
                  )}
                </div>
              </div>
              {/* Modal Body */}
              <div className="flex-1 overflow-auto">
                <div className="p-8">
                  {/* Product Details Card */}
                  <div className="mb-8 bg-white rounded-3xl border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
                    <div className="relative bg-gradient-to-r from-slate-50 via-neutral-50 to-slate-50/80 border-b border-neutral-200/60 px-6 py-5">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500/10 to-primary-600/20 rounded-2xl flex items-center justify-center">
                          <Package className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 tracking-tight">Product Details</h3>
                          <p className="text-sm text-slate-500 mt-0.5">Basic product information and specifications</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Product Name</label>
                          <div className="text-neutral-dark font-medium">{selectedProduct.product_name}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Customer</label>
                          <div className="text-neutral-dark">{selectedProduct.customer_name}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Product Type</label>
                          <div className="text-neutral-dark">{selectedProduct.product_type}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Packaging</label>
                          <div className="text-neutral-dark">{selectedProduct.packaging_type}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Unit of Measure</label>
                          <div className="text-neutral-dark">{selectedProduct.unit_of_measure}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Shelf Life</label>
                          <div className="text-neutral-dark">{selectedProduct.shelf_life_days} days</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Discontinued</label>
                          <div className="text-neutral-dark">
                            {selectedProduct.is_discontinued ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">YES</span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">NO</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Substitute SKU</label>
                          <div className="text-neutral-dark">{selectedProduct.substitute_sku || '—'}</div>
                        </div>
                        <div className="space-y-1 md:col-span-2 lg:col-span-3">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Allergen Profile</label>
                          {Array.isArray(selectedProduct.allergen_profile) && selectedProduct.allergen_profile.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedProduct.allergen_profile.map((a: string, i: number) => (
                                <span key={`${a}-${i}`} className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-white border border-neutral-200 text-neutral-700">{a}</span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-neutral-medium">—</div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Formula</label>
                          <div className="text-neutral-dark">{selectedProduct.formula_name || '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Cost per Unit</label>
                          <div className="text-neutral-dark font-semibold">{typeof selectedProduct.cost === 'number' ? `$${selectedProduct.cost.toFixed(2)}` : '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Case Information</label>
                          <div className="text-neutral-dark">
                            {selectedProduct.case_qty ? `${selectedProduct.case_qty} units` : '—'}
                            {selectedProduct.case_dimension && ` • ${selectedProduct.case_dimension}`}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Created Date</label>
                          <div className="text-neutral-dark">{selectedProduct.created_at ? new Date(selectedProduct.created_at).toLocaleDateString() : '—'}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-neutral-medium uppercase tracking-wide">Last Updated</label>
                          <div className="text-neutral-dark">{selectedProduct.updated_at ? new Date(selectedProduct.updated_at).toLocaleDateString() : '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-neutral-dark">Product Collection</h3>
                    <p className="text-sm text-neutral-medium">Images • Documents • File Attachments</p>
                  </div>

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
                  {selectedProduct.product_file_urls && selectedProduct.product_file_urls.length > 0 && (
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
                              <p className="text-sm text-slate-500 mt-0.5">{selectedProduct.product_file_urls.length} file{selectedProduct.product_file_urls.length !== 1 ? 's' : ''} attached</p>
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
                            {selectedProduct.product_file_urls.map((url, idx) => (
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
                            {selectedProduct.product_file_urls.map((url, idx) => (
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
                  {(!selectedProduct.product_image_url || selectedProduct.product_image_url.length === 0) ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-neutral-light/60 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="h-10 w-10 text-neutral-medium" />
                      </div>
                      <h4 className="text-lg font-semibold text-neutral-dark mb-2">No Images Available</h4>
                      <p className="text-neutral-medium">This product doesn't have any images yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {selectedProduct.product_image_url.map((src, idx) => (
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
                    if (error) {
                      console.error('Delete error:', error)
                      setConfirmDelete((s) => ({ ...s, loading: false, error: `Delete failed: ${error.message}` }))
                    } else if (!delRows || delRows.length === 0) {
                      setConfirmDelete((s) => ({ ...s, loading: false, error: 'No rows were deleted. The product may not exist or you may not have permission.' }))
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
                      is_discontinued: !!ef.is_discontinued,
                      substitute_sku: ef.substitute_sku ?? null,
                      allergen_profile: Array.isArray(ef.allergen_profile) ? ef.allergen_profile : [],
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
                        isDiscontinued: !!ef.is_discontinued,
                        substituteSku: ef.substitute_sku ?? null,
                        allergenProfile: Array.isArray(ef.allergen_profile) ? ef.allergen_profile : [],
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