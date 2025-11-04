import React, { useState } from 'react'
import { Search, Filter, CheckCircle, Eye, Download, Archive, Package, DollarSign, TrendingUp } from 'lucide-react'

interface CompletedOrder {
  id: number
  orderNumber: string
  customer: string
  product: string
  quantity: number
  completedDate: string
  deliveryDate: string
  total: number
  status: string
}

const CompletedOrders: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [completedOrders] = useState<CompletedOrder[]>([])

  const filteredOrders = completedOrders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.product.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0)
  const totalQuantity = completedOrders.reduce((sum, order) => sum + order.quantity, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-2">Completed Orders</h1>
              <p className="text-neutral-medium text-lg">View and manage your completed orders</p>
            </div>
            <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center">
              <Download className="h-5 w-5 mr-3" />
              Export Report
            </button>
          </div>
        </div>

        {/* Enhanced Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-accent-success/20 to-accent-success/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <CheckCircle className="h-7 w-7 text-accent-success" />
              </div>
              <div className="w-2 h-2 bg-accent-success rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Total Completed</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">{completedOrders.length}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-accent-success to-accent-success/40 rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Orders</span>
              </div>
            </div>
          </div>
          
          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-light/30 to-primary-light/15 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <DollarSign className="h-7 w-7 text-primary-medium" />
              </div>
              <div className="w-2 h-2 bg-primary-medium rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Total Revenue</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">${totalRevenue.toFixed(2)}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-primary-medium to-primary-light rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Revenue</span>
              </div>
            </div>
          </div>
          
          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-dark/20 to-primary-dark/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <Package className="h-7 w-7 text-primary-dark" />
              </div>
              <div className="w-2 h-2 bg-primary-dark rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Units Produced</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">{totalQuantity}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-primary-dark to-primary-medium rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Units</span>
              </div>
            </div>
          </div>
          
          <div className="group bg-gradient-to-br from-white to-neutral-light/30 rounded-2xl shadow-lg border border-neutral-soft/30 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-accent-warning/25 to-accent-warning/10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                <TrendingUp className="h-7 w-7 text-accent-warning" />
              </div>
              <div className="w-2 h-2 bg-accent-warning rounded-full opacity-60"></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-medium uppercase tracking-wider mb-2">Avg Order Value</p>
              <p className="text-3xl font-bold text-neutral-dark mb-1">${(completedOrders.length ? (totalRevenue / completedOrders.length) : 0).toFixed(2)}</p>
              <div className="flex items-center">
                <div className="w-8 h-1 bg-gradient-to-r from-accent-warning to-accent-warning/40 rounded-full"></div>
                <span className="text-xs text-neutral-medium ml-2">Average</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">
                Search Completed Orders
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-medium" />
                <input
                  type="text"
                  placeholder="Search completed orders..."
                  className="w-full pl-12 pr-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="md:w-64">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">
                <Filter className="h-5 w-5 mr-3 text-primary-medium" />
                Filter & Sort
              </label>
              <button className="w-full px-4 py-4 border border-neutral-soft rounded-xl text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all shadow-sm hover:shadow-md flex items-center justify-between">
                <span className="text-neutral-medium">All</span>
                <Filter className="h-5 w-5 text-neutral-medium" />
              </button>
            </div>
          </div>
        </div>

        {/* Table or Empty State */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="px-10 py-8 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-dark mb-2">Completed Orders</h3>
                <div className="px-4 py-2 bg-primary-light/10 rounded-xl border border-primary-light/20">
                  <span className="text-sm font-semibold text-primary-dark">0 Total</span>
                </div>
              </div>
            </div>
            <div className="p-16 text-center">
              <p className="text-neutral-medium mb-1">No completed orders found</p>
              <p className="text-sm text-neutral-medium">Orders will appear here when completed.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
            {/* Gradient header section */}
            <div className="px-10 py-8 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-dark mb-2">Completed Orders</h3>
                <div className="px-4 py-2 bg-primary-light/10 rounded-xl border border-primary-light/20">
                  <span className="text-sm font-semibold text-primary-dark">{filteredOrders.length} Total</span>
                </div>
              </div>
            </div>
            {/* Column headers */}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Order #</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Customer</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Product</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Qty</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Completed</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Delivery</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Total</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Status</th>
                    <th className="px-8 py-6 text-center text-sm font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-soft/20">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm">
                      <td className="px-8 py-6">
                        <div className="text-sm font-semibold text-neutral-dark">{order.orderNumber}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-neutral-dark">{order.customer}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-neutral-dark">{order.product}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-neutral-dark">{order.quantity}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-neutral-dark">{order.completedDate}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-neutral-dark">{order.deliveryDate}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-neutral-dark">${order.total.toFixed(2)}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-light/50 text-neutral-dark border border-neutral-soft/30">{order.status}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center space-x-2">
                          <button className="group/btn p-3 text-primary-medium hover:text-white hover:bg-primary-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium">
                            <Eye className="h-5 w-5" />
                          </button>
                          <button className="group/btn p-3 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft hover:border-neutral-medium">
                            <Download className="h-5 w-5" />
                          </button>
                          <button className="group/btn p-3 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft hover:border-neutral-medium">
                            <Archive className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompletedOrders
