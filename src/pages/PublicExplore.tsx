import React from 'react'
import { ArrowLeft, Factory, Layers, Package, BarChart3, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const PublicExplore: React.FC = () => {
  const navigate = useNavigate()

  const steps = [
    { icon: Layers, title: 'Raw Materials', desc: 'FEFO, batches, and supplier sourcing.' },
    { icon: Factory, title: 'Production', desc: 'Plan, schedule, and monitor WIP.' },
    { icon: Package, title: 'Finished Goods', desc: 'Allocate inventory and fulfill orders.' },
    { icon: BarChart3, title: 'Insights', desc: 'Dashboards and predictive analytics.' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-light to-white">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <button onClick={() => navigate('/home')} className="inline-flex items-center gap-2 text-neutral-medium hover:text-primary-medium mb-4"><ArrowLeft className="w-4 h-4"/>Back to Home</button>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-neutral-dark">Explore</h1>
          <div className="text-sm text-neutral-medium">Interactive overview</div>
        </div>

        {/* Guided tour */}
        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-soft p-6 hover:shadow-xl transition-all">
              <div className="w-12 h-12 rounded-xl bg-primary-medium/10 text-primary-medium flex items-center justify-center mb-4"><s.icon className="w-6 h-6"/></div>
              <div className="font-semibold text-neutral-dark">{s.title}</div>
              <div className="text-sm text-neutral-medium">{s.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-gradient-to-r from-primary-dark to-primary-medium rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Watch a 2‑minute product tour</div>
            <div className="text-white/80 text-sm">See how allocation, purchasing, and production work together.</div>
          </div>
          <button className="bg-white text-primary-dark px-5 py-3 rounded-full font-semibold hover:bg-neutral-light inline-flex items-center gap-2"><Play className="w-5 h-5"/>Play Demo</button>
        </div>
      </div>
    </div>
  )
}

export default PublicExplore
