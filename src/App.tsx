import React from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.tsx'
import Layout from './components/Layout.tsx'
import ApprovalGuard from './components/ApprovalGuard.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Products from './pages/Products.tsx'
import Inventory from './pages/Inventory.tsx'
import Formulas from './pages/Formulas.tsx'
import ProductionSchedule from './pages/ProductionSchedule.tsx'
import PurchaseOrders from './pages/PurchaseOrders.tsx'
import CompletedOrders from './pages/CompletedOrders.tsx'
import ContentLibrary from './pages/ContentLibrary.tsx'
import Customers from './pages/Customers.tsx'
import Suppliers from './pages/Suppliers.tsx'
import TeamChat from './pages/TeamChat.tsx'
import AIInsights from './pages/AIInsights.tsx'
import Login from './pages/Login.tsx'
import LandingPage from './pages/LandingPage.tsx'
import AuthCallback from './pages/AuthCallback.tsx'
import WaitingApproval from './pages/WaitingApproval.tsx'
import Rejected from './pages/Rejected.tsx'
import UserApprovals from './pages/management/UserApprovals.tsx'
import ToolPermissions from './pages/ToolPermissions.tsx'
import CustomerRegistration from './pages/CustomerRegistration.tsx'
import CustomerRegistrationDillys from './pages/CustomerRegistrationDillys.tsx'
import CustomerRegistrationBNutty from './pages/CustomerRegistrationBNutty.tsx'
import SupplierRegistration from './pages/SupplierRegistration.tsx'

const App: React.FC = () => {
  const router = createHashRouter([
    // Public routes (no layout)
    { index: true, element: (
      <ApprovalGuard>
        <LandingPage />
      </ApprovalGuard>
    ) },
    { path: 'landing', element: (
      <ApprovalGuard>
        <LandingPage />
      </ApprovalGuard>
    ) },
    { path: 'auth/callback', element: <AuthCallback /> },
    { path: 'login', element: <Login /> },
    { path: 'waiting-approval', element: <WaitingApproval /> },
    { path: 'rejected', element: <Rejected /> },
    { path: 'customers/registration', element: <CustomerRegistration /> },
    { path: 'customers/registration/dillys', element: <CustomerRegistrationDillys /> },
    { path: 'customers/registration/bnutty', element: <CustomerRegistrationBNutty /> },
    { path: 'suppliers/registration', element: <SupplierRegistration /> },
    // Admin/Dashboard routes (with layout)
    {
      path: 'admin',
      element: (
        <ApprovalGuard>
          <Layout />
        </ApprovalGuard>
      ),
      children: [
        { index: true, element: <Dashboard /> },
        { path: 'dashboard', element: <Dashboard /> },
        { path: 'products', element: <Products /> },
        { path: 'inventory', element: <Inventory /> },
        { path: 'formulas', element: <Formulas /> },
        { path: 'production-schedule', element: <ProductionSchedule /> },
        { path: 'purchase-orders', element: <PurchaseOrders /> },
        { path: 'completed-orders', element: <CompletedOrders /> },
        { path: 'content-library', element: <ContentLibrary /> },
        { path: 'customers', element: <Customers /> },
        { path: 'suppliers', element: <Suppliers /> },
        { path: 'team-chat', element: <TeamChat /> },
        { path: 'ai-insights', element: <AIInsights /> },
        { path: 'tool-permissions', element: <ToolPermissions /> },
        { path: 'management/user-approvals', element: <UserApprovals /> },
      ],
    },
  ], {
    // Opt-in to upcoming v7 relative splat behavior
    future: { v7_relativeSplatPath: true }
  })

  return (
    <AuthProvider>
      <RouterProvider
        router={router}
        // Opt-in to wrapping updates with startTransition (v7 behavior)
        future={{ v7_startTransition: true }}
      />
    </AuthProvider>
  )
}

export default App
