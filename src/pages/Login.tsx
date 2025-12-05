import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ERPLeftShowcase from '../components/ERPLeftShowcase'
import ERPLoginForm from '../components/ERPLoginForm'
import ERPRegisterForm from '../components/ERPRegisterForm'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin'|'signup'>('signin')
  
  useEffect(() => {
    // Listen for email confirmation events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'erp_email_confirmed' && e.newValue) {
        // Email was confirmed in another tab, refresh this page
        window.location.reload()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Clean Professional White Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-light to-neutral-soft"></div>
      
      {/* Subtle Geometric Pattern Overlay */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary-light/10 rounded-full -translate-x-48 -translate-y-48"></div>
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-primary-medium/10 rounded-full translate-x-32"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-primary-light/10 rounded-full translate-y-40"></div>
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-primary-medium/10 rounded-full"></div>
      </div>
      
      {/* Light Grid Pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `
          linear-gradient(rgba(8,131,149,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(8,131,149,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }}></div>
      
      {/* Floating ERP Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Manufacturing Icons */}
        <div className="absolute top-20 left-20 w-16 h-16 bg-primary-light/10 rounded-xl flex items-center justify-center backdrop-blur-sm animate-pulse">
          <div className="w-8 h-8 bg-primary-medium/20 rounded-lg"></div>
        </div>
        <div className="absolute top-40 right-32 w-12 h-12 bg-primary-medium/10 rounded-lg flex items-center justify-center backdrop-blur-sm animate-pulse delay-1000">
          <div className="w-6 h-6 bg-primary-light/20 rounded"></div>
        </div>
        <div className="absolute bottom-32 left-16 w-14 h-14 bg-primary-light/10 rounded-xl flex items-center justify-center backdrop-blur-sm animate-pulse delay-2000">
          <div className="w-7 h-7 bg-primary-medium/20 rounded-lg"></div>
        </div>
        <div className="absolute bottom-20 right-20 w-10 h-10 bg-primary-medium/10 rounded-lg flex items-center justify-center backdrop-blur-sm animate-pulse delay-500">
          <div className="w-5 h-5 bg-primary-light/20 rounded"></div>
        </div>
        
        {/* Subtle Data Flow Lines */}
        <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-medium/20 to-transparent"></div>
        <div className="absolute top-2/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-light/15 to-transparent"></div>
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-primary-medium/10 to-transparent"></div>
        <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-primary-light/10 to-transparent"></div>
      </div>
      
      {/* Back to Landing Page Button */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={() => navigate('/landing')}
          className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-primary-dark hover:text-primary-medium rounded-full shadow-lg border border-neutral-soft/50 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-105"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">Back to Home</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl border border-neutral-soft overflow-hidden">
          <div className="flex min-h-[700px]">
            {/* Left Panel - ERP Dashboard Showcase (55%) */}
            <div className="w-[55%] relative bg-gradient-to-br from-primary-light/10 via-primary-medium/5 to-neutral-light overflow-hidden">
              <ERPLeftShowcase />
            </div>
            
            {/* Right Panel - Login Form (45%) */}
            <div className="w-[45%] bg-white flex items-center justify-center p-12">
              {mode === 'signin' ? (
                <ERPLoginForm onShowSignUp={() => setMode('signup')} />
              ) : (
                <ERPRegisterForm onShowSignIn={() => setMode('signin')} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
