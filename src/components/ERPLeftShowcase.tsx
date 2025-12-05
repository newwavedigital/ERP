import React from 'react'
import { BarChart3, Package, ShoppingCart, AlertTriangle, TrendingUp, Clock } from 'lucide-react'

const ERPLeftShowcase: React.FC = () => {
  return (
    <div className="relative w-full h-full p-8 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-dark/5 via-transparent to-primary-medium/10"></div>
      
      {/* Floating ERP Dashboard Cards */}
      
      {/* Inventory Health Card - Top Left */}
      <div className="absolute top-12 left-8 w-72 bg-white rounded-2xl shadow-lg p-6 transform rotate-[-2deg] hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-success/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-accent-success" />
            </div>
            <span className="text-sm font-medium text-neutral-medium">Inventory Health</span>
          </div>
        </div>
        <div className="mb-3">
          <h3 className="text-2xl font-bold text-neutral-dark">12,430</h3>
          <p className="text-sm text-neutral-medium">Stock On-Hand Units</p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-medium">Available</span>
            <span className="text-accent-success font-medium">85%</span>
          </div>
          <div className="w-full bg-neutral-soft rounded-full h-2">
            <div className="bg-accent-success h-2 rounded-full w-[85%]"></div>
          </div>
        </div>
      </div>

      {/* Production Order Card - Center */}
      <div className="absolute top-32 left-32 w-80 bg-white rounded-2xl shadow-lg p-6 transform rotate-[1deg] hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-medium/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-medium" />
            </div>
            <span className="text-sm font-medium text-neutral-medium">Production Order</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-accent-success bg-accent-success/10 px-2 py-1 rounded-full">
            <div className="w-2 h-2 bg-accent-success rounded-full animate-pulse"></div>
            Running
          </div>
        </div>
        <div className="mb-3">
          <h3 className="text-xl font-bold text-neutral-dark">Batch #1057</h3>
          <p className="text-sm text-neutral-medium">Secret Din Production</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-accent-warning" />
          <span className="text-neutral-medium">Expected Finish:</span>
          <span className="font-medium text-accent-warning">3:15 PM</span>
        </div>
      </div>

      {/* PO Overview Card - Right Side */}
      <div className="absolute top-20 right-12 w-64 bg-white rounded-2xl shadow-lg p-6 transform rotate-[3deg] hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-light/10 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-light" />
            </div>
            <span className="text-sm font-medium text-neutral-medium">Purchase Order</span>
          </div>
          <div className="text-xs text-accent-success bg-accent-success/10 px-2 py-1 rounded-full font-medium">
            Approved
          </div>
        </div>
        <div className="mb-3">
          <h3 className="text-lg font-bold text-neutral-dark">PO-4421</h3>
          <p className="text-sm text-neutral-medium">ABC Foods Inc.</p>
        </div>
        <div className="text-right">
          <h4 className="text-2xl font-bold text-primary-medium">$52,900</h4>
          <p className="text-xs text-neutral-medium">Total Amount</p>
        </div>
      </div>

      {/* Low Stock Warning Card - Bottom */}
      <div className="absolute bottom-16 left-16 w-72 bg-white rounded-2xl shadow-lg p-6 transform rotate-[-1deg] hover:rotate-0 transition-transform duration-300 border-l-4 border-accent-warning">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-warning/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-accent-warning" />
            </div>
            <span className="text-sm font-medium text-neutral-medium">Low Stock Alert</span>
          </div>
        </div>
        <div className="mb-3">
          <h3 className="text-lg font-bold text-accent-warning">Carton Box</h3>
          <p className="text-sm text-neutral-medium">Only 45 units remaining</p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-danger" />
          <span className="text-xs text-accent-danger font-medium">Reorder Required</span>
        </div>
      </div>

      {/* Revenue Card - Bottom Right */}
      <div className="absolute bottom-24 right-20 w-60 bg-white rounded-2xl shadow-lg p-6 transform rotate-[2deg] hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-success/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent-success" />
            </div>
            <span className="text-sm font-medium text-neutral-medium">Monthly Revenue</span>
          </div>
        </div>
        <div className="mb-2">
          <h3 className="text-2xl font-bold text-neutral-dark">₱2.4M</h3>
          <div className="flex items-center gap-1">
            <span className="text-xs text-accent-success">↗ 12.5%</span>
            <span className="text-xs text-neutral-medium">from last month</span>
          </div>
        </div>
      </div>

      {/* Floating Decorative Elements */}
      <div className="absolute top-1/4 right-1/4 w-20 h-20 bg-primary-light/5 rounded-full blur-xl"></div>
      <div className="absolute bottom-1/3 left-1/3 w-32 h-32 bg-primary-medium/5 rounded-full blur-2xl"></div>
    </div>
  )
}

export default ERPLeftShowcase
