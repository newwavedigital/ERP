import React from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout.tsx'
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

const App: React.FC = () => {
  const router = createHashRouter([
    {
      element: <Layout />,
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
      ],
    },
  ], {
    // Opt-in to upcoming v7 relative splat behavior
    future: { v7_relativeSplatPath: true }
  })

  return (
    <RouterProvider
      router={router}
      // Opt-in to wrapping updates with startTransition (v7 behavior)
      future={{ v7_startTransition: true }}
    />
  )
}

export default App
