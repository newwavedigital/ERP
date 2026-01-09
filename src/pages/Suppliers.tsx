import React, { useState, useEffect } from 'react'
import { Plus, Minus, Search, Filter, Truck, Building2, MapPin, Phone, User, Mail, Globe, CreditCard, X, Eye, Edit, Trash2, CheckCircle2, Percent, Package, ExternalLink, BadgeCheck, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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
  dba?: string
  physical_address?: string
  mailing_address?: string
  payment_terms_net30?: boolean
  payment_terms_net60?: boolean
  payment_terms_net90?: boolean
  payment_terms_discount_percent?: number
  payment_terms_discount_days?: number
  account_rep_name?: string
  account_rep_email?: string
  account_rep_office_phone?: string
  account_rep_cell_phone?: string
  gfsi_certification_held?: boolean
  gfsi_cert_name?: string
  ap_rep_name?: string
  ap_rep_email?: string
  ap_rep_office_phone?: string
  ap_rep_cell_phone?: string
  qa_rep_name?: string
  qa_rep_email?: string
  qa_rep_office_phone?: string
  qa_rep_cell_phone?: string
  emergency_contact_name?: string
  emergency_contact_email?: string
  emergency_contact_office_phone?: string
  emergency_contact_cell_phone?: string
  purchase_approval_required?: boolean
  purchase_approval_documents_received?: boolean
  purchase_approval_determination?: string
  approved_by?: string
}

// ViewSupplierModal Component
interface ViewSupplierModalProps {
  supplier: Supplier
  onClose: () => void
}

