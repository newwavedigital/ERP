import React from 'react'
import { useNavigate } from 'react-router-dom'
import { XCircle, Package, Mail, Phone, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const Rejected: React.FC = () => {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@erpsystem.com?subject=Account Rejection Appeal'
  }

  const handleBackToLogin = () => {
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light via-white to-accent-danger/5">
      {/* Navigation */}
      <nav className="bg-white border-b border-neutral-soft px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-medium rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-neutral-dark">ERP System</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-neutral-medium hover:text-primary-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="max-w-2xl w-full">
          {/* Status Card */}
          <div className="bg-white rounded-3xl shadow-2xl border border-neutral-soft overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-accent-danger/10 to-accent-danger/5 px-8 py-6 border-b border-neutral-soft">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-accent-danger/20 rounded-full flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-accent-danger" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-neutral-dark">Account Registration Declined</h1>
                  <p className="text-neutral-medium">Your registration has been reviewed and declined</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-24 h-24 bg-accent-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-12 h-12 text-accent-danger" />
                </div>
                <h2 className="text-xl font-semibold text-neutral-dark mb-3">
                  Registration Not Approved
                </h2>
                <p className="text-neutral-medium leading-relaxed">
                  Unfortunately, your registration for ERP System access has been declined by our Management Account team. 
                  This decision may be due to various factors including incomplete information or eligibility requirements.
                </p>
              </div>

              {/* User Info */}
              <div className="bg-neutral-light/50 rounded-2xl p-6 mb-6">
                <h3 className="font-semibold text-neutral-dark mb-4">Registration Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary-medium rounded-full"></div>
                    <span className="text-sm text-neutral-medium">Email:</span>
                    <span className="text-sm font-medium text-neutral-dark">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-accent-danger rounded-full"></div>
                    <span className="text-sm text-neutral-medium">Status:</span>
                    <span className="text-sm font-medium text-accent-danger">Rejected</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-neutral-medium rounded-full"></div>
                    <span className="text-sm text-neutral-medium">Reviewed:</span>
                    <span className="text-sm font-medium text-neutral-dark">
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-primary-light/10 rounded-2xl p-6 mb-8">
                <h3 className="font-semibold text-neutral-dark mb-4 flex items-center gap-2">
                  <div className="w-5 h-5 bg-primary-medium rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">?</span>
                  </div>
                  What can you do next?
                </h3>
                <div className="space-y-3 text-sm text-neutral-medium">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary-medium/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary-medium text-xs font-bold">1</span>
                    </div>
                    <p>Contact our support team to understand the reason for rejection</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary-medium/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary-medium text-xs font-bold">2</span>
                    </div>
                    <p>Provide additional information or documentation if requested</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary-medium/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary-medium text-xs font-bold">3</span>
                    </div>
                    <p>Submit an appeal or reapply with updated information</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleContactSupport}
                  className="flex-1 bg-primary-medium hover:bg-primary-dark text-white px-6 py-3 rounded-full font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Contact Support
                </button>
                <button
                  onClick={handleBackToLogin}
                  className="flex-1 border-2 border-neutral-soft hover:border-primary-medium text-neutral-dark hover:text-primary-medium px-6 py-3 rounded-full font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </div>

              {/* Support Info */}
              <div className="mt-8 pt-6 border-t border-neutral-soft">
                <div className="text-center">
                  <p className="text-sm text-neutral-medium mb-4">
                    Our support team is here to help you understand this decision:
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-neutral-medium">
                      <Mail className="w-4 h-4" />
                      <span>support@erpsystem.com</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-medium">
                      <Phone className="w-4 h-4" />
                      <span>+1 (555) 123-4567</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-medium">
              We appreciate your interest in ERP System. Please don't hesitate to reach out for clarification.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Rejected
