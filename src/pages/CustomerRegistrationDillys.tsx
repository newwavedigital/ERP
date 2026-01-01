import React, { useState } from 'react'
import { Building2, User, Mail, Phone, Globe, MapPin, FileText, CheckCircle2, ArrowLeft, BadgeCheck, Package, Box, Leaf, FlaskConical, FileUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const CustomerRegistrationDillys: React.FC = () => {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [onboardingId, setOnboardingId] = useState<string | null>(null)
  const [onboardingNotes, setOnboardingNotes] = useState('')
  
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    comments: '',
    status: 'Active',
  })

  const [products, setProducts] = useState<Array<{product_name: string, formula_source: string, specifications: string, trial_date: string}>>([])
  const [newProduct, setNewProduct] = useState({ product_name: '', formula_source: 'existing', specifications: '', trial_date: '' })

  const [packaging, setPackaging] = useState<Array<any>>([])
  const [newPackaging, setNewPackaging] = useState({ packaging_type: '', size: '', case_pack_qty: '', label_orientation: '', artwork_required: false, provided_by_customer: false, notes: '' })

  const [ingredients, setIngredients] = useState<Array<any>>([])
  const [newIngredient, setNewIngredient] = useState({ ingredient_name: '', vendor_name: '', provided_by_customer: false })

  const testsList = ['Crude Analysis', 'Salmonella', 'Mold', 'Free Fatty Acids', 'PH', 'Coliform', 'Peroxide Value', 'Yeast']
  const [selectedTests, setSelectedTests] = useState<string[]>([])

  const [documents, setDocuments] = useState<Array<{document_type: string, file_url: string}>>([])
  const [newDoc, setNewDoc] = useState({ document_type: 'specs', file_url: '' })

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      let ensuredCustomerId = customerId
      if (!ensuredCustomerId) {
        const { data, error: customerError } = await supabase.from('customers').insert({
          company_name: formData.company_name,
          contact_person: formData.contact_person || null,
          email: formData.email || null,
          phone: formData.phone || null,
          website: formData.website || null,
          address: formData.address || null,
          comments: formData.comments || null,
          status: formData.status || 'Active',
        }).select('id').single()
        if (customerError) throw customerError
        ensuredCustomerId = data.id
        setCustomerId(ensuredCustomerId)
      }

      let ensuredOnboardingId = onboardingId
      if (!ensuredOnboardingId) {
        const { data: onboardingData, error: onboardingError } = await supabase
          .from('customer_onboardings')
          .insert({ customer_id: ensuredCustomerId, onboarding_type: 'DILLYS', status: 'Submitted', notes: onboardingNotes || null })
          .select('id')
          .single()
        if (onboardingError) throw onboardingError
        ensuredOnboardingId = onboardingData.id
        setOnboardingId(ensuredOnboardingId)
      }

      if (products.length > 0) {
        const productRecords = products.map(p => ({ onboarding_id: ensuredOnboardingId, ...p }))
        await supabase.from('onboarding_products').insert(productRecords)
      }

      if (packaging.length > 0) {
        const packagingRecords = packaging.map(p => ({ onboarding_id: ensuredOnboardingId, ...p, case_pack_qty: parseInt(p.case_pack_qty) || null }))
        await supabase.from('onboarding_packaging').insert(packagingRecords)
      }

      if (ingredients.length > 0) {
        const ingredientRecords = ingredients.map(i => ({ onboarding_id: ensuredOnboardingId, ...i }))
        await supabase.from('onboarding_ingredients').insert(ingredientRecords)
      }

      if (selectedTests.length > 0) {
        const testRecords = selectedTests.map(test => ({ onboarding_id: ensuredOnboardingId, test_name: test, required: true }))
        await supabase.from('onboarding_lab_requirements').insert(testRecords)
      }

      if (documents.length > 0) {
        const docRecords = documents.map(d => ({ onboarding_id: ensuredOnboardingId, ...d }))
        await supabase.from('onboarding_documents').insert(docRecords)
      }

      setSubmitted(true)
    } catch (e: any) {
      setError(e?.message || 'Failed to submit registration')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light/20 via-white to-primary-medium/20 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
          <div className="bg-gradient-to-r from-accent-success to-primary-medium p-8 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Registration Successful!</h2>
            <p className="text-white/90 text-lg">Thank you for registering with Dilly&apos;s</p>
          </div>
          <div className="p-8 text-center">
            <p className="text-neutral-dark text-lg mb-6">
              Your customer registration and onboarding has been submitted successfully. Our team will review your information and contact you shortly.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-gradient-to-r from-primary-dark to-primary-medium text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light/20 via-white to-primary-medium/20 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-primary-dark hover:text-primary-medium transition-colors font-medium"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </button>

        <div className="bg-white rounded-3xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-dark via-primary-medium to-primary-light p-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Dilly&apos;s Customer Registration</h1>
                <p className="text-white/90 text-lg mt-1">Complete customer information and manufacturing requirements</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-8 mt-6 p-4 rounded-xl border border-accent-danger/30 bg-accent-danger/10 text-accent-danger">
              {error}
            </div>
          )}

          <div className="p-8 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark">Customer Information</h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <Building2 className="h-4 w-4 mr-2 text-primary-medium" />
                      Company Name<span className="text-accent-danger ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
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
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
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
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
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
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street, City, Country"
                    rows={3}
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center text-sm font-semibold text-neutral-dark">
                    <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                    Comments
                  </label>
                  <textarea
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    placeholder="Additional notes about this customer"
                    rows={3}
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <Package className="h-5 w-5 mr-2 text-primary-medium" />
                  Products & Specifications
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={newProduct.product_name}
                    onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                    placeholder="Product Name"
                    className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                  />
                  <select
                    value={newProduct.formula_source}
                    onChange={(e) => setNewProduct({ ...newProduct, formula_source: e.target.value })}
                    className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                  >
                    <option value="existing">Existing Formula</option>
                    <option value="customer">Customer Formula</option>
                  </select>
                </div>
                <textarea
                  value={newProduct.specifications}
                  onChange={(e) => setNewProduct({ ...newProduct, specifications: e.target.value })}
                  placeholder="Product specifications"
                  rows={2}
                  className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                />
                <input
                  type="date"
                  value={newProduct.trial_date}
                  onChange={(e) => setNewProduct({ ...newProduct, trial_date: e.target.value })}
                  className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newProduct.product_name) {
                      setProducts([...products, newProduct])
                      setNewProduct({ product_name: '', formula_source: 'existing', specifications: '', trial_date: '' })
                    }
                  }}
                  className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-all"
                >
                  Add Product
                </button>
                {products.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {products.map((p, i) => (
                      <div key={i} className="p-3 bg-neutral-light/30 rounded-lg flex justify-between items-center">
                        <span className="font-medium">{p.product_name}</span>
                        <button onClick={() => setProducts(products.filter((_, idx) => idx !== i))} className="text-accent-danger hover:underline text-sm">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <Box className="h-5 w-5 mr-2 text-primary-medium" />
                  Packaging Configuration
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input type="text" value={newPackaging.packaging_type} onChange={(e) => setNewPackaging({ ...newPackaging, packaging_type: e.target.value })} placeholder="Packaging Type" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                  <input type="text" value={newPackaging.size} onChange={(e) => setNewPackaging({ ...newPackaging, size: e.target.value })} placeholder="Size" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                  <input type="number" value={newPackaging.case_pack_qty} onChange={(e) => setNewPackaging({ ...newPackaging, case_pack_qty: e.target.value })} placeholder="Case Pack Qty" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                </div>
                <select value={newPackaging.label_orientation} onChange={(e) => setNewPackaging({ ...newPackaging, label_orientation: e.target.value })} className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light">
                  <option value="">Select label orientation</option>
                  <option value="Right side up">Right side up</option>
                  <option value="Upside down">Upside down</option>
                </select>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={newPackaging.artwork_required} onChange={(e) => setNewPackaging({ ...newPackaging, artwork_required: e.target.checked })} className="h-4 w-4" />
                    <span className="text-sm">Artwork Required</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={newPackaging.provided_by_customer} onChange={(e) => setNewPackaging({ ...newPackaging, provided_by_customer: e.target.checked })} className="h-4 w-4" />
                    <span className="text-sm">Provided by Customer</span>
                  </label>
                </div>
                <textarea value={newPackaging.notes} onChange={(e) => setNewPackaging({ ...newPackaging, notes: e.target.value })} placeholder="Notes" rows={2} className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                <button type="button" onClick={() => { if (newPackaging.packaging_type) { setPackaging([...packaging, newPackaging]); setNewPackaging({ packaging_type: '', size: '', case_pack_qty: '', label_orientation: '', artwork_required: false, provided_by_customer: false, notes: '' }); } }} className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-all">Add Packaging</button>
                {packaging.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {packaging.map((p, i) => (
                      <div key={i} className="p-3 bg-neutral-light/30 rounded-lg flex justify-between items-center">
                        <span className="font-medium">{p.packaging_type} - {p.size}</span>
                        <button onClick={() => setPackaging(packaging.filter((_, idx) => idx !== i))} className="text-accent-danger hover:underline text-sm">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <Leaf className="h-5 w-5 mr-2 text-primary-medium" />
                  Ingredients & Vendors
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" value={newIngredient.ingredient_name} onChange={(e) => setNewIngredient({ ...newIngredient, ingredient_name: e.target.value })} placeholder="Ingredient Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                  <input type="text" value={newIngredient.vendor_name} onChange={(e) => setNewIngredient({ ...newIngredient, vendor_name: e.target.value })} placeholder="Vendor Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={newIngredient.provided_by_customer} onChange={(e) => setNewIngredient({ ...newIngredient, provided_by_customer: e.target.checked })} className="h-4 w-4" />
                  <span className="text-sm">Provided by Customer</span>
                </label>
                <button type="button" onClick={() => { if (newIngredient.ingredient_name) { setIngredients([...ingredients, newIngredient]); setNewIngredient({ ingredient_name: '', vendor_name: '', provided_by_customer: false }); } }} className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-all">Add Ingredient</button>
                {ingredients.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {ingredients.map((ing, i) => (
                      <div key={i} className="p-3 bg-neutral-light/30 rounded-lg flex justify-between items-center">
                        <span className="font-medium">{ing.ingredient_name}</span>
                        <button onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="text-accent-danger hover:underline text-sm">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <FlaskConical className="h-5 w-5 mr-2 text-primary-medium" />
                  Lab / QA Requirements
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {testsList.map((test) => (
                    <label key={test} className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedTests.includes(test)} onChange={(e) => { if (e.target.checked) { setSelectedTests([...selectedTests, test]) } else { setSelectedTests(selectedTests.filter(t => t !== test)) } }} className="h-4 w-4" />
                      <span className="text-sm">{test}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <FileUp className="h-5 w-5 mr-2 text-primary-medium" />
                  Documents
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <select value={newDoc.document_type} onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })} className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light">
                  <option value="specs">Specs</option>
                  <option value="artwork">Artwork</option>
                  <option value="label">Label</option>
                  <option value="tds">TDS</option>
                </select>
                <input type="url" value={newDoc.file_url} onChange={(e) => setNewDoc({ ...newDoc, file_url: e.target.value })} placeholder="File URL (https://...)" className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                <p className="text-xs text-neutral-medium">Paste the Supabase Storage public URL or any hosted file URL</p>
                <button type="button" onClick={() => { if (newDoc.file_url) { setDocuments([...documents, newDoc]); setNewDoc({ document_type: 'specs', file_url: '' }); } }} className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-all">Add Document</button>
                {documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {documents.map((doc, i) => (
                      <div key={i} className="p-3 bg-neutral-light/30 rounded-lg flex justify-between items-center">
                        <span className="font-medium">{doc.document_type.toUpperCase()}</span>
                        <button onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))} className="text-accent-danger hover:underline text-sm">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark">Notes / Special Instructions</h3>
              </div>
              <div className="p-6">
                <textarea value={onboardingNotes} onChange={(e) => setOnboardingNotes(e.target.value)} placeholder="Any special instructions for production, labeling, packaging, etc." rows={4} className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-3 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.company_name}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Form'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerRegistrationDillys
