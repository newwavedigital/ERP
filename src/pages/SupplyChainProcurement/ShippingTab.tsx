import React from 'react'
import { Truck } from 'lucide-react'

const ShippingTab: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-6">
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 rounded-full bg-primary-light/20 flex items-center justify-center mb-4">
          <Truck className="h-8 w-8 text-primary-medium" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-dark mb-2">Shipping Management</h3>
        <p className="text-sm text-neutral-medium text-center max-w-md">
          Shipping functionality is coming soon. This will include shipment tracking, carrier management, and logistics coordination.
        </p>
        <div className="mt-6 px-4 py-2 rounded-lg bg-primary-light/10 border border-primary-light/30">
          <span className="text-xs font-medium text-primary-dark">Coming Soon</span>
        </div>
      </div>
    </div>
  )
}

export default ShippingTab
