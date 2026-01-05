import React from 'react'
import { Package, AlertTriangle, Truck, LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

interface MetricItem {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  color: string
  iconBg: string
}

const Dashboard: React.FC = () => {
  const metrics: MetricItem[] = [
    {
      title: 'Active Purchase Orders',
      value: '0',
      subtitle: 'Open customer orders',
      icon: Package,
      color: 'bg-neutral-light text-primary-dark',
      iconBg: 'bg-primary-dark/10'
    },
    {
      title: 'Materials to Order',
      value: '0',
      subtitle: 'Low stock materials',
      icon: AlertTriangle,
      color: 'bg-neutral-light text-accent-warning',
      iconBg: 'bg-accent-warning/10'
    },
    {
      title: 'Orders to Invoice',
      value: '0',
      subtitle: 'Orders needing invoicing',
      icon: Package,
      color: 'bg-neutral-light text-primary-medium',
      iconBg: 'bg-primary-medium/10'
    },
    {
      title: 'Orders to Ship',
      value: '0',
      subtitle: 'Orders ready for shipment',
      icon: Truck,
      color: 'bg-neutral-light text-accent-success',
      iconBg: 'bg-accent-success/10'
    }
  ]

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-3 lg:mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-neutral-dark">Dashboard</h1>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 lg:mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-neutral-soft p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-medium mb-1">{metric.title}</p>
                  <p className="text-3xl font-bold text-neutral-dark mb-1">{metric.value}</p>
                  <p className="text-sm text-neutral-medium">{metric.subtitle}</p>
                </div>
                <div className={`p-3 rounded-lg ${metric.iconBg}`}>
                  <Icon className={`h-6 w-6 ${metric.color.split(' ')[1]}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Upcoming Production Section */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-soft">
        <div className="p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col items-center justify-center py-6 sm:py-8 lg:py-12">
            <div className="w-16 h-16 bg-neutral-light rounded-full flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-neutral-medium" />
            </div>
            <p className="text-neutral-medium text-center mb-4">No upcoming production scheduled</p>
            <Link
              to="/production-schedule"
              className="text-primary-dark hover:text-primary-medium text-sm font-medium transition-colors duration-200"
            >
              Create Production Schedule
            </Link>
          </div>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mt-4 lg:mt-6">
        <div className="bg-white rounded-lg shadow-sm border border-neutral-soft p-3 sm:p-4 lg:p-6">
          <h3 className="text-lg font-semibold text-neutral-dark mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-accent-success rounded-full mr-3"></div>
              <span className="text-neutral-medium">Order #1234 completed</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-primary-medium rounded-full mr-3"></div>
              <span className="text-neutral-medium">New purchase order created</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-accent-warning rounded-full mr-3"></div>
              <span className="text-neutral-medium">Inventory alert: Low stock</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-neutral-soft p-3 sm:p-4 lg:p-6">
          <h3 className="text-lg font-semibold text-neutral-dark mb-4">Production Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-medium">Today's Production</span>
              <span className="font-medium text-neutral-dark">0 units</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-medium">This Week</span>
              <span className="font-medium text-neutral-dark">45 units</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-medium">This Month</span>
              <span className="font-medium text-neutral-dark">180 units</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-neutral-soft p-3 sm:p-4 lg:p-6">
          <h3 className="text-lg font-semibold text-neutral-dark mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm text-primary-dark hover:bg-neutral-light rounded-md transition-colors duration-200">
              Create New Order
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-primary-dark hover:bg-neutral-light rounded-md transition-colors duration-200">
              Add Inventory
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-primary-dark hover:bg-neutral-light rounded-md transition-colors duration-200">
              Schedule Production
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
