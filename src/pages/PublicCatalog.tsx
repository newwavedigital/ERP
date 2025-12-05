import React, { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, Star, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const PublicCatalog: React.FC = () => {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'relevance'|'price-asc'|'price-desc'|'rating'>('relevance')
  const [cat, setCat] = useState<'All'|'Sauces'|'Spices'|'Oils'|'Jams'>('All')
  const [page, setPage] = useState(1)
  const items = [
    { id: 'FG-1001', name: 'Premium Sauce 500ml', cat: 'Sauces', price: 149, status: 'In Stock', rating: 4.8, img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1600&auto=format&fit=crop' },
    { id: 'FG-1002', name: 'Spice Mix 250g', cat: 'Spices', price: 99, status: 'Low Stock', rating: 4.6, img: 'https://images.unsplash.com/photo-1585386959984-a4155223165f?q=80&w=1600&auto=format&fit=crop' },
    { id: 'FG-1003', name: 'Gourmet Oil 1L', cat: 'Oils', price: 199, status: 'In Production', rating: 4.7, img: 'https://images.unsplash.com/photo-1604908176997-4296a9d3a227?q=80&w=1600&auto=format&fit=crop' },
    { id: 'FG-1004', name: 'Organic Jam 300g', cat: 'Jams', price: 129, status: 'In Stock', rating: 4.5, img: 'https://images.unsplash.com/photo-1596040033229-162ddea20adf?q=80&w=1600&auto=format&fit=crop' },
  ]
  const filtered = useMemo(() => {
    let rows = items.filter(i => (i.name+ i.id).toLowerCase().includes(q.toLowerCase()))
    if (cat !== 'All') rows = rows.filter(i => i.cat === cat)
    switch (sort) {
      case 'price-asc': rows = [...rows].sort((a,b)=>a.price-b.price); break
      case 'price-desc': rows = [...rows].sort((a,b)=>b.price-a.price); break
      case 'rating': rows = [...rows].sort((a,b)=>b.rating-a.rating); break
      default: break
    }
    return rows
  }, [q, sort, cat])

  const pageSize = 8
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page-1)*pageSize, page*pageSize)

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-light to-white">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <button onClick={() => navigate('/home')} className="inline-flex items-center gap-2 text-neutral-medium hover:text-primary-medium mb-4"><ArrowLeft className="w-4 h-4"/>Back to Home</button>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-neutral-dark">Catalog</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-medium absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search items..." className="pl-9 pr-3 py-2 rounded-full bg-neutral-light border border-neutral-soft text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"/>
            </div>
            <button className="px-3 py-2 rounded-full border border-neutral-soft text-neutral-dark hover:border-primary-light flex items-center gap-2"><SlidersHorizontal className="w-4 h-4"/>Filters</button>
          </div>
        </div>

        {/* Category chips & sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {(['All','Sauces','Spices','Oils','Jams'] as const).map(c => (
              <button key={c} onClick={()=>{setCat(c); setPage(1)}} className={`px-3 py-1.5 rounded-full text-sm border ${cat===c?'bg-primary-medium text-white border-primary-medium':'border-neutral-soft text-neutral-dark hover:border-primary-light'}`}>{c}</button>
            ))}
          </div>
          <div className="text-sm flex items-center gap-2">
            <span className="text-neutral-medium">Sort</span>
            <select value={sort} onChange={(e)=>setSort(e.target.value as any)} className="px-3 py-1.5 rounded-full border border-neutral-soft bg-white">
              <option value="relevance">Relevance</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Rating</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pageRows.map(i => (
            <div key={i.id} className="bg-white rounded-2xl border border-neutral-soft overflow-hidden hover:shadow-xl transition-all">
              <img src={i.img} alt={i.name} className="w-full h-40 object-cover" />
              <div className="p-4">
                <div className="text-xs text-neutral-medium mb-1">{i.id} • {i.cat}</div>
                <div className="font-semibold text-neutral-dark">{i.name}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-primary-medium font-semibold">₱{i.price}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${i.status==='In Stock'?'bg-accent-success/10 text-accent-success':i.status==='Low Stock'?'bg-accent-warning/10 text-accent-warning':'bg-primary-light/10 text-primary-medium'}`}>{i.status}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-neutral-medium"><Star className="w-4 h-4 text-primary-medium"/>{i.rating}</div>
                <div className="mt-3 flex items-center gap-2">
                  <button title="Read-only preview" className="flex-1 bg-neutral-light text-neutral-medium px-3 py-2 rounded-full cursor-not-allowed">Add to Cart</button>
                  <button onClick={()=>{}} className="px-3 py-2 rounded-full border border-neutral-soft text-neutral-dark hover:border-primary-light">View</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-2 rounded-full border border-neutral-soft text-neutral-dark hover:border-primary-light">Prev</button>
          <div className="text-sm text-neutral-medium">Page {page} of {totalPages}</div>
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-2 rounded-full border border-neutral-soft text-neutral-dark hover:border-primary-light">Next</button>
        </div>
      </div>
    </div>
  )
}

export default PublicCatalog
