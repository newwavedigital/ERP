import React from 'react'
import { Navigate } from 'react-router-dom'
import Login from '../pages/Login'

interface LoginRouteProps {
  isAuthenticated?: boolean
}

const LoginRoute: React.FC<LoginRouteProps> = ({ isAuthenticated = false }) => {
  // If user is already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // Otherwise, show login page
  return <Login />
}

export default LoginRoute