const ViewSupplierModal: React.FC<ViewSupplierModalProps> = ({ supplier, onClose }) => {
  const [activeTab, setActiveTab] = useState('basic')

  const tabs = [
    { id: 'basic', label: 'Basic Information', icon: Building2 },
    { id: 'address', label: 'Address Information', icon: MapPin },
    { id: 'payment', label: 'Payment Terms', icon: CreditCard },
    { id: 'materials', label: 'Materials & GFSI', icon: Truck },
    { id: 'representatives', label: 'Representatives', icon: User },
    { id: 'approval', label: 'Purchase Approval', icon: CheckCircle2 }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-dark/20 via-black/60 to-primary-medium/20 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative z-10 w-full max-w-[95vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[98vh] sm:max-h-[95vh] bg-white rounded-lg sm:rounded-xl lg:rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden flex flex-col transform animate-scale-in">
        {/* Enhanced Header */}
        <div className="relative bg-gradient-to-r from-primary-dark via-primary-medium to-primary-light px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-dark/90 to-primary-medium/90"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-white/20 rounded-md sm:rounded-lg lg:rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                <Building2 className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-lg lg:text-xl font-bold text-white truncate">{supplier.name || 'Supplier Details'}</h2>
                <p className="text-primary-light/90 text-xs font-medium mt-0.5 hidden sm:block">Complete supplier information</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 sm:p-2 lg:p-3 text-white/80 hover:text-white hover:bg-white/20 rounded-md sm:rounded-lg lg:rounded-xl transition-all duration-300 backdrop-blur-sm flex-shrink-0"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
            </button>
          </div>
        </div>

        {/* Advanced Tab Navigation */}
        <div className="bg-gradient-to-r from-neutral-light via-white to-neutral-light border-b border-neutral-soft/40">
          <div className="flex overflow-x-auto scrollbar-hide px-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center space-x-1 sm:space-x-2 px-1.5 sm:px-3 lg:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 border-b-2 min-w-max flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'text-primary-dark border-primary-medium bg-gradient-to-t from-primary-light/10 to-transparent'
                      : 'text-neutral-medium border-transparent hover:text-primary-dark hover:bg-primary-light/5'
                  }`}
                >
                  <Icon className={`h-3 w-3 sm:h-4 sm:w-4 transition-all duration-300 ${
                    activeTab === tab.id ? 'text-primary-medium' : 'text-neutral-medium'
                  }`} />
                  <span className="hidden sm:inline text-xs sm:text-sm">{tab.label}</span>
                  <span className="sm:hidden text-xs">{tab.label.split(' ')[0]}</span>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-medium to-primary-light"></div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Enhanced Tab Content */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-neutral-light/30 via-white to-neutral-soft/20">
          {activeTab === 'basic' && (
            <div className="p-2 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-6 animate-slide-in">
              {/* Company Overview Card */}
              <div className="bg-white rounded-lg shadow-lg border border-neutral-soft/30 overflow-hidden">
                <div className="bg-gradient-to-r from-primary-dark/5 to-primary-medium/5 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 border-b border-neutral-soft/20">
                  <h3 className="text-sm sm:text-base lg:text-lg font-bold text-primary-dark flex items-center">
                    <Building2 className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 mr-1.5 sm:mr-2 lg:mr-3 text-primary-medium" />
                    Company Overview
                  </h3>
                </div>
                <div className="p-2 sm:p-3 lg:p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                    <div className="space-y-3 sm:space-y-4">
                      <div className="group">
                        <div className="flex items-center mb-1 sm:mb-2">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-medium rounded-full mr-2 sm:mr-3"></div>
                          <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider">Company Name</label>
                        </div>
                        <div className="text-sm sm:text-lg lg:text-xl font-bold text-neutral-dark bg-gradient-to-r from-primary-dark to-primary-medium bg-clip-text text-transparent">
                          {supplier.name || 'Not specified'}
                        </div>
                      </div>
                      
                      <div className="group">
                        <div className="flex items-center mb-1 sm:mb-2">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-light rounded-full mr-2 sm:mr-3"></div>
                          <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider">DBA</label>
                        </div>
                        <div className="text-sm sm:text-base lg:text-lg font-semibold text-neutral-dark">
                          {supplier.dba || 'Same as company name'}
                        </div>
                      </div>

                      <div className="group">
                        <div className="flex items-center mb-1 sm:mb-2">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-accent-success rounded-full mr-2 sm:mr-3"></div>
                          <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider">Contact Person</label>
                        </div>
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-primary-light to-primary-medium rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-white" />
                          </div>
                          <div className="text-sm sm:text-base lg:text-lg font-semibold text-neutral-dark min-w-0">
                            {supplier.contact || 'Not specified'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 sm:space-y-4">
                      <div className="group">
                        <div className="flex items-center mb-1 sm:mb-2">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-medium rounded-full mr-2 sm:mr-3"></div>
                          <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider">Email Address</label>
                        </div>
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-accent-success to-primary-medium rounded-full flex items-center justify-center flex-shrink-0">
                            <Mail className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-white" />
                          </div>
                          <div className="text-sm sm:text-base lg:text-lg font-medium text-primary-dark hover:text-primary-medium transition-colors cursor-pointer min-w-0 break-all">
                            {supplier.email || 'Not provided'}
                          </div>
                        </div>
                      </div>

                      <div className="group">
                        <div className="flex items-center mb-1 sm:mb-2">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-accent-warning rounded-full mr-2 sm:mr-3"></div>
                          <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider">Phone Number</label>
                        </div>
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-accent-warning to-primary-light rounded-full flex items-center justify-center flex-shrink-0">
                            <Phone className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-white" />
                          </div>
                          <div className="text-sm sm:text-base lg:text-lg font-medium text-neutral-dark min-w-0">
                            {supplier.phone || 'Not provided'}
                          </div>
                        </div>
                      </div>

                      <div className="group">
                        <div className="flex items-center mb-1 sm:mb-2">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-light rounded-full mr-2 sm:mr-3"></div>
                          <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider">Website</label>
                        </div>
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-primary-light to-primary-dark rounded-full flex items-center justify-center flex-shrink-0">
                            <Globe className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-white" />
                          </div>
                          <div className="text-sm sm:text-base lg:text-lg font-medium text-primary-dark hover:text-primary-medium transition-colors cursor-pointer min-w-0 break-all">
                            {supplier.website || 'Not provided'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'address' && (
            <div className="p-8 space-y-8 animate-slide-in">
              {/* Address Information Card */}
              <div className="bg-white rounded-2xl shadow-lg border border-neutral-soft/30 overflow-hidden">
                <div className="bg-gradient-to-r from-primary-light/10 to-primary-medium/10 px-6 py-4 border-b border-neutral-soft/20">
                  <h3 className="text-lg font-bold text-primary-dark flex items-center">
                    <MapPin className="h-5 w-5 mr-3 text-primary-medium" />
                    Location & Address Details
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Physical Address */}
                    <div className="group">
                      <div className="bg-gradient-to-br from-primary-light/5 to-primary-medium/5 rounded-2xl p-6 border border-primary-light/20 hover:shadow-lg transition-all duration-300">
                        <div className="flex items-center mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary-medium to-primary-dark rounded-2xl flex items-center justify-center mr-4">
                            <MapPin className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-primary-dark">Physical Address</h4>
                            <p className="text-sm text-neutral-medium">Primary business location</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                          <div className="text-neutral-dark font-medium leading-relaxed">
                            {supplier.physical_address || supplier.address || (
                              <span className="text-neutral-medium italic">No physical address provided</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mailing Address */}
                    <div className="group">
                      <div className="bg-gradient-to-br from-accent-success/5 to-primary-light/5 rounded-2xl p-6 border border-accent-success/20 hover:shadow-lg transition-all duration-300">
                        <div className="flex items-center mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-accent-success to-primary-medium rounded-2xl flex items-center justify-center mr-4">
                            <Mail className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-primary-dark">Mailing Address</h4>
                            <p className="text-sm text-neutral-medium">Correspondence address</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                          <div className="text-neutral-dark font-medium leading-relaxed">
                            {supplier.mailing_address || (
                              <span className="text-neutral-medium italic">Same as physical address</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="p-8 space-y-8 animate-slide-in">
              {/* Payment Terms Overview */}
              <div className="bg-white rounded-2xl shadow-lg border border-neutral-soft/30 overflow-hidden">
                <div className="bg-gradient-to-r from-accent-success/10 to-primary-medium/10 px-6 py-4 border-b border-neutral-soft/20">
                  <h3 className="text-lg font-bold text-primary-dark flex items-center">
                    <CreditCard className="h-5 w-5 mr-3 text-primary-medium" />
                    Payment Terms & Conditions
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* General Terms */}
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-primary-light/5 to-primary-medium/5 rounded-2xl p-6 border border-primary-light/20">
                        <div className="flex items-center mb-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-medium to-primary-dark rounded-xl flex items-center justify-center mr-3">
                            <CreditCard className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-primary-dark">General Terms</h4>
                            <p className="text-sm text-neutral-medium">Standard payment conditions</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                          <div className="text-lg font-semibold text-neutral-dark">
                            {supplier.payment_terms || 'Standard terms apply'}
                          </div>
                        </div>
                      </div>

                      {/* NET Terms */}
                      <div className="bg-gradient-to-br from-accent-success/5 to-primary-light/5 rounded-2xl p-6 border border-accent-success/20">
                        <div className="flex items-center mb-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-accent-success to-primary-medium rounded-xl flex items-center justify-center mr-3">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-primary-dark">NET Terms</h4>
                            <p className="text-sm text-neutral-medium">Payment due periods</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {supplier.payment_terms_net30 && (
                            <div className="bg-accent-success/10 text-accent-success px-4 py-2 rounded-full font-semibold border border-accent-success/20">
                              NET 30 Days
                            </div>
                          )}
                          {supplier.payment_terms_net60 && (
                            <div className="bg-accent-warning/10 text-accent-warning px-4 py-2 rounded-full font-semibold border border-accent-warning/20">
                              NET 60 Days
                            </div>
                          )}
                          {supplier.payment_terms_net90 && (
                            <div className="bg-primary-medium/10 text-primary-medium px-4 py-2 rounded-full font-semibold border border-primary-medium/20">
                              NET 90 Days
                            </div>
                          )}
                          {!supplier.payment_terms_net30 && !supplier.payment_terms_net60 && !supplier.payment_terms_net90 && (
                            <div className="bg-neutral-soft/50 text-neutral-medium px-4 py-2 rounded-full font-medium">
                              No specific NET terms
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Discount Information */}
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-accent-warning/5 to-primary-light/5 rounded-2xl p-6 border border-accent-warning/20">
                        <div className="flex items-center mb-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-accent-warning to-primary-medium rounded-xl flex items-center justify-center mr-3">
                            <Percent className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-primary-dark">Early Payment Discount</h4>
                            <p className="text-sm text-neutral-medium">Incentives for prompt payment</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white rounded-xl p-4 border border-neutral-soft/30 text-center">
                            <div className="text-2xl font-bold text-accent-warning mb-1">
                              {supplier.payment_terms_discount_percent ? `${supplier.payment_terms_discount_percent}%` : '0%'}
                            </div>
                            <div className="text-sm text-neutral-medium font-medium">Discount Rate</div>
                          </div>
                          <div className="bg-white rounded-xl p-4 border border-neutral-soft/30 text-center">
                            <div className="text-2xl font-bold text-primary-medium mb-1">
                              {supplier.payment_terms_discount_days || '0'}
                            </div>
                            <div className="text-sm text-neutral-medium font-medium">Days to Pay</div>
                          </div>
                        </div>
                      </div>

                      {/* Payment Status Indicator */}
                      <div className="bg-gradient-to-br from-primary-dark/5 to-primary-medium/5 rounded-2xl p-6 border border-primary-medium/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-bold text-primary-dark">Payment Status</h4>
                            <p className="text-sm text-neutral-medium">Current standing</p>
                          </div>
                          <div className="w-12 h-12 bg-gradient-to-br from-accent-success to-primary-medium rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        <div className="mt-4 bg-accent-success/10 text-accent-success px-4 py-2 rounded-xl font-semibold text-center border border-accent-success/20">
                          Active & In Good Standing
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="p-8 space-y-8 animate-slide-in">
              {/* Materials Supplied */}
              <div className="bg-white rounded-2xl shadow-lg border border-neutral-soft/30 overflow-hidden">
                <div className="bg-gradient-to-r from-primary-medium/10 to-accent-success/10 px-6 py-4 border-b border-neutral-soft/20">
                  <h3 className="text-lg font-bold text-primary-dark flex items-center">
                    <Truck className="h-5 w-5 mr-3 text-primary-medium" />
                    Materials & Certification
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Materials Supplied */}
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-primary-medium/5 to-accent-success/5 rounded-2xl p-6 border border-primary-medium/20">
                        <div className="flex items-center mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary-medium to-accent-success rounded-2xl flex items-center justify-center mr-4">
                            <Truck className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-primary-dark">Materials Supplied</h4>
                            <p className="text-sm text-neutral-medium">Products and services offered</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-neutral-soft/30 min-h-[120px]">
                          <div className="text-neutral-dark font-medium leading-relaxed">
                            {supplier.materials_supplied || (
                              <span className="text-neutral-medium italic">No materials specified</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* GFSI Certification */}
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-accent-success/5 to-primary-light/5 rounded-2xl p-6 border border-accent-success/20">
                        <div className="flex items-center mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-accent-success to-primary-medium rounded-2xl flex items-center justify-center mr-4">
                            <CheckCircle2 className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-primary-dark">GFSI Certification</h4>
                            <p className="text-sm text-neutral-medium">Food safety standards compliance</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {/* Certification Status */}
                          <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-bold text-neutral-medium uppercase tracking-wider mb-1">Certification Status</div>
                                <div className="text-lg font-bold text-neutral-dark">
                                  {supplier.gfsi_certification_held ? 'Certified' : 'Not Certified'}
                                </div>
                              </div>
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                supplier.gfsi_certification_held 
                                  ? 'bg-gradient-to-br from-accent-success to-primary-medium' 
                                  : 'bg-gradient-to-br from-neutral-medium to-neutral-dark'
                              }`}>
                                <CheckCircle2 className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          </div>

                          {/* Certification Name */}
                          <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                            <div className="text-sm font-bold text-neutral-medium uppercase tracking-wider mb-2">Certification Type</div>
                            <div className="text-lg font-semibold text-neutral-dark">
                              {supplier.gfsi_cert_name || 'No specific certification'}
                            </div>
                            {supplier.gfsi_cert_name && (
                              <div className="mt-2 bg-accent-success/10 text-accent-success px-3 py-1 rounded-full text-sm font-medium inline-block border border-accent-success/20">
                                Active Certification
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'representatives' && (
            <div className="p-8 space-y-8 animate-slide-in">
              <div className="bg-white rounded-2xl shadow-lg border border-neutral-soft/30 overflow-hidden">
                <div className="bg-gradient-to-r from-primary-dark/10 to-primary-medium/10 px-6 py-4 border-b border-neutral-soft/20">
                  <h3 className="text-lg font-bold text-primary-dark flex items-center">
                    <User className="h-5 w-5 mr-3 text-primary-medium" />
                    Representatives & Contacts
                  </h3>
                </div>

                <div className="p-6 space-y-6">
                  {/* Account Representative */}
                  <div className="bg-gradient-to-br from-primary-light/5 to-primary-medium/5 rounded-2xl p-6 border border-primary-light/20 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-gradient-to-br from-primary-medium to-primary-dark rounded-2xl flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-primary-dark">Account Representative</div>
                          <div className="text-sm text-neutral-medium">Primary commercial contact</div>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full text-xs font-semibold border bg-primary-light/10 text-primary-dark border-primary-light/20">
                        Account
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Name</div>
                        <div className="text-neutral-dark font-semibold">{supplier.account_rep_name || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Email</div>
                        <div className="text-primary-dark font-medium break-words">{supplier.account_rep_email || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Office Phone</div>
                        <div className="text-neutral-dark font-medium">{supplier.account_rep_office_phone || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Cell Phone</div>
                        <div className="text-neutral-dark font-medium">{supplier.account_rep_cell_phone || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Accounts Payable Representative */}
                  <div className="bg-gradient-to-br from-accent-warning/5 to-primary-light/5 rounded-2xl p-6 border border-accent-warning/20 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-gradient-to-br from-accent-warning to-primary-medium rounded-2xl flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-primary-dark">Accounts Payable Representative</div>
                          <div className="text-sm text-neutral-medium">Billing and payments contact</div>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full text-xs font-semibold border bg-accent-warning/10 text-accent-warning border-accent-warning/20">
                        AP
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Name</div>
                        <div className="text-neutral-dark font-semibold">{supplier.ap_rep_name || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Email</div>
                        <div className="text-primary-dark font-medium break-words">{supplier.ap_rep_email || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Office Phone</div>
                        <div className="text-neutral-dark font-medium">{supplier.ap_rep_office_phone || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Cell Phone</div>
                        <div className="text-neutral-dark font-medium">{supplier.ap_rep_cell_phone || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Quality Assurance Representative */}
                  <div className="bg-gradient-to-br from-accent-success/5 to-primary-light/5 rounded-2xl p-6 border border-accent-success/20 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-gradient-to-br from-accent-success to-primary-medium rounded-2xl flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-primary-dark">Quality Assurance Representative</div>
                          <div className="text-sm text-neutral-medium">Quality & compliance contact</div>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full text-xs font-semibold border bg-accent-success/10 text-accent-success border-accent-success/20">
                        QA
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Name</div>
                        <div className="text-neutral-dark font-semibold">{supplier.qa_rep_name || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Email</div>
                        <div className="text-primary-dark font-medium break-words">{supplier.qa_rep_email || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Office Phone</div>
                        <div className="text-neutral-dark font-medium">{supplier.qa_rep_office_phone || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Cell Phone</div>
                        <div className="text-neutral-dark font-medium">{supplier.qa_rep_cell_phone || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="bg-gradient-to-br from-red-500/5 to-primary-light/5 rounded-2xl p-6 border border-red-500/20 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-gradient-to-br from-red-600 to-primary-medium rounded-2xl flex items-center justify-center">
                          <Phone className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-primary-dark">Emergency Contact</div>
                          <div className="text-sm text-neutral-medium">Urgent escalation contact</div>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
                        Emergency
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Name</div>
                        <div className="text-neutral-dark font-semibold">{supplier.emergency_contact_name || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Email</div>
                        <div className="text-primary-dark font-medium break-words">{supplier.emergency_contact_email || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Office Phone</div>
                        <div className="text-neutral-dark font-medium">{supplier.emergency_contact_office_phone || '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-neutral-soft/30">
                        <div className="text-xs font-bold text-neutral-medium uppercase tracking-wider mb-2">Cell Phone</div>
                        <div className="text-neutral-dark font-medium">{supplier.emergency_contact_cell_phone || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'approval' && (
            <div className="bg-gray-50 rounded-xl p-6 space-y-6">
              <h3 className="text-lg font-semibold text-neutral-dark mb-4">Purchase Approval</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">APPROVAL REQUIRED</div>
                  <div className="text-neutral-dark">{supplier.purchase_approval_required ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">DOCUMENTS RECEIVED</div>
                  <div className="text-neutral-dark">{supplier.purchase_approval_documents_received ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">DETERMINATION</div>
                  <div className="text-neutral-dark">{supplier.purchase_approval_determination || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">APPROVED BY</div>
                  <div className="text-neutral-dark">{supplier.approved_by || '—'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 bg-neutral-light/20 border-t border-neutral-soft/30">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const Suppliers: React.FC = () => {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const isSalesRepViewOnly = String(currentUserRole || '').toLowerCase() === 'sales_representative'

  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<any[]>([])
  const [packaging, setPackaging] = useState<any[]>([])
  const [loadingInventory, setLoadingInventory] = useState<boolean>(false)
  const [showIngredientsList, setShowIngredientsList] = useState<boolean>(false)
  const [showPackagingList, setShowPackagingList] = useState<boolean>(false)
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
    dba: '',
    physical_address: '',
    mailing_address: '',
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
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })

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
  const [addForm, setAddForm] = useState({
    company_name: '',
    category: 'Raw Materials',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    payment_terms: '',
    materials_supplied: '',
    dba: '',
    physical_address: '',
    mailing_address: '',
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
    selected_ingredients: [] as string[],
    selected_packaging: [] as string[],
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
      dba: r.dba ? String(r.dba) : '',
      physical_address: r.physical_address ? String(r.physical_address) : '',
      mailing_address: r.mailing_address ? String(r.mailing_address) : '',
      payment_terms_net30: Boolean(r.payment_terms_net30),
      payment_terms_net60: Boolean(r.payment_terms_net60),
      payment_terms_net90: Boolean(r.payment_terms_net90),
      payment_terms_discount_percent: typeof r.payment_terms_discount_percent === 'number' ? r.payment_terms_discount_percent : undefined,
      payment_terms_discount_days: typeof r.payment_terms_discount_days === 'number' ? r.payment_terms_discount_days : undefined,
      account_rep_name: r.account_rep_name ? String(r.account_rep_name) : '',
      account_rep_email: r.account_rep_email ? String(r.account_rep_email) : '',
      account_rep_office_phone: r.account_rep_office_phone ? String(r.account_rep_office_phone) : '',
      account_rep_cell_phone: r.account_rep_cell_phone ? String(r.account_rep_cell_phone) : '',
      gfsi_certification_held: Boolean(r.gfsi_certification_held),
      gfsi_cert_name: r.gfsi_cert_name ? String(r.gfsi_cert_name) : '',
      ap_rep_name: r.ap_rep_name ? String(r.ap_rep_name) : '',
      ap_rep_email: r.ap_rep_email ? String(r.ap_rep_email) : '',
      ap_rep_office_phone: r.ap_rep_office_phone ? String(r.ap_rep_office_phone) : '',
      ap_rep_cell_phone: r.ap_rep_cell_phone ? String(r.ap_rep_cell_phone) : '',
      qa_rep_name: r.qa_rep_name ? String(r.qa_rep_name) : '',
      qa_rep_email: r.qa_rep_email ? String(r.qa_rep_email) : '',
      qa_rep_office_phone: r.qa_rep_office_phone ? String(r.qa_rep_office_phone) : '',
      qa_rep_cell_phone: r.qa_rep_cell_phone ? String(r.qa_rep_cell_phone) : '',
      emergency_contact_name: r.emergency_contact_name ? String(r.emergency_contact_name) : '',
      emergency_contact_email: r.emergency_contact_email ? String(r.emergency_contact_email) : '',
      emergency_contact_office_phone: r.emergency_contact_office_phone ? String(r.emergency_contact_office_phone) : '',
      emergency_contact_cell_phone: r.emergency_contact_cell_phone ? String(r.emergency_contact_cell_phone) : '',
      purchase_approval_required: Boolean(r.purchase_approval_required),
      purchase_approval_documents_received: Boolean(r.purchase_approval_documents_received),
      purchase_approval_determination: r.purchase_approval_determination ? String(r.purchase_approval_determination) : '',
      approved_by: r.approved_by ? String(r.approved_by) : '',
    }))
    setSuppliers(mapped)
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ show: false, message: '' }), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast.show])

  useEffect(() => {
    const loadInventoryData = async () => {
      if (!supabase) return
      setLoadingInventory(true)
      
      try {
        // Load ingredients (raw materials)
        const { data: rawMaterials, error: rawError } = await supabase
          .from('inventory_materials')
          .select('id, product_name, category')
          .order('product_name', { ascending: true })
        
        if (rawError) {
          console.error('Failed to load ingredients:', rawError)
        } else {
          setIngredients(rawMaterials || [])
        }
        
        // For packaging, we'll use the same table but filter by category
        // or you can modify this to use a different table if packaging is stored separately
        const { data: packagingMaterials, error: packagingError } = await supabase
          .from('inventory_materials')
          .select('id, product_name, category')
          .eq('category', 'Packaging')
          .order('product_name', { ascending: true })
        
        if (packagingError) {
          console.error('Failed to load packaging:', packagingError)
        } else {
          setPackaging(packagingMaterials || [])
        }
      } catch (error) {
        console.error('Error loading inventory data:', error)
      } finally {
        setLoadingInventory(false)
      }
    }
    
    loadInventoryData()
  }, [])

  const handleIngredientToggle = (ingredientId: string) => {
    setAddForm(prev => ({

      ...prev,
      selected_ingredients: prev.selected_ingredients.includes(ingredientId)
        ? prev.selected_ingredients.filter(id => id !== ingredientId)
        : [...prev.selected_ingredients, ingredientId]
    }))
  }

  const handlePackagingToggle = (packagingId: string) => {
    setAddForm(prev => ({
      ...prev,
      selected_packaging: prev.selected_packaging.includes(packagingId)
        ? prev.selected_packaging.filter(id => id !== packagingId)
        : [...prev.selected_packaging, packagingId]
    }))
  }

  const handleNavigateToInventory = () => {
    setIsAddOpen(false)
    navigate('/admin/inventory')
  }

  const handleView = (s: Supplier) => {
    setViewData(s)
    setIsViewOpen(true)
  }

  const handleEdit = (s: Supplier) => {
    if (isSalesRepViewOnly) return
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
      dba: s.dba || '',
      physical_address: s.physical_address || '',
      mailing_address: s.mailing_address || '',
      payment_terms_net30: s.payment_terms_net30 || false,
      payment_terms_net60: s.payment_terms_net60 || false,
      payment_terms_net90: s.payment_terms_net90 || false,
      payment_terms_discount_percent: s.payment_terms_discount_percent?.toString() || '',
      payment_terms_discount_days: s.payment_terms_discount_days?.toString() || '',
      account_rep_name: s.account_rep_name || '',
      account_rep_email: s.account_rep_email || '',
      account_rep_office_phone: s.account_rep_office_phone || '',
      account_rep_cell_phone: s.account_rep_cell_phone || '',
      gfsi_certification_held: s.gfsi_certification_held || false,
      gfsi_cert_name: s.gfsi_cert_name || '',
      ap_rep_name: s.ap_rep_name || '',
      ap_rep_email: s.ap_rep_email || '',
      ap_rep_office_phone: s.ap_rep_office_phone || '',
      ap_rep_cell_phone: s.ap_rep_cell_phone || '',
      qa_rep_name: s.qa_rep_name || '',
      qa_rep_email: s.qa_rep_email || '',
      qa_rep_office_phone: s.qa_rep_office_phone || '',
      qa_rep_cell_phone: s.qa_rep_cell_phone || '',
      emergency_contact_name: s.emergency_contact_name || '',
      emergency_contact_email: s.emergency_contact_email || '',
      emergency_contact_office_phone: s.emergency_contact_office_phone || '',
      emergency_contact_cell_phone: s.emergency_contact_cell_phone || '',
      purchase_approval_required: s.purchase_approval_required || false,
      purchase_approval_documents_received: s.purchase_approval_documents_received || false,
      purchase_approval_determination: s.purchase_approval_determination || '',
      approved_by: s.approved_by || '',
    })
    setIsEditOpen(true)
  }

  const handleDelete = (s: Supplier) => {
    if (isSalesRepViewOnly) return
    setDeleteTarget(s)
    setIsDeleteOpen(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-2 sm:p-4 lg:p-6 max-w-full">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-dark mb-1">Suppliers</h1>
            </div>
            {!isSalesRepViewOnly && (
              <button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center">
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                Add Supplier
              </button>
            )}
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
            <div className="relative z-10 w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-primary-dark via-primary-medium to-primary-light px-8 py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <Truck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Supplier Registration</h2>
                      <p className="text-white/90 text-sm mt-1">Complete supplier profile and business information</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => !isSubmitting && setIsAddOpen(false)}
                    className="p-3 text-white/90 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200 hover:shadow-sm"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {addError && (
                <div className="mx-8 mt-6 p-4 rounded-xl border border-accent-danger/30 bg-accent-danger/10 text-accent-danger">
                  {addError}
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (isSubmitting) return
                    setIsSubmitting(true)
                    setAddError(null)
                    try {
                      // Map to your suppliers table columns
                      const payload: any = {
                        company_name: addForm.company_name,
                        contact_person: addForm.contact_person || null,
                        email: addForm.email || null,
                        phone: addForm.phone || null,
                        website: addForm.website || null,
                        payment_terms: addForm.payment_terms || null,
                        address: addForm.physical_address || null,
                        materials_supplied: addForm.materials_supplied || null,
                        category: addForm.category,
                        dba: addForm.dba || null,
                        physical_address: addForm.physical_address || null,
                        mailing_address: addForm.mailing_address || null,
                        payment_terms_net30: addForm.payment_terms_net30,
                        payment_terms_net60: addForm.payment_terms_net60,
                        payment_terms_net90: addForm.payment_terms_net90,
                        payment_terms_discount_percent: addForm.payment_terms_discount_percent ? parseFloat(addForm.payment_terms_discount_percent) : null,
                        payment_terms_discount_days: addForm.payment_terms_discount_days ? parseInt(addForm.payment_terms_discount_days) : null,
                        account_rep_name: addForm.account_rep_name || null,
                        account_rep_email: addForm.account_rep_email || null,
                        account_rep_office_phone: addForm.account_rep_office_phone || null,
                        account_rep_cell_phone: addForm.account_rep_cell_phone || null,
                        gfsi_certification_held: addForm.gfsi_certification_held,
                        gfsi_cert_name: addForm.gfsi_cert_name || null,
                        ap_rep_name: addForm.ap_rep_name || null,
                        ap_rep_email: addForm.ap_rep_email || null,
                        ap_rep_office_phone: addForm.ap_rep_office_phone || null,
                        ap_rep_cell_phone: addForm.ap_rep_cell_phone || null,
                        qa_rep_name: addForm.qa_rep_name || null,
                        qa_rep_email: addForm.qa_rep_email || null,
                        qa_rep_office_phone: addForm.qa_rep_office_phone || null,
                        qa_rep_cell_phone: addForm.qa_rep_cell_phone || null,
                        emergency_contact_name: addForm.emergency_contact_name || null,
                        emergency_contact_email: addForm.emergency_contact_email || null,
                        emergency_contact_office_phone: addForm.emergency_contact_office_phone || null,
                        emergency_contact_cell_phone: addForm.emergency_contact_cell_phone || null,
                        purchase_approval_required: addForm.purchase_approval_required,
                        purchase_approval_documents_received: addForm.purchase_approval_documents_received,
                        purchase_approval_determination: addForm.purchase_approval_determination || null,
                        approved_by: addForm.approved_by || null,
                        status: 'Active',
                        rating: 0,
                      }
                      const { error } = await supabase.from('suppliers').insert(payload)
                      if (error) throw error
                      await refresh()
                      setIsAddOpen(false)
                      setAddForm({
                        company_name: '',
                        category: 'Raw Materials',
                        contact_person: '',
                        email: '',
                        phone: '',
                        website: '',
                        payment_terms: '',
                        materials_supplied: '',
                        dba: '',
                        physical_address: '',
                        mailing_address: '',
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
                        selected_ingredients: [],
                        selected_packaging: [],
                      })
                      setToast({ show: true, message: 'Supplier added successfully' })
                    } catch (err: any) {
                      setAddError(err?.message || 'Failed to submit registration')
                      console.error('Failed to add supplier', err?.message || err, err)
                    } finally {
                      setIsSubmitting(false)
                    }
                  }}
                  className="p-8 space-y-8"
                >
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
                            value={addForm.company_name}
                            onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })}
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
                            value={addForm.dba}
                            onChange={(e) => setAddForm({ ...addForm, dba: e.target.value })}
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
                            value={addForm.contact_person}
                            onChange={(e) => setAddForm({ ...addForm, contact_person: e.target.value })}
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
                            value={addForm.email}
                            onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
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
                            value={addForm.phone}
                            onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
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
                            value={addForm.website}
                            onChange={(e) => setAddForm({ ...addForm, website: e.target.value })}
                            placeholder="https://supplier.com"
                            className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

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
                          value={addForm.physical_address}
                          onChange={(e) => setAddForm({ ...addForm, physical_address: e.target.value })}
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
                          value={addForm.mailing_address}
                          onChange={(e) => setAddForm({ ...addForm, mailing_address: e.target.value })}
                          placeholder="Leave blank if same as physical address"
                          rows={3}
                          className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                        />
                      </div>
                    </div>
                  </div>

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
                          value={addForm.materials_supplied}
                          onChange={(e) => setAddForm({ ...addForm, materials_supplied: e.target.value })}
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
                            value={addForm.category}
                            onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
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
                              checked={addForm.gfsi_certification_held}
                              onChange={(e) => setAddForm({ ...addForm, gfsi_certification_held: e.target.checked })}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">GFSI Certification Held</span>
                          </label>
                        </div>
                      </div>

                      {addForm.gfsi_certification_held && (
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-semibold text-neutral-dark">
                            <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" />
                            GFSI Certification Name
                          </label>
                          <input
                            type="text"
                            value={addForm.gfsi_cert_name}
                            onChange={(e) => setAddForm({ ...addForm, gfsi_cert_name: e.target.value })}
                            placeholder="e.g., SQF, BRC, FSSC 22000"
                            className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-dark">Ingredients</label>
                        <div className="space-y-3">
                          <div>
                            <button
                              type="button"
                              onClick={() => setShowIngredientsList((v) => !v)}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-neutral-soft bg-white text-neutral-dark hover:bg-neutral-light/30 transition-all text-sm font-semibold"
                            >
                              {showIngredientsList ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                              {showIngredientsList ? 'Hide Ingredients' : 'Add Ingredients'}
                            </button>
                          </div>

                          {showIngredientsList && (
                            <div className="border border-neutral-soft rounded-lg p-3 bg-white space-y-3">
                              <div className="max-h-40 overflow-y-auto">
                                {loadingInventory ? (
                                  <div className="text-sm text-neutral-medium">Loading ingredients...</div>
                                ) : ingredients.length === 0 ? (
                                  <div className="text-sm text-neutral-medium">No ingredients found</div>
                                ) : (
                                  <div className="space-y-2">
                                    {ingredients.map((ingredient) => (
                                      <label key={ingredient.id} className="flex items-center space-x-2 cursor-pointer hover:bg-neutral-light/20 p-1 rounded">
                                        <input
                                          type="checkbox"
                                          checked={addForm.selected_ingredients.includes(ingredient.id)}
                                          onChange={() => handleIngredientToggle(ingredient.id)}
                                          className="h-4 w-4 text-primary-medium focus:ring-primary-light border-neutral-soft rounded"
                                        />
                                        <span className="text-sm text-neutral-dark">{ingredient.product_name}</span>
                                        {ingredient.category && (
                                          <span className="text-xs text-neutral-medium bg-neutral-light/40 px-2 py-0.5 rounded">
                                            {ingredient.category}
                                          </span>
                                        )}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={handleNavigateToInventory}
                                className="inline-flex items-center gap-2 text-sm text-primary-medium hover:text-primary-dark transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                                <span>Add New Ingredient</span>
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-dark">Packaging</label>
                        <div className="space-y-3">
                          <div>
                            <button
                              type="button"
                              onClick={() => setShowPackagingList((v) => !v)}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-neutral-soft bg-white text-neutral-dark hover:bg-neutral-light/30 transition-all text-sm font-semibold"
                            >
                              {showPackagingList ? <Minus className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                              {showPackagingList ? 'Hide Packaging' : 'Add Packaging'}
                            </button>
                          </div>

                          {showPackagingList && (
                            <div className="border border-neutral-soft rounded-lg p-3 bg-white space-y-3">
                              <div className="max-h-40 overflow-y-auto">
                                {loadingInventory ? (
                                  <div className="text-sm text-neutral-medium">Loading packaging...</div>
                                ) : packaging.length === 0 ? (
                                  <div className="text-sm text-neutral-medium">No packaging found</div>
                                ) : (
                                  <div className="space-y-2">
                                    {packaging.map((pack) => (
                                      <label key={pack.id} className="flex items-center space-x-2 cursor-pointer hover:bg-neutral-light/20 p-1 rounded">
                                        <input
                                          type="checkbox"
                                          checked={addForm.selected_packaging.includes(pack.id)}
                                          onChange={() => handlePackagingToggle(pack.id)}
                                          className="h-4 w-4 text-primary-medium focus:ring-primary-light border-neutral-soft rounded"
                                        />
                                        <span className="text-sm text-neutral-dark">{pack.product_name}</span>
                                        {pack.category && (
                                          <span className="text-xs text-neutral-medium bg-neutral-light/40 px-2 py-0.5 rounded">
                                            {pack.category}
                                          </span>
                                        )}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={handleNavigateToInventory}
                                className="inline-flex items-center gap-2 text-sm text-primary-medium hover:text-primary-dark transition-colors"
                              >
                                <Package className="h-4 w-4" />
                                <span>Add New Packaging</span>
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

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
                          value={addForm.payment_terms}
                          onChange={(e) => setAddForm({ ...addForm, payment_terms: e.target.value })}
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
                              checked={addForm.payment_terms_net30}
                              onChange={(e) => setAddForm({ ...addForm, payment_terms_net30: e.target.checked })}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">NET 30 Days</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={addForm.payment_terms_net60}
                              onChange={(e) => setAddForm({ ...addForm, payment_terms_net60: e.target.checked })}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">NET 60 Days</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={addForm.payment_terms_net90}
                              onChange={(e) => setAddForm({ ...addForm, payment_terms_net90: e.target.checked })}
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
                            value={addForm.payment_terms_discount_percent}
                            onChange={(e) => setAddForm({ ...addForm, payment_terms_discount_percent: e.target.value })}
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
                            value={addForm.payment_terms_discount_days}
                            onChange={(e) => setAddForm({ ...addForm, payment_terms_discount_days: e.target.value })}
                            placeholder="e.g., 10"
                            className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                      <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                        <User className="h-5 w-5 mr-2 text-primary-medium" />
                        Representatives & Contacts
                      </h3>
                    </div>
                    <div className="p-6 space-y-8">
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider">Account Representative</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input type="text" value={addForm.account_rep_name} onChange={(e) => setAddForm({ ...addForm, account_rep_name: e.target.value })} placeholder="Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="email" value={addForm.account_rep_email} onChange={(e) => setAddForm({ ...addForm, account_rep_email: e.target.value })} placeholder="Email" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="text" value={addForm.account_rep_office_phone} onChange={(e) => setAddForm({ ...addForm, account_rep_office_phone: e.target.value })} placeholder="Office Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="text" value={addForm.account_rep_cell_phone} onChange={(e) => setAddForm({ ...addForm, account_rep_cell_phone: e.target.value })} placeholder="Cell Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider">Accounts Payable Representative</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input type="text" value={addForm.ap_rep_name} onChange={(e) => setAddForm({ ...addForm, ap_rep_name: e.target.value })} placeholder="Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="email" value={addForm.ap_rep_email} onChange={(e) => setAddForm({ ...addForm, ap_rep_email: e.target.value })} placeholder="Email" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="text" value={addForm.ap_rep_office_phone} onChange={(e) => setAddForm({ ...addForm, ap_rep_office_phone: e.target.value })} placeholder="Office Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="text" value={addForm.ap_rep_cell_phone} onChange={(e) => setAddForm({ ...addForm, ap_rep_cell_phone: e.target.value })} placeholder="Cell Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider">Quality Assurance Representative</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input type="text" value={addForm.qa_rep_name} onChange={(e) => setAddForm({ ...addForm, qa_rep_name: e.target.value })} placeholder="Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="email" value={addForm.qa_rep_email} onChange={(e) => setAddForm({ ...addForm, qa_rep_email: e.target.value })} placeholder="Email" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="text" value={addForm.qa_rep_office_phone} onChange={(e) => setAddForm({ ...addForm, qa_rep_office_phone: e.target.value })} placeholder="Office Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="text" value={addForm.qa_rep_cell_phone} onChange={(e) => setAddForm({ ...addForm, qa_rep_cell_phone: e.target.value })} placeholder="Cell Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-red-700 uppercase tracking-wider">Emergency Contact</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input type="text" value={addForm.emergency_contact_name} onChange={(e) => setAddForm({ ...addForm, emergency_contact_name: e.target.value })} placeholder="Name" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="email" value={addForm.emergency_contact_email} onChange={(e) => setAddForm({ ...addForm, emergency_contact_email: e.target.value })} placeholder="Email" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="text" value={addForm.emergency_contact_office_phone} onChange={(e) => setAddForm({ ...addForm, emergency_contact_office_phone: e.target.value })} placeholder="Office Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                          <input type="text" value={addForm.emergency_contact_cell_phone} onChange={(e) => setAddForm({ ...addForm, emergency_contact_cell_phone: e.target.value })} placeholder="Cell Phone" className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" />
                        </div>
                      </div>
                    </div>
                  </div>

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
                            checked={addForm.purchase_approval_required}
                            onChange={(e) => setAddForm({ ...addForm, purchase_approval_required: e.target.checked })}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Purchase Approval Required</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={addForm.purchase_approval_documents_received}
                            onChange={(e) => setAddForm({ ...addForm, purchase_approval_documents_received: e.target.checked })}
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
                            value={addForm.purchase_approval_determination}
                            onChange={(e) => setAddForm({ ...addForm, purchase_approval_determination: e.target.value })}
                            placeholder="Approval determination"
                            className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-neutral-dark">Approved By</label>
                          <input
                            type="text"
                            value={addForm.approved_by}
                            onChange={(e) => setAddForm({ ...addForm, approved_by: e.target.value })}
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
                      onClick={() => !isSubmitting && setIsAddOpen(false)}
                      className="px-6 py-3 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !addForm.company_name}
                      className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Registration'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}


        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
            <div className="flex-1">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-2">Search Suppliers</label>
              <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-neutral-medium" />
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium text-sm sm:text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="lg:w-64">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 text-primary-medium" />
                Filter & Sort
              </label>
              <button className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border border-neutral-soft rounded-xl text-left bg-white transition-all shadow-sm hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:shadow-md text-sm sm:text-base">
                <span className="text-neutral-medium">All Categories</span>
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-medium" />
              </button>
            </div>
          </div>
        </div>

        {/* Table or Empty State */}
        {filteredSuppliers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-neutral-dark mb-1">Supplier Directory</h3>
                <div className="px-3 py-1.5 bg-primary-light/10 rounded-xl border border-primary-light/20">
                  <span className="text-xs sm:text-sm font-semibold text-primary-dark">0 Total</span>
                </div>
              </div>
            </div>
            <div className="p-8 sm:p-12 lg:p-16 text-center">
              <div className="mx-auto w-14 h-14 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
                <Truck className="h-7 w-7 text-primary-medium" />
              </div>
              <p className="text-neutral-medium mb-1">No suppliers found</p>
              <p className="text-sm text-neutral-medium">Add suppliers to manage your raw material sourcing.</p>
              {!isSalesRepViewOnly && (
                <button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md flex items-center mx-auto"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Supplier
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md border border-neutral-soft/30 overflow-hidden">
            {/* Gradient header section */}
            <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-neutral-dark mb-1">Supplier Directory</h3>
              </div>
            </div>
            {/* Column headers */}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                    <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary-medium" />
                        <span>Supplier</span>
                      </div>
                    </th>
                    <th className="hidden sm:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Contact</th>
                    <th className="hidden md:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Email</th>
                    <th className="hidden lg:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Phone</th>
                    <th className="hidden xl:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Website</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-soft/20">
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm">
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-neutral-light/60 rounded-lg flex items-center justify-center shadow-sm">
                            <Truck className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-primary-dark" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-semibold text-neutral-dark truncate">{supplier.name || '—'}</div>
                            <div className="sm:hidden text-xs text-neutral-medium truncate">{supplier.contact || supplier.email || '—'}</div>
                            {supplier.website && <div className="hidden sm:block text-xs text-neutral-medium truncate">{supplier.website}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <div className="text-xs sm:text-sm font-medium text-neutral-dark">{supplier.contact || '—'}</div>
                      </td>
                      <td className="hidden md:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        {supplier.email ? (
                          <a href={`mailto:${supplier.email}`} className="text-xs sm:text-sm text-primary-medium hover:underline truncate">{supplier.email}</a>
                        ) : (
                          <span className="text-xs sm:text-sm text-neutral-medium">—</span>
                        )}
                      </td>
                      <td className="hidden lg:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <div className="text-xs sm:text-sm text-neutral-dark">{supplier.phone || '—'}</div>
                      </td>
                      <td className="hidden xl:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        {supplier.website ? (
                          <a href={supplier.website} target="_blank" rel="noreferrer" className="text-xs sm:text-sm text-primary-medium hover:underline truncate inline-block max-w-[220px]">{supplier.website}</a>
                        ) : (
                          <span className="text-xs sm:text-sm text-neutral-medium">—</span>
                        )}
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <div className="flex items-center justify-center space-x-1">
                          <button type="button" onClick={() => handleView(supplier)} className="group/btn p-1.5 sm:p-2 text-primary-medium hover:text-white hover:bg-primary-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium">
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                          {!isSalesRepViewOnly && (
                            <button type="button" onClick={() => handleEdit(supplier)} className="group/btn p-1.5 sm:p-2 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft hover:border-neutral-medium">
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                          )}
                          {!isSalesRepViewOnly && (
                            <button type="button" onClick={() => handleDelete(supplier)} className="group/btn p-1.5 sm:p-2 text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 border border-red-200 hover:border-red-600">
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
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

        {/* View Supplier Modal */}
        {isViewOpen && viewData && (
          <ViewSupplierModal 
            supplier={viewData} 
            onClose={() => setIsViewOpen(false)} 
          />
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
                        dba: editForm.dba || null,
                        physical_address: editForm.physical_address || null,
                        mailing_address: editForm.mailing_address || null,
                        payment_terms_net30: editForm.payment_terms_net30,
                        payment_terms_net60: editForm.payment_terms_net60,
                        payment_terms_net90: editForm.payment_terms_net90,
                        payment_terms_discount_percent: editForm.payment_terms_discount_percent ? parseFloat(editForm.payment_terms_discount_percent) : null,
                        payment_terms_discount_days: editForm.payment_terms_discount_days ? parseInt(editForm.payment_terms_discount_days) : null,
                        account_rep_name: editForm.account_rep_name || null,
                        account_rep_email: editForm.account_rep_email || null,
                        account_rep_office_phone: editForm.account_rep_office_phone || null,
                        account_rep_cell_phone: editForm.account_rep_cell_phone || null,
                        gfsi_certification_held: editForm.gfsi_certification_held,
                        gfsi_cert_name: editForm.gfsi_cert_name || null,
                        ap_rep_name: editForm.ap_rep_name || null,
                        ap_rep_email: editForm.ap_rep_email || null,
                        ap_rep_office_phone: editForm.ap_rep_office_phone || null,
                        ap_rep_cell_phone: editForm.ap_rep_cell_phone || null,
                        qa_rep_name: editForm.qa_rep_name || null,
                        qa_rep_email: editForm.qa_rep_email || null,
                        qa_rep_office_phone: editForm.qa_rep_office_phone || null,
                        qa_rep_cell_phone: editForm.qa_rep_cell_phone || null,
                        emergency_contact_name: editForm.emergency_contact_name || null,
                        emergency_contact_email: editForm.emergency_contact_email || null,
                        emergency_contact_office_phone: editForm.emergency_contact_office_phone || null,
                        emergency_contact_cell_phone: editForm.emergency_contact_cell_phone || null,
                        purchase_approval_required: editForm.purchase_approval_required,
                        purchase_approval_documents_received: editForm.purchase_approval_documents_received,
                        purchase_approval_determination: editForm.purchase_approval_determination || null,
                        approved_by: editForm.approved_by || null,
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
                  <div className="bg-white rounded-2xl border border-neutral-soft/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-neutral-light/60 to-neutral-light/20 border-b border-neutral-soft/30">
                      <div className="text-sm font-semibold text-neutral-dark">Supplier Contact Form</div>
                      <div className="text-xs text-neutral-medium mt-1">Online form layout (paper-style alignment)</div>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Company Name<span className="text-red-500 ml-1">*</span></label>
                        <input
                          type="text"
                          required
                          value={editForm.company_name}
                          onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">DBA</label>
                        <input
                          type="text"
                          value={editForm.dba}
                          onChange={(e) => setEditForm({ ...editForm, dba: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Contact Person</label>
                        <input
                          type="text"
                          value={editForm.contact_person}
                          onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Email</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Phone</label>
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Website</label>
                        <input
                          type="url"
                          value={editForm.website}
                          onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Payment Terms</label>
                        <select
                          value={editForm.payment_terms}
                          onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        >
                          <option value="">Select Payment Terms</option>
                          <option>50% Deposits 50% Upon Completion </option>
                          <option>100% Upfront</option>
                          <option>Net 15</option>
                          <option>Net 30</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-start">
                        <label className="text-sm font-semibold text-neutral-dark pt-2">Address</label>
                        <textarea
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="w-full min-h-[70px] px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-start">
                        <label className="text-sm font-semibold text-neutral-dark pt-2">Physical Address</label>
                        <textarea
                          value={editForm.physical_address}
                          onChange={(e) => setEditForm({ ...editForm, physical_address: e.target.value })}
                          className="w-full min-h-[70px] px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-start">
                        <label className="text-sm font-semibold text-neutral-dark pt-2">Mailing Address (if different)</label>
                        <textarea
                          value={editForm.mailing_address}
                          onChange={(e) => setEditForm({ ...editForm, mailing_address: e.target.value })}
                          className="w-full min-h-[70px] px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-soft/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-neutral-light/40 to-neutral-light/10 border-b border-neutral-soft/30">
                      <div className="text-sm font-semibold text-neutral-dark">Additional Details</div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-start">
                        <label className="text-sm font-semibold text-neutral-dark pt-2">Materials Supplied</label>
                        <textarea
                          value={editForm.materials_supplied}
                          onChange={(e) => setEditForm({ ...editForm, materials_supplied: e.target.value })}
                          className="w-full min-h-[90px] px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-soft/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-neutral-light/40 to-neutral-light/10 border-b border-neutral-soft/30">
                      <div className="text-sm font-semibold text-neutral-dark">Payment Terms Details</div>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-start">
                        <label className="text-sm font-semibold text-neutral-dark pt-2">NET Terms</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-neutral-soft bg-white">
                            <input
                              type="checkbox"
                              checked={editForm.payment_terms_net30}
                              onChange={(e) => setEditForm({ ...editForm, payment_terms_net30: e.target.checked })}
                              className="h-4 w-4 text-primary-medium focus:ring-primary-light border-neutral-soft rounded"
                            />
                            <span className="text-sm font-semibold text-neutral-dark">NET30</span>
                          </label>
                          <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-neutral-soft bg-white">
                            <input
                              type="checkbox"
                              checked={editForm.payment_terms_net60}
                              onChange={(e) => setEditForm({ ...editForm, payment_terms_net60: e.target.checked })}
                              className="h-4 w-4 text-primary-medium focus:ring-primary-light border-neutral-soft rounded"
                            />
                            <span className="text-sm font-semibold text-neutral-dark">NET60</span>
                          </label>
                          <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-neutral-soft bg-white">
                            <input
                              type="checkbox"
                              checked={editForm.payment_terms_net90}
                              onChange={(e) => setEditForm({ ...editForm, payment_terms_net90: e.target.checked })}
                              className="h-4 w-4 text-primary-medium focus:ring-primary-light border-neutral-soft rounded"
                            />
                            <span className="text-sm font-semibold text-neutral-dark">NET90</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Discount for Early Payment</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.payment_terms_discount_percent}
                              onChange={(e) => setEditForm({ ...editForm, payment_terms_discount_percent: e.target.value })}
                              className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                            />
                            <span className="text-sm font-semibold text-neutral-medium">%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={editForm.payment_terms_discount_days}
                              onChange={(e) => setEditForm({ ...editForm, payment_terms_discount_days: e.target.value })}
                              className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                            />
                            <span className="text-sm font-semibold text-neutral-medium">Days</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-soft/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-primary-light/10 to-primary-medium/10 border-b border-neutral-soft/30">
                      <div className="text-sm font-semibold text-neutral-dark">Account Representative</div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Name</label>
                        <input
                          type="text"
                          value={editForm.account_rep_name}
                          onChange={(e) => setEditForm({ ...editForm, account_rep_name: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Email</label>
                        <input
                          type="email"
                          value={editForm.account_rep_email}
                          onChange={(e) => setEditForm({ ...editForm, account_rep_email: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Office Phone</label>
                        <input
                          type="text"
                          value={editForm.account_rep_office_phone}
                          onChange={(e) => setEditForm({ ...editForm, account_rep_office_phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Cell Phone</label>
                        <input
                          type="text"
                          value={editForm.account_rep_cell_phone}
                          onChange={(e) => setEditForm({ ...editForm, account_rep_cell_phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-soft/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-accent-success/10 to-primary-light/10 border-b border-neutral-soft/30">
                      <div className="text-sm font-semibold text-neutral-dark">GFSI Certification</div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">GFSI Certification Held</label>
                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editForm.gfsi_certification_held}
                              onChange={(e) => setEditForm({ ...editForm, gfsi_certification_held: e.target.checked })}
                              className="h-4 w-4 text-accent-success focus:ring-accent-success/30 border-neutral-soft rounded"
                            />
                            <span className="text-sm font-semibold text-neutral-dark">Yes</span>
                          </label>
                          <span className="text-xs text-neutral-medium">Uncheck if No</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Certification Name</label>
                        <input
                          type="text"
                          value={editForm.gfsi_cert_name}
                          onChange={(e) => setEditForm({ ...editForm, gfsi_cert_name: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark disabled:bg-neutral-light/40"
                          disabled={!editForm.gfsi_certification_held}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-soft/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-neutral-light/50 to-neutral-light/10 border-b border-neutral-soft/30">
                      <div className="text-sm font-semibold text-neutral-dark">Accounts Payable Representative</div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Name</label>
                        <input
                          type="text"
                          value={editForm.ap_rep_name}
                          onChange={(e) => setEditForm({ ...editForm, ap_rep_name: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Email</label>
                        <input
                          type="email"
                          value={editForm.ap_rep_email}
                          onChange={(e) => setEditForm({ ...editForm, ap_rep_email: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Office Phone</label>
                        <input
                          type="text"
                          value={editForm.ap_rep_office_phone}
                          onChange={(e) => setEditForm({ ...editForm, ap_rep_office_phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Cell Phone</label>
                        <input
                          type="text"
                          value={editForm.ap_rep_cell_phone}
                          onChange={(e) => setEditForm({ ...editForm, ap_rep_cell_phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-soft/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-accent-warning/10 to-primary-light/10 border-b border-neutral-soft/30">
                      <div className="text-sm font-semibold text-neutral-dark">Quality Assurance Representative</div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Name</label>
                        <input
                          type="text"
                          value={editForm.qa_rep_name}
                          onChange={(e) => setEditForm({ ...editForm, qa_rep_name: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Email</label>
                        <input
                          type="email"
                          value={editForm.qa_rep_email}
                          onChange={(e) => setEditForm({ ...editForm, qa_rep_email: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Office Phone</label>
                        <input
                          type="text"
                          value={editForm.qa_rep_office_phone}
                          onChange={(e) => setEditForm({ ...editForm, qa_rep_office_phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Cell Phone</label>
                        <input
                          type="text"
                          value={editForm.qa_rep_cell_phone}
                          onChange={(e) => setEditForm({ ...editForm, qa_rep_cell_phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-soft/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-red-500/10 to-neutral-light/10 border-b border-neutral-soft/30">
                      <div className="text-sm font-semibold text-neutral-dark">Emergency Contact</div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Name</label>
                        <input
                          type="text"
                          value={editForm.emergency_contact_name}
                          onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Email</label>
                        <input
                          type="email"
                          value={editForm.emergency_contact_email}
                          onChange={(e) => setEditForm({ ...editForm, emergency_contact_email: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Office Phone</label>
                        <input
                          type="text"
                          value={editForm.emergency_contact_office_phone}
                          onChange={(e) => setEditForm({ ...editForm, emergency_contact_office_phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Cell Phone</label>
                        <input
                          type="text"
                          value={editForm.emergency_contact_cell_phone}
                          onChange={(e) => setEditForm({ ...editForm, emergency_contact_cell_phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-neutral-soft/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/10 to-primary-medium/10 border-b border-neutral-soft/30">
                      <div className="text-sm font-semibold text-neutral-dark">Purchase Approval</div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-start">
                        <label className="text-sm font-semibold text-neutral-dark pt-1">Approval Requirement</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editForm.purchase_approval_required}
                              onChange={(e) => setEditForm({ ...editForm, purchase_approval_required: e.target.checked })}
                              className="h-4 w-4 text-primary-dark focus:ring-primary-light border-neutral-soft rounded"
                            />
                            <span className="text-sm font-semibold text-neutral-dark">Purchase Approval Required</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editForm.purchase_approval_documents_received}
                              onChange={(e) => setEditForm({ ...editForm, purchase_approval_documents_received: e.target.checked })}
                              className="h-4 w-4 text-primary-dark focus:ring-primary-light border-neutral-soft rounded"
                            />
                            <span className="text-sm font-semibold text-neutral-dark">Documents Received</span>
                          </label>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Determination</label>
                        <select
                          value={editForm.purchase_approval_determination}
                          onChange={(e) => setEditForm({ ...editForm, purchase_approval_determination: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        >
                          <option value="">Select Determination</option>
                          <option value="APPROVED">APPROVED</option>
                          <option value="APPROVED WITH CONTINGENCIES">APPROVED WITH CONTINGENCIES</option>
                          <option value="NOT APPROVED">NOT APPROVED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
                        <label className="text-sm font-semibold text-neutral-dark">Approved By</label>
                        <input
                          type="text"
                          value={editForm.approved_by}
                          onChange={(e) => setEditForm({ ...editForm, approved_by: e.target.value })}
                          className="w-full px-4 py-2.5 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark"
                        />
                      </div>
                    </div>
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
                    className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:opacity-90 shadow-md disabled:opacity-60"
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
