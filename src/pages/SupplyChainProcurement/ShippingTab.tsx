import React, { useState } from 'react'
import { Truck, Package, Calendar, Eye, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface ShippingTabProps {
  shippingOrders: any[]
  loading: boolean
  canViewProcurement: boolean
  formatStatusLabel: (status?: string | null) => string
  getStatusBadgeClass: (status?: string | null) => string
  canShipWarehouse: boolean
  canApproveAllocation: boolean
  approvingId: string | null
  onApproveAllocation: (poId: string) => void | Promise<void>
  onReadyToShip: (poId: string) => void | Promise<void>
  onPartialShip: (poId: string) => void | Promise<void>
  onShipOrder: (poId: string) => void | Promise<void>
}

const ShippingTab: React.FC<ShippingTabProps> = ({ 
  shippingOrders, 
  loading, 
  canViewProcurement,
  formatStatusLabel,
  getStatusBadgeClass,
  canShipWarehouse,
  canApproveAllocation,
  approvingId,
  onApproveAllocation,
  onReadyToShip,
  onPartialShip,
  onShipOrder
}) => {
  const formatWordDate = (dateStr?: string | null) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const [asnOpen, setAsnOpen] = useState(false)
  const [asnLoading, setAsnLoading] = useState(false)
  const [asnError, setAsnError] = useState<string | null>(null)
  const [asnRows, setAsnRows] = useState<any[]>([])
  const [asnPoNumber, setAsnPoNumber] = useState<string>('')
  const [asnPoStatus, setAsnPoStatus] = useState<string | null>(null)

  const openAsn = async (poId: string, poNumber: string, poStatus: string) => {
    setAsnOpen(true)
    setAsnPoNumber(poNumber)
    setAsnPoStatus(poStatus)
    setAsnLoading(true)
    setAsnError(null)
    try {
      const { data, error } = await supabase
        .from('asn')
        .select('*')
        .eq('po_id', poId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setAsnRows(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error('Failed to load ASN:', e)
      setAsnRows([])
      setAsnError(e?.message || 'Failed to load ASN')
    } finally {
      setAsnLoading(false)
    }
  }

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
                const created = po.created_at ? formatWordDate(po.created_at) : '—'
                const poNumber = String(po.po_number ?? po.number ?? id.slice(0, 8))
                const st = String(po.status || '').toLowerCase().trim()
                const isAllocated = st === 'allocated'
                const isCompleted = st === 'completed'
                const isReadyToShip = st === 'ready_to_ship' || st === 'ready to ship'
                const isPartial = st === 'partial'
                const isPartiallyShipped = st === 'partially_shipped'
                const isShipped = st === 'shipped' || st === 'submitted'
                const allowPartial = (po as any).allow_partial_ship === true
                const flags = Array.isArray((po as any).flags) ? ((po as any).flags as any[]) : []
                const hasPickPackComplete = flags.some((f) => String(f || '').toLowerCase().trim() === 'pick_pack_complete')
                const readyFlag = (po as any).ready_to_ship === true
                const canShowShipOrder = isReadyToShip && readyFlag && hasPickPackComplete
                const needsAllocationApproval = isCompleted || (isReadyToShip && !readyFlag)
                const showAwaitingPickPack = isReadyToShip && readyFlag && !hasPickPackComplete
                
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
                        <div className="flex items-center gap-2 flex-wrap">
                          {needsAllocationApproval && (
                            <button
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${canApproveAllocation ? 'bg-primary-light hover:bg-primary-medium text-white' : 'bg-neutral-light/40 text-neutral-medium cursor-not-allowed'}`}
                              onClick={() => { if (!canApproveAllocation) return; onApproveAllocation(String(po.id)) }}
                              disabled={!canApproveAllocation || approvingId === id}
                              title={canApproveAllocation ? 'Approve allocation (finished goods first)' : 'Only Procurement/Admin can approve'}
                            >
                              <Package className="h-3.5 w-3.5" /> {approvingId === id ? 'Approving…' : 'Approve'}
                            </button>
                          )}
                          {isAllocated && (
                            <button
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${canShipWarehouse ? 'bg-primary-light hover:bg-primary-medium text-white' : 'bg-neutral-light/40 text-neutral-medium cursor-not-allowed'}`}
                              onClick={() => { if (!canShipWarehouse) return; onReadyToShip(String(po.id)) }}
                              disabled={!canShipWarehouse}
                              title={canShipWarehouse ? 'Mark Ready to Ship' : 'Only Warehouse/Admin can ship'}
                            >
                              <Truck className="h-3.5 w-3.5" /> Ready to Ship
                            </button>
                          )}
                          {isPartial && allowPartial && (
                            <button
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${canShipWarehouse ? 'bg-accent-warning hover:bg-accent-warning/90 text-white' : 'bg-neutral-light/40 text-neutral-medium cursor-not-allowed'}`}
                              onClick={() => { if (!canShipWarehouse) return; onPartialShip(String(po.id)) }}
                              disabled={!canShipWarehouse}
                              title={canShipWarehouse ? 'Create Partial Shipment' : 'Only Warehouse/Admin can ship'}
                            >
                              <Truck className="h-3.5 w-3.5" /> Partial Ship
                            </button>
                          )}
                          {isReadyToShip && (
                            canShowShipOrder ? (
                              <button
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${canShipWarehouse ? 'bg-primary-medium hover:bg-primary-dark text-white' : 'bg-neutral-light/40 text-neutral-medium cursor-not-allowed'}`}
                                onClick={() => { if (!canShipWarehouse) return; onShipOrder(String(po.id)) }}
                                disabled={!canShipWarehouse}
                                title={canShipWarehouse ? 'Ship Order' : 'Only Warehouse/Admin can ship'}
                              >
                                <Package className="h-3.5 w-3.5" /> Ship Order
                              </button>
                            ) : (
                              showAwaitingPickPack ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-light/40 text-neutral-medium border border-neutral-soft/50"
                                  title="Awaiting pick-pack completion"
                                >
                                  <Package className="h-3.5 w-3.5" /> Awaiting Pick/Pack
                                </span>
                              ) : null
                            )
                          )}
                          {(isPartiallyShipped || isShipped) && (
                            <button
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-success hover:bg-accent-success/90 text-white shadow-sm transition-all"
                              onClick={() => openAsn(String(po.id), poNumber, isPartiallyShipped ? 'partially_shipped' : 'shipped')}
                              title="View ASN"
                            >
                              <Eye className="h-3.5 w-3.5" /> View ASN
                            </button>
                          )}
                          {!isAllocated && !isReadyToShip && !isPartial && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              <Package className="h-3.5 w-3.5" />
                              Shipping Queue
                            </span>
                          )}
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

      {asnOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setAsnOpen(false); setAsnPoStatus(null) }} />
          <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-gradient-to-r from-primary-dark to-primary-medium px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Shipment Notification</h3>
                    <p className="text-primary-light/80 text-sm">Advanced Shipping Notice (ASN)</p>
                    <p className="text-primary-light/80 text-xs">PO #{asnPoNumber}</p>
                  </div>
                </div>
                {asnLoading && (
                  <span className="mr-3 px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/90 border border-white/20">Loading…</span>
                )}
                <button
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  onClick={() => { setAsnOpen(false); setAsnPoStatus(null) }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-neutral-light/30 flex-1 overflow-y-auto">
              {asnError ? (
                <div className="text-sm text-red-700">{asnError}</div>
              ) : asnRows.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-neutral-soft rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-neutral-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-neutral-dark mb-2">No Shipments Found</h4>
                  <p className="text-neutral-medium">No ASN data available for this purchase order.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {asnRows.map((asn: any, index: number) => (
                    <div key={asn.id || index} className="bg-white border border-neutral-soft rounded-xl p-6 hover:shadow-lg">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          {(() => {
                            const isRemainingShipment = asn.asn_number && String(asn.asn_number).includes('REMAINING')
                            const isPartialShipment = asnPoStatus === 'partially_shipped' && !isRemainingShipment

                            const iconWrapClass = isRemainingShipment
                              ? 'bg-blue-100'
                              : isPartialShipment
                                ? 'bg-orange-100'
                                : 'bg-accent-success/10'

                            const iconClass = isRemainingShipment
                              ? 'text-blue-600'
                              : isPartialShipment
                                ? 'text-orange-600'
                                : 'text-accent-success'

                            return (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconWrapClass}`}>
                                <svg className={`w-6 h-6 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                              </div>
                            )
                          })()}
                          <div>
                            <h4 className="text-lg font-bold text-neutral-dark">{String(asn.asn_number || 'ASN-UNKNOWN')}</h4>
                            {(() => {
                              const isRemainingShipment = asn.asn_number && String(asn.asn_number).includes('REMAINING')
                              const isPartialShipment = asnPoStatus === 'partially_shipped' && !isRemainingShipment

                              const lineClass = isRemainingShipment
                                ? 'text-blue-600'
                                : isPartialShipment
                                  ? 'text-orange-600'
                                  : 'text-neutral-medium'

                              const prefix = isRemainingShipment
                                ? 'Remaining Shipment on '
                                : isPartialShipment
                                  ? 'Partial Shipment on '
                                  : 'Shipped on '

                              return (
                                <p className={`text-sm ${lineClass}`}>
                                  {prefix}{asn.created_at ? new Date(asn.created_at).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  }) : 'Unknown Date'}
                                </p>
                              )
                            })()}
                          </div>
                        </div>
                        <div className="text-right">
                          {(() => {
                            const isRemainingShipment = asn.asn_number && String(asn.asn_number).includes('REMAINING')
                            const isPartialShipment = asnPoStatus === 'partially_shipped' && !isRemainingShipment

                            if (isRemainingShipment) {
                              return (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                  Remaining Shipment
                                </div>
                              )
                            }

                            if (isPartialShipment) {
                              return (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                                  Partial Shipment
                                </div>
                              )
                            }

                            return (
                              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent-success/10 text-accent-success border border-accent-success/20">
                                Shipped
                              </div>
                            )
                          })()}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-3">
                          <h5 className="font-semibold text-neutral-dark text-sm uppercase tracking-wide">Product Details</h5>
                          <div className="bg-neutral-light rounded-xl p-4 border border-neutral-soft/40">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-primary-light/10 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-primary-medium" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 2L3 7v11a1 1 0 001 1h12a1 1 0 001-1V7l-7-5zM10 12a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div>
                                <p className="font-medium text-neutral-dark">{String(asn.product_name || 'Unknown Product')}</p>
                                <p className="text-sm text-neutral-medium">Qty: {Number(asn.shipped_qty || 0).toLocaleString()} units</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="font-semibold text-neutral-dark text-sm uppercase tracking-wide">Carrier Information</h5>
                          <div className="bg-neutral-light rounded-xl p-4 border border-neutral-soft/40">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-accent-warning/10 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-accent-warning" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707L16 7.586A1 1 0 0015.414 7H14z" />
                                </svg>
                              </div>
                              <div>
                                <p className="font-medium text-neutral-dark">{String(asn.carrier || 'UPS')}</p>
                                <p className="text-sm text-neutral-medium">Standard Delivery</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="font-semibold text-neutral-dark text-sm uppercase tracking-wide">Tracking</h5>
                          <div className="bg-neutral-light rounded-xl p-4 border border-neutral-soft/40">
                            {asn.tracking_number ? (
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-primary-medium/10 rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-primary-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="font-mono text-sm font-medium text-primary-medium">{String(asn.tracking_number)}</p>
                                  <button className="text-xs text-primary-light hover:text-primary-medium underline transition-colors">Track Package →</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-neutral-soft rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-neutral-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm text-neutral-medium">Tracking Pending</p>
                                  <p className="text-xs text-neutral-medium/70">Will be available soon</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-neutral-soft/40">
                        <div className="flex items-center space-x-2 text-sm text-neutral-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>
                            Created: {asn.created_at ? new Date(asn.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-neutral-soft/40 flex justify-between items-center">
                <div className="text-sm text-neutral-medium">
                  {asnRows.length > 0 && `${asnRows.length} shipment${asnRows.length !== 1 ? 's' : ''} found`}
                </div>
                <button
                  className="px-6 py-2.5 bg-primary-medium hover:bg-primary-dark text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg"
                  onClick={() => setAsnOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShippingTab
