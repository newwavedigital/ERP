import React, { useState } from 'react'
import { Truck, Building2, User, Mail, Phone, Globe, MapPin, FileText, CheckCircle2, ArrowLeft, CreditCard, Percent, BadgeCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const SupplierRegistration: React.FC = () => {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    company_name: '',
    dba: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    physical_address: '',
    mailing_address: '',
    materials_supplied: '',
    category: 'Raw Materials',
    payment_terms: '',
    payment_terms_net30: false,
    payment_terms_net60: false,
    payment_terms_net90: false,
    payment_terms_discount_percent: '',
    payment_terms_discount_days: '',
    account_rep_name: '',
    account_rep_email: '',
    account_rep_office_phone: '',
    account_rep_cell_phone: '',
    gfsi_certification_held: false,
    gfsi_cert_name: '',
    ap_rep_name: '',
    ap_rep_email: '',
    ap_rep_office_phone: '',
    ap_rep_cell_phone: '',
    qa_rep_name: '',
    qa_rep_email: '',
    qa_rep_office_phone: '',
    qa_rep_cell_phone: '',
    emergency_contact_name: '',
    emergency_contact_email: '',
    emergency_contact_office_phone: '',
    emergency_contact_cell_phone: '',
    purchase_approval_required: false,
    purchase_approval_documents_received: false,
    purchase_approval_determination: '',
    approved_by: '',
  })

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: insertError } = await supabase.from('suppliers').insert({
        company_name: formData.company_name,
        dba: formData.dba || null,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone || null,
        website: formData.website || null,
        physical_address: formData.physical_address || null,
        mailing_address: formData.mailing_address || null,
        address: formData.physical_address || null,
        materials_supplied: formData.materials_supplied || null,
        category: formData.category,
        payment_terms: formData.payment_terms || null,
        payment_terms_net30: formData.payment_terms_net30,
        payment_terms_net60: formData.payment_terms_net60,
        payment_terms_net90: formData.payment_terms_net90,
        payment_terms_discount_percent: formData.payment_terms_discount_percent ? parseFloat(formData.payment_terms_discount_percent) : null,
        payment_terms_discount_days: formData.payment_terms_discount_days ? parseInt(formData.payment_terms_discount_days) : null,
        account_rep_name: formData.account_rep_name || null,
        account_rep_email: formData.account_rep_email || null,
        account_rep_office_phone: formData.account_rep_office_phone || null,
        account_rep_cell_phone: formData.account_rep_cell_phone || null,
        gfsi_certification_held: formData.gfsi_certification_held,
        gfsi_cert_name: formData.gfsi_cert_name || null,
        ap_rep_name: formData.ap_rep_name || null,
        ap_rep_email: formData.ap_rep_email || null,
        ap_rep_office_phone: formData.ap_rep_office_phone || null,
        ap_rep_cell_phone: formData.ap_rep_cell_phone || null,
        qa_rep_name: formData.qa_rep_name || null,
        qa_rep_email: formData.qa_rep_email || null,
        qa_rep_office_phone: formData.qa_rep_office_phone || null,
        qa_rep_cell_phone: formData.qa_rep_cell_phone || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_email: formData.emergency_contact_email || null,
        emergency_contact_office_phone: formData.emergency_contact_office_phone || null,
        emergency_contact_cell_phone: formData.emergency_contact_cell_phone || null,
        purchase_approval_required: formData.purchase_approval_required,
        purchase_approval_documents_received: formData.purchase_approval_documents_received,
        purchase_approval_determination: formData.purchase_approval_determination || null,
        approved_by: formData.approved_by || null,
        status: 'Active',
        rating: 0,
      })

      if (insertError) throw insertError

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
            <p className="text-white/90 text-lg">Thank you for registering as a supplier</p>
          </div>
          <div className="p-8 text-center">
            <p className="text-neutral-dark text-lg mb-6">
              Your supplier registration has been submitted successfully. Our procurement team will review your information and contact you shortly.
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
                <Truck className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Supplier Registration</h1>
                <p className="text-white/90 text-lg mt-1">Complete supplier profile and business information</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-8 mt-6 p-4 rounded-xl border border-accent-danger/30 bg-accent-danger/10 text-accent-danger">
              {error}
            </div>
          )}

          <div className="p-8 space-y-8">
            {/* Company Information */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <Building2 className="h-5 w-5 mr-2 text-primary-medium" />
                  Company Information
                </h3>
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
                      placeholder="e.g., ABC Supplies Corp."
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <Building2 className="h-4 w-4 mr-2 text-primary-medium" />
                      DBA (Doing Business As)
                    </label>
                    <input
                      type="text"
                      value={formData.dba}
                      onChange={(e) => setFormData({ ...formData, dba: e.target.value })}
                      placeholder="Trade name if different"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <User className="h-4 w-4 mr-2 text-primary-medium" />
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      placeholder="e.g., Jane Smith"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <Mail className="h-4 w-4 mr-2 text-primary-medium" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jane@supplier.com"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <Phone className="h-4 w-4 mr-2 text-primary-medium" />
                      Phone
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 555 000 0000"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <Globe className="h-4 w-4 mr-2 text-primary-medium" />
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://supplier.com"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-primary-medium" />
                  Address Information
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-semibold text-neutral-dark">
                    <MapPin className="h-4 w-4 mr-2 text-primary-medium" />
                    Physical Address
                  </label>
                  <textarea
                    value={formData.physical_address}
                    onChange={(e) => setFormData({ ...formData, physical_address: e.target.value })}
                    placeholder="Street, City, State, ZIP, Country"
                    rows={3}
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center text-sm font-semibold text-neutral-dark">
                    <Mail className="h-4 w-4 mr-2 text-primary-medium" />
                    Mailing Address (if different)
                  </label>
                  <textarea
                    value={formData.mailing_address}
                    onChange={(e) => setFormData({ ...formData, mailing_address: e.target.value })}
                    placeholder="Leave blank if same as physical address"
                    rows={3}
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                  />
                </div>
              </div>
            </div>

            {/* Business Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <Truck className="h-5 w-5 mr-2 text-primary-medium" />
                  Business Details & Materials
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-semibold text-neutral-dark">
                    <Truck className="h-4 w-4 mr-2 text-primary-medium" />
                    Materials/Products Supplied
                  </label>
                  <textarea
                    value={formData.materials_supplied}
                    onChange={(e) => setFormData({ ...formData, materials_supplied: e.target.value })}
                    placeholder="Describe the materials, products, or services you supply..."
                    rows={4}
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark hover:border-neutral-medium"
                    >
                      <option value="Raw Materials">Raw Materials</option>
                      <option value="Packaging">Packaging</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Services">Services</option>
                      <option value="Ingredients">Ingredients</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" />
                      GFSI Certification
                    </label>
                    <label className="flex items-center gap-2 px-4 py-3 border border-neutral-soft rounded-lg hover:bg-neutral-light/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.gfsi_certification_held}
                        onChange={(e) => setFormData({ ...formData, gfsi_certification_held: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">GFSI Certification Held</span>
                    </label>
                  </div>
                </div>

                {formData.gfsi_certification_held && (
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" />
                      GFSI Certification Name
                    </label>
                    <input
                      type="text"
                      value={formData.gfsi_cert_name}
                      onChange={(e) => setFormData({ ...formData, gfsi_cert_name: e.target.value })}
                      placeholder="e.g., SQF, BRC, FSSC 22000"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Payment Terms */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-primary-medium" />
                  Payment Terms
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-semibold text-neutral-dark">
                    <CreditCard className="h-4 w-4 mr-2 text-primary-medium" />
                    General Payment Terms
                  </label>
                  <input
                    type="text"
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    placeholder="e.g., NET 30, NET 60, Due on Receipt"
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-neutral-dark">NET Terms</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.payment_terms_net30}
                        onChange={(e) => setFormData({ ...formData, payment_terms_net30: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">NET 30 Days</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.payment_terms_net60}
                        onChange={(e) => setFormData({ ...formData, payment_terms_net60: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">NET 60 Days</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.payment_terms_net90}
                        onChange={(e) => setFormData({ ...formData, payment_terms_net90: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">NET 90 Days</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <Percent className="h-4 w-4 mr-2 text-primary-medium" />
                      Early Payment Discount (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.payment_terms_discount_percent}
                      onChange={(e) => setFormData({ ...formData, payment_terms_discount_percent: e.target.value })}
                      placeholder="e.g., 2"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                      Discount Days
                    </label>
                    <input
                      type="number"
                      value={formData.payment_terms_discount_days}
                      onChange={(e) => setFormData({ ...formData, payment_terms_discount_days: e.target.value })}
                      placeholder="e.g., 10"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Representatives */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <User className="h-5 w-5 mr-2 text-primary-medium" />
                  Representatives & Contacts
                </h3>
              </div>
              <div className="p-6 space-y-8">
                {/* Account Representative */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider">Account Representative</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input id="account_rep_name" name="account_rep_name" type="text" value={formData.account_rep_name} onChange={(e) => setFormData({ ...formData, account_rep_name: e.target.value })} placeholder="Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="account_rep_email" name="account_rep_email" type="email" value={formData.account_rep_email} onChange={(e) => setFormData({ ...formData, account_rep_email: e.target.value })} placeholder="Email" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="account_rep_office_phone" name="account_rep_office_phone" type="text" value={formData.account_rep_office_phone} onChange={(e) => setFormData({ ...formData, account_rep_office_phone: e.target.value })} placeholder="Office Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="account_rep_cell_phone" name="account_rep_cell_phone" type="text" value={formData.account_rep_cell_phone} onChange={(e) => setFormData({ ...formData, account_rep_cell_phone: e.target.value })} placeholder="Cell Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                  </div>
                </div>

                {/* Accounts Payable Representative */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider">Accounts Payable Representative</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input id="ap_rep_name" name="ap_rep_name" type="text" value={formData.ap_rep_name} onChange={(e) => setFormData({ ...formData, ap_rep_name: e.target.value })} placeholder="Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="ap_rep_email" name="ap_rep_email" type="email" value={formData.ap_rep_email} onChange={(e) => setFormData({ ...formData, ap_rep_email: e.target.value })} placeholder="Email" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="ap_rep_office_phone" name="ap_rep_office_phone" type="text" value={formData.ap_rep_office_phone} onChange={(e) => setFormData({ ...formData, ap_rep_office_phone: e.target.value })} placeholder="Office Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="ap_rep_cell_phone" name="ap_rep_cell_phone" type="text" value={formData.ap_rep_cell_phone} onChange={(e) => setFormData({ ...formData, ap_rep_cell_phone: e.target.value })} placeholder="Cell Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                  </div>
                </div>

                {/* Quality Assurance Representative */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider">Quality Assurance Representative</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input id="qa_rep_name" name="qa_rep_name" type="text" value={formData.qa_rep_name} onChange={(e) => setFormData({ ...formData, qa_rep_name: e.target.value })} placeholder="Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="qa_rep_email" name="qa_rep_email" type="email" value={formData.qa_rep_email} onChange={(e) => setFormData({ ...formData, qa_rep_email: e.target.value })} placeholder="Email" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="qa_rep_office_phone" name="qa_rep_office_phone" type="text" value={formData.qa_rep_office_phone} onChange={(e) => setFormData({ ...formData, qa_rep_office_phone: e.target.value })} placeholder="Office Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="qa_rep_cell_phone" name="qa_rep_cell_phone" type="text" value={formData.qa_rep_cell_phone} onChange={(e) => setFormData({ ...formData, qa_rep_cell_phone: e.target.value })} placeholder="Cell Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-red-700 uppercase tracking-wider">Emergency Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input id="emergency_contact_name" name="emergency_contact_name" type="text" value={formData.emergency_contact_name} onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })} placeholder="Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="emergency_contact_email" name="emergency_contact_email" type="email" value={formData.emergency_contact_email} onChange={(e) => setFormData({ ...formData, emergency_contact_email: e.target.value })} placeholder="Email" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="emergency_contact_office_phone" name="emergency_contact_office_phone" type="text" value={formData.emergency_contact_office_phone} onChange={(e) => setFormData({ ...formData, emergency_contact_office_phone: e.target.value })} placeholder="Office Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                    <input id="emergency_contact_cell_phone" name="emergency_contact_cell_phone" type="text" value={formData.emergency_contact_cell_phone} onChange={(e) => setFormData({ ...formData, emergency_contact_cell_phone: e.target.value })} placeholder="Cell Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Approval */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-primary-medium" />
                  Purchase Approval
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.purchase_approval_required}
                      onChange={(e) => setFormData({ ...formData, purchase_approval_required: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Purchase Approval Required</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.purchase_approval_documents_received}
                      onChange={(e) => setFormData({ ...formData, purchase_approval_documents_received: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Documents Received</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-dark">Determination</label>
                    <input
                      type="text"
                      value={formData.purchase_approval_determination}
                      onChange={(e) => setFormData({ ...formData, purchase_approval_determination: e.target.value })}
                      placeholder="Approval determination"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-dark">Approved By</label>
                    <input
                      type="text"
                      value={formData.approved_by}
                      onChange={(e) => setFormData({ ...formData, approved_by: e.target.value })}
                      placeholder="Approver name"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                    />
                  </div>
                </div>
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
                {isSubmitting ? 'Submitting...' : 'Submit Registration'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupplierRegistration
