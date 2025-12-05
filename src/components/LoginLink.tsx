import React from 'react'
import { LogOut } from 'lucide-react'

const LoginLink: React.FC = () => {
  const handleLoginRedirect = () => {
    window.location.hash = '/login'
  }

  return (
    <button
      onClick={handleLoginRedirect}
      className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-medium hover:text-primary-medium transition-colors"
    >
      <LogOut className="w-4 h-4" />
      View Login Page
    </button>
  )
}

export default LoginLink
