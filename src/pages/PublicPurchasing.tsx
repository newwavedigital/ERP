import React from 'react'
import { ClipboardList, Truck, DollarSign, CalendarClock, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const PublicPurchasing: React.FC = () => {
  const navigate = useNavigate()

  const timeline = [
    { id: 'PO-4421', vendor: 'ABC Foods', status: 'Approved', eta: 'Dec 15', amount: 52900 },
    { id: 'PO-4422', vendor: 'Quality Jars Co', status: 'Pending', eta: 'Dec 20', amount: 13800 },
    { id: 'PO-4423', vendor: 'Spice Partners', status: 'Received', eta: 'Dec 02', amount: 9100 },
  ]

  const logistics = [
    { carrier: 'DHL Freight', ontime: 96 },
    { carrier: 'LBC Industrial', ontime: 91 },
    { carrier: 'J&T Cargo', ontime: 88 },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-light to-white">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <button onClick={() => navigate('/home')} className="inline-flex items-center gap-2 text-neutral-medium hover:text-primary-medium mb-4"><ArrowLeft className="w-4 h-4"/>Back to Home</button>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-neutral-dark">Purchasing</h1>
          <div className="text-sm text-neutral-medium">Read‑only preview</div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent POs */}
          <div className="bg-white rounded-2xl border border-neutral-soft p-6">
            <div className="flex items-center gap-2 mb-4 text-neutral-dark font-semibold"><ClipboardList className="w-5 h-5"/>Recent POs</div>
            <div className="space-y-4">
              {timeline.map((po,i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-2 h-2 mt-2 rounded-full ${po.status==='Approved'?'bg-primary-medium':po.status==='Received'?'bg-accent-success':'bg-accent-warning'}`}></div>
                  <div className="flex-1">
                    <div className="font-medium text-neutral-dark">{po.id} • {po.vendor}</div>
                    <div className="text-xs text-neutral-medium">Status: {po.status} • ETA {po.eta}</div>
                  </div>
                  <div className="text-sm font-semibold text-primary-medium">₱{po.amount.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="bg-white rounded-2xl border border-neutral-soft p-6">
            <div className="flex items-center gap-2 mb-4 text-neutral-dark font-semibold"><DollarSign className="w-5 h-5"/>Budget</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm"><span className="text-neutral-dark">This Month</span><span className="font-semibold text-primary-medium">₱180,000</span></div>
              <div className="w-full h-2 bg-neutral-soft rounded-full"><div className="h-2 rounded-full bg-primary-medium w-[62%]"></div></div>
              <div className="flex items-center justify-between text-sm"><span className="text-neutral-dark">Committed</span><span className="font-semibold text-primary-medium">₱112,800</span></div>
              <div className="w-full h-2 bg-neutral-soft rounded-full"><div className="h-2 rounded-full bg-accent-warning w-[40%]"></div></div>
              <div className="flex items-center justify-between text-sm"><span className="text-neutral-dark">Received</span><span className="font-semibold text-primary-medium">₱51,000</span></div>
              <div className="w-full h-2 bg-neutral-soft rounded-full"><div className="h-2 rounded-full bg-accent-success w-[28%]"></div></div>
            </div>
          </div>

          {/* Logistics performance */}
          <div className="bg-white rounded-2xl border border-neutral-soft p-6">
            <div className="flex items-center gap-2 mb-4 text-neutral-dark font-semibold"><Truck className="w-5 h-5"/>Logistics Performance</div>
            <div className="space-y-3">
              {logistics.map((l,i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-dark">{l.carrier}</span>
                    <span className="font-semibold text-primary-medium">{l.ontime}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-soft rounded-full mt-1">
                    <div className="h-2 rounded-full bg-primary-medium" style={{width: `${l.ontime}%`}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar preview */}
        <div className="mt-6 bg-white rounded-2xl border border-neutral-soft p-6">
          <div className="flex items-center gap-2 mb-4 text-neutral-dark font-semibold"><CalendarClock className="w-5 h-5"/>Expected Deliveries</div>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            {['Dec 02','Dec 05','Dec 12','Dec 15','Dec 20','Dec 22','Dec 27','Jan 03'].map((d,i)=> (
              <div key={i} className="rounded-xl border border-neutral-soft p-3 text-neutral-dark bg-neutral-light/50">{d}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PublicPurchasing
