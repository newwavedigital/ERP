import React, { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Package, 
  Warehouse, 
  Calendar, 
  ShoppingCart, 
  CheckCircle, 
  Library, 
  Users, 
  Truck, 
  MessageCircle, 
  Brain,
  LogOut,
  Menu,
  LucideIcon
} from 'lucide-react'
//james
interface NavigationItem {
  name: string
  path: string
  icon: LucideIcon
}

const Layout: React.FC = () => {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const navigationItems: NavigationItem[] = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Products', path: '/products', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: Warehouse },
    { name: 'Production Schedule', path: '/production-schedule', icon: Calendar },
    { name: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
    { name: 'Completed Orders', path: '/completed-orders', icon: CheckCircle },
    { name: 'Content Library', path: '/content-library', icon: Library },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Suppliers', path: '/suppliers', icon: Truck },
    { name: 'Team Chat', path: '/team-chat', icon: MessageCircle },
    { name: 'AI Insights', path: '/ai-insights', icon: Brain },
  ]

  const isActive = (path: string): boolean => {
    return location.pathname === path || (path === '/dashboard' && location.pathname === '/')
  }

  return (
    <div className="flex h-screen bg-neutral-light">
      {/* Sidebar */}
      <div className={`${collapsed ? 'w-16' : 'w-80'} bg-gradient-to-b from-white via-white to-neutral-light shadow-2xl border-r border-neutral-soft/50 transition-all duration-300 ease-in-out relative backdrop-blur-lg`}>
        {/* Header Section */}
        <div className={`p-6 border-b border-neutral-soft/30 ${collapsed ? 'flex flex-col items-center space-y-4' : 'flex items-center justify-between'} bg-gradient-to-r from-white to-neutral-light/50`}>
          {!collapsed && (
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-dark via-primary-medium to-primary-light rounded-2xl flex items-center justify-center shadow-xl ring-2 ring-primary-light/20">
                  <LayoutDashboard className="h-6 w-6 text-white drop-shadow-sm" />
                </div>
                <div className="absolute top-0 right-0 w-4 h-4 bg-accent-success rounded-full border-2 border-white shadow-sm"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary-dark tracking-tight bg-gradient-to-r from-primary-dark to-primary-medium bg-clip-text text-transparent">ERP System</h1>
                <p className="text-sm text-primary-medium font-semibold tracking-wide">Manufacturing ERP</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-dark via-primary-medium to-primary-light rounded-2xl flex items-center justify-center shadow-xl ring-2 ring-primary-light/20">
                <LayoutDashboard className="h-6 w-6 text-white drop-shadow-sm" />
              </div>
              <div className="absolute top-0 right-0 w-4 h-4 bg-accent-success rounded-full border-2 border-white shadow-sm"></div>
            </div>
          )}
          <button
            aria-label="Toggle navigation"
            onClick={() => setCollapsed((v) => !v)}
            className="group inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/80 border border-neutral-soft hover:bg-primary-light/10 hover:border-primary-medium/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Menu className="h-5 w-5 text-primary-medium group-hover:text-primary-dark transition-colors duration-200" />
          </button>
        </div>
        
        {/* Navigation Section */}
        <nav className="mt-6 pb-20">
          <ul className={`space-y-1 ${collapsed ? 'px-2' : 'px-6'}`}>
            {navigationItems.map((item, index) => {
              const Icon = item.icon
              return (
                <li key={item.path} style={{ animationDelay: `${index * 50}ms` }} className="animate-fade-in">
                  <Link
                    to={item.path}
                    className={`group relative flex items-center ${collapsed ? 'justify-center px-0 py-3' : 'px-5 py-3'} text-sm font-semibold rounded-2xl transition-all duration-300 transform hover:scale-[1.02] ${
                      isActive(item.path)
                        ? collapsed
                          ? 'bg-gradient-to-r from-primary-dark via-primary-medium to-primary-light text-white shadow-2xl scale-105 ring-2 ring-primary-light/30'
                          : 'bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/10 text-primary-dark border-l-4 border-primary-medium shadow-lg ring-1 ring-primary-light/20'
                        : 'text-neutral-dark hover:bg-gradient-to-r hover:from-neutral-light hover:to-white hover:text-primary-dark hover:shadow-lg hover:ring-1 hover:ring-neutral-soft'
                    }`}
                  >
                    <div className={`relative ${collapsed ? '' : 'mr-4'}`}>
                      <Icon className={`h-6 w-6 transition-all duration-300 ${
                        isActive(item.path) 
                          ? collapsed 
                            ? 'text-white drop-shadow-sm' 
                            : 'text-primary-medium' 
                          : 'text-neutral-medium group-hover:text-primary-medium group-hover:scale-110'
                      }`} />
                      {isActive(item.path) && !collapsed && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary-light rounded-full shadow-sm animate-pulse"></div>
                      )}
                    </div>
                    {!collapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span className="font-semibold tracking-wide text-base">{item.name}</span>
                        {isActive(item.path) && (
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-primary-medium rounded-full animate-pulse"></div>
                            <div className="w-1 h-1 bg-primary-light rounded-full"></div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Hover effect overlay */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-light/0 to-primary-medium/0 group-hover:from-primary-light/5 group-hover:to-primary-medium/5 transition-all duration-300"></div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Enhanced User Section */}
        <div className={`absolute bottom-0 ${collapsed ? 'w-16' : 'w-80'} p-4 border-t border-neutral-soft/30 bg-gradient-to-r from-white via-neutral-light/50 to-white backdrop-blur-sm`}>
          <div className={`group flex items-center ${collapsed ? 'justify-center' : 'space-x-4'} p-4 rounded-2xl hover:bg-gradient-to-r hover:from-white hover:to-neutral-light hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer`}>
            <div className="flex-shrink-0 relative">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-dark via-primary-medium to-primary-light rounded-2xl flex items-center justify-center shadow-xl ring-2 ring-white">
                <span className="text-white text-sm font-bold drop-shadow-sm">JD</span>
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-accent-success border-3 border-white rounded-full shadow-lg animate-pulse"></div>
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-neutral-dark truncate">Development User</p>
                  <p className="text-sm text-neutral-medium truncate flex items-center">
                    <span className="w-2 h-2 bg-accent-success rounded-full mr-2 animate-pulse"></span>
                    John • Online
                  </p>
                </div>
                <button className="group/btn p-3 text-neutral-medium hover:text-accent-danger hover:bg-accent-danger/10 rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-lg">
                  <LogOut className="h-5 w-5 group-hover/btn:rotate-12 transition-transform duration-300" />
                </button>
              </>
            )}
          </div>
          {/* Removed standalone status dot when collapsed to avoid duplicate indicator */}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}

export default Layout
