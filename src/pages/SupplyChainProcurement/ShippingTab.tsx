import React from 'react'
import { Truck, Package, Calendar } from 'lucide-react'

interface ShippingTabProps {
  shippingOrders: any[]
  loading: boolean
  canViewProcurement: boolean
  formatStatusLabel: (status?: string | null) => string
  getStatusBadgeClass: (status?: string | null) => string
}

const ShippingTab: React.FC<ShippingTabProps> = ({ 
  shippingOrders, 
  loading, 
  canViewProcurement,
  formatStatusLabel,
  getStatusBadgeClass 
}) => {
  if (!canViewProcurement) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-6">
        <div className="text-sm text-neutral-medium">
          You need appropriate permissions to view shipping orders.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-dark">Shipping Queue</div>
            <div className="text-sm text-neutral-medium">
              Purchase Orders completed from production and ready for shipping processing.
            </div>
          </div>
        </div>
      </div>

      {/* Shipping Orders List */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-soft/40 bg-neutral-light/30 flex items-center justify-between">
          <div className="text-sm font-semibold text-neutral-dark">Completed Orders Ready for Shipping</div>
          <div className="text-xs text-neutral-medium">{shippingOrders.length} PO(s)</div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-neutral-medium">Loading shipping orders...</div>
          ) : shippingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-neutral-light/40 flex items-center justify-center mb-3">
                <Package className="h-6 w-6 text-neutral-medium" />
              </div>
              <div className="text-sm text-neutral-medium text-center">
                No completed orders ready for shipping at this time.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {shippingOrders.map((po: any) => {
                const id = String(po.id ?? '')
                const created = po.created_at ? new Date(po.created_at).toLocaleDateString() : '—'
                const poNumber = String(po.po_number ?? po.number ?? id.slice(0, 8))
                
                return (
                  <div
                    key={id}
                    className="w-full rounded-xl border border-neutral-soft/40 bg-white p-4 hover:bg-neutral-light/10 transition-colors"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-semibold text-neutral-dark">PO #{poNumber}</div>
                          <div className="text-xs text-neutral-medium">Customer: {String(po.customer_name || '—')}</div>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${getStatusBadgeClass(po.status)}`}>
                            {formatStatusLabel(po.status)}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-neutral-medium">
                            <Calendar className="h-3 w-3" />
                            {created}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-soft/40">
                        <div className="text-xs text-neutral-medium">
                          Product: {String(po.product_name || '—')} • Qty: {Number(po.quantity || 0)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <Package className="h-3.5 w-3.5" />
                            Ready to Ship
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShippingTab
