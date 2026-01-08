import React, { useState, useRef, useEffect } from 'react'
import { Search, Filter, Library, Upload, FileText, Tag, Eye, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const ContentLibrary: React.FC = () => {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const isSalesRepViewOnly = String(currentUserRole || '').toLowerCase() === 'sales_representative'

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [tag, setTag] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    const loadRole = async () => {
      try {
        if (!user?.id) return
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if (!active) return
        setCurrentUserRole((data as any)?.role ? String((data as any).role) : null)
      } catch {
        if (!active) return
        setCurrentUserRole(null)
      }
    }
    loadRole()
    return () => { active = false }
  }, [user?.id])

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-2 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
          <div className="flex items-start">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-dark mb-1">Content Library</h1>
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-neutral-dark">Upload File</h2>
            <p className="text-sm text-neutral-medium mt-1">PDF, JPEG, PNG (Max size: 50MB)</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            className="hidden"
            onChange={(e) => {
              if (isSalesRepViewOnly) return
              const list = Array.from(e.target.files || [])
              setFiles((prev) => [...prev, ...list])
              if (e.currentTarget) e.currentTarget.value = ''
            }}
          />

          {/* Drag & Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-primary-medium bg-primary-light/10'
                : 'border-neutral-soft hover:border-primary-light hover:bg-neutral-light/40'
            }`}
            onDragOver={(e) => {
              if (isSalesRepViewOnly) return
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              if (isSalesRepViewOnly) return
              e.preventDefault()
              setIsDragging(false)
            }}
            onDrop={(e) => {
              if (isSalesRepViewOnly) return
              e.preventDefault()
              setIsDragging(false)
              const dropped = Array.from(e.dataTransfer?.files || [])
              const accepted = dropped.filter((f) => {
                const okType = /pdf|jpeg|jpg|png/i.test(f.type)
                const okName = /\.(pdf|jpe?g|png)$/i.test(f.name)
                return okType || okName
              })
              if (accepted.length) setFiles((prev) => [...prev, ...accepted])
            }}
            onClick={() => { if (!isSalesRepViewOnly) fileInputRef.current?.click() }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (isSalesRepViewOnly) return
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
            }}
          >
            <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-primary-medium" />
            </div>
            <p className="text-base text-neutral-dark font-semibold">Drag & drop files here</p>
            <p className="text-sm text-neutral-medium mt-1">or click to browse</p>
            <div className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-medium shadow-sm">Browse files</div>
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-soft grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center text-sm font-semibold text-neutral-dark">
                <Tag className="h-4 w-4 mr-2 text-primary-medium" />
                Tag
              </label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white text-neutral-dark focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:border-neutral-medium transition-all"
              >
                <option value="">Select a tag...</option>
                <option>Product</option>
                <option>Formula</option>
                <option>Inventory</option>
                <option>General</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center text-sm font-semibold text-neutral-dark">
                <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white text-neutral-dark placeholder-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:border-neutral-medium transition-all"
              />
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-6">
              <div className="flex flex-wrap gap-3">
                {files.map((f, i) => (
                  <span key={i} className="px-3 py-2 rounded-lg bg-neutral-light text-neutral-dark text-sm border border-neutral-soft">{f.name}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            {!isSalesRepViewOnly && (
              <button
                onClick={() => { /* placeholder submit */ alert('This is a UI-only demo. Wire to backend to upload.')}}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-sm hover:shadow-md"
              >
                Upload File
              </button>
            )}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-3">
                Search Content
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-medium" />
                <input
                  type="text"
                  placeholder="Search content..."
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
                <span className="text-neutral-medium">All Types</span>
                <Filter className="h-5 w-5 text-neutral-medium" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Table */}
        {files.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="px-10 py-8 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-dark mb-2">Content Catalog</h3>
                  <p className="text-neutral-medium font-medium">0 files in your library</p>
                </div>
                <div className="px-4 py-2 bg-primary-light/10 rounded-xl border border-primary-light/20">
                  <span className="text-sm font-semibold text-primary-dark">0 Total</span>
                </div>
              </div>
            </div>
            <div className="p-16 text-center">
              <div className="mx-auto w-16 h-16 bg-primary-light/20 rounded-full flex items-center justify-center mb-4">
                <Library className="h-8 w-8 text-primary-medium" />
              </div>
              <p className="text-neutral-medium mb-4">No files found</p>
              {!isSalesRepViewOnly && (
                <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md">
                  Upload Your First File
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="px-10 py-8 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-dark mb-2">Content Catalog</h3>
                  <p className="text-neutral-medium font-medium">{files.length} files in your library</p>
                </div>
                <div className="px-4 py-2 bg-primary-light/10 rounded-xl border border-primary-light/20">
                  <span className="text-sm font-semibold text-primary-dark">{files.length} Total</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Library className="h-4 w-4 text-primary-medium" />
                        <span>File</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <Tag className="h-4 w-4 text-primary-medium" />
                        <span>Tag</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Type</th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-primary-medium" />
                        <span>Description</span>
                      </div>
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-bold text-neutral-dark uppercase tracking-wider">Size</th>
                    <th className="px-8 py-6 text-center text-sm font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-soft/20">
                  {files.map((f, idx) => (
                    <tr key={idx} className="group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm">
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-neutral-light/60 rounded-xl flex items-center justify-center shadow-sm">
                            <Library className="h-6 w-6 text-primary-dark" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-neutral-dark truncate max-w-[300px]">{f.name}</div>
                            <div className="text-xs text-neutral-medium">Added now</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary-light/20 to-primary-medium/20 text-primary-dark border border-primary-light/30 shadow-sm">
                          {tag || '—'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-medium text-neutral-dark bg-neutral-light/50 px-3 py-2 rounded-lg border border-neutral-soft/30">
                          {f.type || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-neutral-dark truncate max-w-[260px]">
                          {description || '—'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-medium text-neutral-dark">{Math.ceil((f.size || 0)/1024)} KB</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center space-x-2">
                          <button type="button" className="group/btn p-3 text-primary-medium hover:text-white hover:bg-primary-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium">
                            <Eye className="h-5 w-5" />
                          </button>
                          {!isSalesRepViewOnly && (
                            <button type="button" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))} className="group/btn p-3 text-accent-danger hover:text-white hover:bg-accent-danger rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-accent-danger/30 hover:border-accent-danger">
                              <Trash2 className="h-5 w-5" />
                            </button>
                          )}
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

export default ContentLibrary
