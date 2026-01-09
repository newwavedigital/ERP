import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Plus, Search, Filter, Users, User, Mail, Phone, Globe, BadgeCheck, Eye, Edit, Trash2, Building2, MapPin, FileText, CheckCircle2, Package, Box, Leaf, AlertTriangle, FlaskConical, FileUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Tab Components
const ProductsTab: React.FC<{ onboardingId: string | null }> = ({ onboardingId }) => {
  const [newProduct, setNewProduct] = useState({ product_name: '', formula_source: 'existing', specifications: '', trial_date: '' })
  const [products, setProducts] = useState<
    Array<{
      id: string
      pending: boolean
      product_name: string
      formula_source: string
      specifications: string
      trial_date: string
    }>
  >([])
  const syncingProductIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!onboardingId) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('onboarding_products')
          .select('id, product_name, formula_source, specifications, trial_date')
          .eq('onboarding_id', onboardingId)
          .order('id', { ascending: true })
        if (error) throw error
        setProducts((prev) => {
          const pending = prev.filter((p) => p.pending)
          const fetched = (data ?? []).map((r: any) => ({
            id: String(r.id),
            pending: false,
            product_name: String(r.product_name || ''),
            formula_source: String(r.formula_source || 'existing'),
            specifications: String(r.specifications || ''),
            trial_date: String(r.trial_date || ''),
          }))
          const byId = new Map<string, (typeof fetched)[number]>()
          for (const p of pending) byId.set(p.id, p)
          for (const p of fetched) byId.set(p.id, p)
          return Array.from(byId.values())
        })
      } catch (e) {
        // ignore; allow local-only usage
      }
    })()
  }, [onboardingId])

  useEffect(() => {
    if (!onboardingId) return
    const pending = products.filter((p) => p.pending && !syncingProductIdsRef.current.has(p.id))
    if (pending.length === 0) return
    ;(async () => {
      for (const p of pending) {
        syncingProductIdsRef.current.add(p.id)
        try {
          const { data, error } = await supabase
            .from('onboarding_products')
            .insert({
              onboarding_id: onboardingId,
              product_name: p.product_name,
              formula_source: p.formula_source,
              specifications: p.specifications,
              trial_date: p.trial_date,
            })
            .select('id, product_name, formula_source, specifications, trial_date')
            .single()
          if (error) throw error
          if (data?.id) {
            setProducts((prev) => {
              const realId = String(data.id)
              const withoutExistingReal = prev.filter((x) => x.id !== realId || x.id === p.id)
              return withoutExistingReal.map((x) =>
                x.id === p.id
                  ? {
                      id: realId,
                      pending: false,
                      product_name: String(data.product_name || ''),
                      formula_source: String(data.formula_source || 'existing'),
                      specifications: String(data.specifications || ''),
                      trial_date: String(data.trial_date || ''),
                    }
                  : x
              )
            })
          }
        } catch (e) {
          // keep pending; user can still submit later
          syncingProductIdsRef.current.delete(p.id)
        }
      }
    })()
  }, [onboardingId, products])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          value={newProduct.product_name}
          onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
          placeholder="Product Name"
          className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
        />
        <select
          value={newProduct.formula_source}
          onChange={(e) => setNewProduct({ ...newProduct, formula_source: e.target.value })}
          className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
        >
          <option value="existing">Existing Formula</option>
          <option value="customer">Customer Formula</option>
        </select>
      </div>
      <textarea
        value={newProduct.specifications}
        onChange={(e) => setNewProduct({ ...newProduct, specifications: e.target.value })}
        placeholder="Product specifications"
        rows={2}
        className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
      />
      <input
        type="date"
        value={newProduct.trial_date}
        onChange={(e) => setNewProduct({ ...newProduct, trial_date: e.target.value })}
        className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
      />
      <button
        type="button"
        onClick={async () => {
          if (!newProduct.product_name) return
          try {
            if (!onboardingId) {
              const tempId = `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`
              setProducts((prev) => [
                ...prev,
                {
                  id: tempId,
                  pending: true,
                  product_name: newProduct.product_name,
                  formula_source: newProduct.formula_source,
                  specifications: newProduct.specifications,
                  trial_date: newProduct.trial_date,
                },
              ])
            } else {
              const { data, error } = await supabase
                .from('onboarding_products')
                .insert({
                  onboarding_id: onboardingId,
                  ...newProduct,
                })
                .select('id, product_name, formula_source, specifications, trial_date')
                .single()
              if (error) throw error
              if (data?.id) {
                setProducts((prev) => [
                  ...prev,
                  {
                    id: String(data.id),
                    pending: false,
                    product_name: String(data.product_name || ''),
                    formula_source: String(data.formula_source || 'existing'),
                    specifications: String(data.specifications || ''),
                    trial_date: String(data.trial_date || ''),
                  },
                ])
              }
            }
            setNewProduct({ product_name: '', formula_source: 'existing', specifications: '', trial_date: '' })
          } catch (e) {
            console.error('Failed to add product:', e)
          }
        }}
        className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-all"
      >
        Add Product
      </button>

      {products.length > 0 && (
        <div className="mt-4 space-y-2">
          {products.map((p) => (
            <div key={p.id} className="p-3 bg-neutral-light/30 rounded-lg flex justify-between items-center">
              <span className="font-medium">{p.product_name}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (p.pending) {
                      setProducts((prev) => prev.filter((x) => x.id !== p.id))
                      return
                    }
                    await supabase.from('onboarding_products').delete().eq('id', p.id)
                    setProducts((prev) => prev.filter((x) => x.id !== p.id))
                  } catch (e) {
                    console.error('Failed to remove product:', e)
                  }
                }}
                className="text-accent-danger hover:underline text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const PackagingTab: React.FC<{ onboardingId: string | null }> = ({ onboardingId }) => {
  const [newPackaging, setNewPackaging] = useState({ packaging_type: '', size: '', case_pack_qty: '', label_orientation: '', artwork_required: false, provided_by_customer: false, notes: '' })
  const [packaging, setPackaging] = useState<
    Array<{
      id: string
      pending: boolean
      packaging_type: string
      size: string
      case_pack_qty: string
      label_orientation: string
      artwork_required: boolean
      provided_by_customer: boolean
      notes: string
    }>
  >([])
  const syncingPackagingIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!onboardingId) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('onboarding_packaging')
          .select('id, packaging_type, size, case_pack_qty, label_orientation, artwork_required, provided_by_customer, notes')
          .eq('onboarding_id', onboardingId)
          .order('id', { ascending: true })
        if (error) throw error
        setPackaging((prev) => {
          const pending = prev.filter((p) => p.pending)
          const fetched = (data ?? []).map((r: any) => ({
            id: String(r.id),
            pending: false,
            packaging_type: String(r.packaging_type || ''),
            size: String(r.size || ''),
            case_pack_qty: r.case_pack_qty == null ? '' : String(r.case_pack_qty),
            label_orientation: String(r.label_orientation || ''),
            artwork_required: Boolean(r.artwork_required),
            provided_by_customer: Boolean(r.provided_by_customer),
            notes: String(r.notes || ''),
          }))
          return [...pending, ...fetched]
        })
      } catch (e) {
        // ignore; allow local-only usage
      }
    })()
  }, [onboardingId])

  useEffect(() => {
    if (!onboardingId) return
    const pending = packaging.filter((p) => p.pending && !syncingPackagingIdsRef.current.has(p.id))
    if (pending.length === 0) return
    ;(async () => {
      for (const p of pending) {
        syncingPackagingIdsRef.current.add(p.id)
        try {
          const { data, error } = await supabase
            .from('onboarding_packaging')
            .insert({
              onboarding_id: onboardingId,
              packaging_type: p.packaging_type,
              size: p.size,
              case_pack_qty: parseInt(p.case_pack_qty) || null,
              label_orientation: p.label_orientation,
              artwork_required: p.artwork_required,
              provided_by_customer: p.provided_by_customer,
              notes: p.notes,
            })
            .select('id, packaging_type, size, case_pack_qty, label_orientation, artwork_required, provided_by_customer, notes')
            .single()
          if (error) throw error
          if (data?.id) {
            setPackaging((prev) =>
              prev.map((x) =>
                x.id === p.id
                  ? {
                      id: String(data.id),
                      pending: false,
                      packaging_type: String(data.packaging_type || ''),
                      size: String(data.size || ''),
                      case_pack_qty: data.case_pack_qty == null ? '' : String(data.case_pack_qty),
                      label_orientation: String(data.label_orientation || ''),
                      artwork_required: Boolean(data.artwork_required),
                      provided_by_customer: Boolean(data.provided_by_customer),
                      notes: String(data.notes || ''),
                    }
                  : x
              )
            )
          }
        } catch (e) {
          // keep pending
          syncingPackagingIdsRef.current.delete(p.id)
        }
      }
    })()
  }, [onboardingId, packaging])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input 
          type="text" 
          value={newPackaging.packaging_type} 
          onChange={(e) => setNewPackaging({ ...newPackaging, packaging_type: e.target.value })} 
          placeholder="Packaging Type" 
          className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" 
        />
        <input 
          type="text" 
          value={newPackaging.size} 
          onChange={(e) => setNewPackaging({ ...newPackaging, size: e.target.value })} 
          placeholder="Size" 
          className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" 
        />
        <input 
          type="number" 
          value={newPackaging.case_pack_qty} 
          onChange={(e) => setNewPackaging({ ...newPackaging, case_pack_qty: e.target.value })} 
          placeholder="Case Pack Qty" 
          className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" 
        />
      </div>
      <select 
        value={newPackaging.label_orientation} 
        onChange={(e) => setNewPackaging({ ...newPackaging, label_orientation: e.target.value })} 
        className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
      >
        <option value="">Select label orientation</option>
        <option value="Right side up">Right side up</option>
        <option value="Upside down">Upside down</option>
      </select>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={newPackaging.artwork_required} 
            onChange={(e) => setNewPackaging({ ...newPackaging, artwork_required: e.target.checked })} 
            className="h-4 w-4" 
          />
          <span className="text-sm">Artwork Required</span>
        </label>
        <label className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={newPackaging.provided_by_customer} 
            onChange={(e) => setNewPackaging({ ...newPackaging, provided_by_customer: e.target.checked })} 
            className="h-4 w-4" 
          />
          <span className="text-sm">Provided by Customer</span>
        </label>
      </div>
      <textarea 
        value={newPackaging.notes} 
        onChange={(e) => setNewPackaging({ ...newPackaging, notes: e.target.value })} 
        placeholder="Notes" 
        rows={2} 
        className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" 
      />
      <button 
        type="button"
        onClick={async () => {
          if (!newPackaging.packaging_type) return
          try {
            if (!onboardingId) {
              const tempId = `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`
              setPackaging((prev) => [
                ...prev,
                {
                  id: tempId,
                  pending: true,
                  ...newPackaging,
                },
              ])
            } else {
              const { data, error } = await supabase
                .from('onboarding_packaging')
                .insert({
                  onboarding_id: onboardingId,
                  ...newPackaging,
                  case_pack_qty: parseInt(newPackaging.case_pack_qty) || null,
                })
                .select('id, packaging_type, size, case_pack_qty, label_orientation, artwork_required, provided_by_customer, notes')
                .single()
              if (error) throw error
              if (data?.id) {
                setPackaging((prev) => [
                  ...prev,
                  {
                    id: String(data.id),
                    pending: false,
                    packaging_type: String(data.packaging_type || ''),
                    size: String(data.size || ''),
                    case_pack_qty: data.case_pack_qty == null ? '' : String(data.case_pack_qty),
                    label_orientation: String(data.label_orientation || ''),
                    artwork_required: Boolean(data.artwork_required),
                    provided_by_customer: Boolean(data.provided_by_customer),
                    notes: String(data.notes || ''),
                  },
                ])
              }
            }
            setNewPackaging({ packaging_type: '', size: '', case_pack_qty: '', label_orientation: '', artwork_required: false, provided_by_customer: false, notes: '' })
          } catch (e) {
            console.error('Failed to add packaging:', e)
          }
        }}
        className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-all"
      >
        Add Packaging
      </button>

      {packaging.length > 0 && (
        <div className="mt-4 space-y-2">
          {packaging.map((p) => (
            <div key={p.id} className="p-3 bg-neutral-light/30 rounded-lg flex justify-between items-center">
              <span className="font-medium">
                {p.packaging_type}
                {p.size ? ` - ${p.size}` : ''}
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (p.pending) {
                      setPackaging((prev) => prev.filter((x) => x.id !== p.id))
                      return
                    }
                    await supabase.from('onboarding_packaging').delete().eq('id', p.id)
                    setPackaging((prev) => prev.filter((x) => x.id !== p.id))
                  } catch (e) {
                    console.error('Failed to remove packaging:', e)
                  }
                }}
                className="text-accent-danger hover:underline text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const IngredientsTab: React.FC<{ onboardingId: string | null }> = ({ onboardingId }) => {
  const [newIngredient, setNewIngredient] = useState({ ingredient_name: '', vendor_name: '', provided_by_customer: false })
  const [ingredients, setIngredients] = useState<
    Array<{ id: string; pending: boolean; ingredient_name: string; vendor_name: string; provided_by_customer: boolean }>
  >([])
  const syncingIngredientIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!onboardingId) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('onboarding_ingredients')
          .select('id, ingredient_name, vendor_name, provided_by_customer')
          .eq('onboarding_id', onboardingId)
          .order('id', { ascending: true })
        if (error) throw error
        setIngredients((prev) => {
          const pending = prev.filter((p) => p.pending)
          const fetched = (data ?? []).map((r: any) => ({
            id: String(r.id),
            pending: false,
            ingredient_name: String(r.ingredient_name || ''),
            vendor_name: String(r.vendor_name || ''),
            provided_by_customer: Boolean(r.provided_by_customer),
          }))
          return [...pending, ...fetched]
        })
      } catch (e) {
        // ignore; allow local-only usage
      }
    })()
  }, [onboardingId])

  useEffect(() => {
    if (!onboardingId) return
    const pending = ingredients.filter((p) => p.pending && !syncingIngredientIdsRef.current.has(p.id))
    if (pending.length === 0) return
    ;(async () => {
      for (const ing of pending) {
        syncingIngredientIdsRef.current.add(ing.id)
        try {
          const { data, error } = await supabase
            .from('onboarding_ingredients')
            .insert({
              onboarding_id: onboardingId,
              ingredient_name: ing.ingredient_name,
              vendor_name: ing.vendor_name,
              provided_by_customer: ing.provided_by_customer,
            })
            .select('id, ingredient_name, vendor_name, provided_by_customer')
            .single()
          if (error) throw error
          if (data?.id) {
            setIngredients((prev) =>
              prev.map((x) =>
                x.id === ing.id
                  ? {
                      id: String(data.id),
                      pending: false,
                      ingredient_name: String(data.ingredient_name || ''),
                      vendor_name: String(data.vendor_name || ''),
                      provided_by_customer: Boolean(data.provided_by_customer),
                    }
                  : x
              )
            )
          }
        } catch (e) {
          // keep pending
          syncingIngredientIdsRef.current.delete(ing.id)
        }
      }
    })()
  }, [onboardingId, ingredients])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input 
          type="text" 
          value={newIngredient.ingredient_name} 
          onChange={(e) => setNewIngredient({ ...newIngredient, ingredient_name: e.target.value })} 
          placeholder="Ingredient Name" 
          className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" 
        />
        <input 
          type="text" 
          value={newIngredient.vendor_name} 
          onChange={(e) => setNewIngredient({ ...newIngredient, vendor_name: e.target.value })} 
          placeholder="Vendor Name" 
          className="px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" 
        />
      </div>
      <label className="flex items-center gap-2">
        <input 
          type="checkbox" 
          checked={newIngredient.provided_by_customer} 
          onChange={(e) => setNewIngredient({ ...newIngredient, provided_by_customer: e.target.checked })} 
          className="h-4 w-4" 
        />
        <span className="text-sm">Provided by Customer</span>
      </label>
      <button 
        type="button"
        onClick={async () => {
          if (!newIngredient.ingredient_name) return
          try {
            if (!onboardingId) {
              const tempId = `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`
              setIngredients((prev) => [
                ...prev,
                {
                  id: tempId,
                  pending: true,
                  ingredient_name: newIngredient.ingredient_name,
                  vendor_name: newIngredient.vendor_name,
                  provided_by_customer: newIngredient.provided_by_customer,
                },
              ])
            } else {
              const { data, error } = await supabase
                .from('onboarding_ingredients')
                .insert({
                  onboarding_id: onboardingId,
                  ...newIngredient,
                })
                .select('id, ingredient_name, vendor_name, provided_by_customer')
                .single()
              if (error) throw error
              if (data?.id) {
                setIngredients((prev) => [
                  ...prev,
                  {
                    id: String(data.id),
                    pending: false,
                    ingredient_name: String(data.ingredient_name || ''),
                    vendor_name: String(data.vendor_name || ''),
                    provided_by_customer: Boolean(data.provided_by_customer),
                  },
                ])
              }
            }
            setNewIngredient({ ingredient_name: '', vendor_name: '', provided_by_customer: false })
          } catch (e) {
            console.error('Failed to add ingredient:', e)
          }
        }}
        className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-all"
      >
        Add Ingredient
      </button>

      {ingredients.length > 0 && (
        <div className="mt-4 space-y-2">
          {ingredients.map((ing) => (
            <div key={ing.id} className="p-3 bg-neutral-light/30 rounded-lg flex justify-between items-center">
              <span className="font-medium">{ing.ingredient_name}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (ing.pending) {
                      setIngredients((prev) => prev.filter((x) => x.id !== ing.id))
                      return
                    }
                    await supabase.from('onboarding_ingredients').delete().eq('id', ing.id)
                    setIngredients((prev) => prev.filter((x) => x.id !== ing.id))
                  } catch (e) {
                    console.error('Failed to remove ingredient:', e)
                  }
                }}
                className="text-accent-danger hover:underline text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const AllergensTab: React.FC<{ onboardingId: string | null }> = ({ onboardingId }) => {
  const allergens = ['Eggs', 'Milk', 'Soy', 'Sesame', 'Seafood', 'Halal', 'Kosher', 'Tree Nuts', 'Coconut', 'Almonds', 'Pecans', 'Cashews', 'Walnuts', 'Mango', 'Hazelnut', 'Brazil Nut']
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {allergens.map((allergen) => (
          <label key={allergen} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedAllergens.includes(allergen)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedAllergens([...selectedAllergens, allergen])
                } else {
                  setSelectedAllergens(selectedAllergens.filter(a => a !== allergen))
                }
              }}
              className="h-4 w-4 text-primary-dark focus:ring-primary-light border-neutral-soft rounded"
            />
            <span className="text-sm font-medium text-neutral-dark">{allergen}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={async () => {
          if (!onboardingId) return
          try {
            const allergenRecords = selectedAllergens.map(allergen => ({
              onboarding_id: onboardingId,
              allergen,
              is_present: true
            }))
            await supabase.from('onboarding_allergens').insert(allergenRecords)
            setSelectedAllergens([])
          } catch (e) {
            console.error('Failed to save allergens:', e)
          }
        }}
        className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-all"
      >
        Save Allergens
      </button>
    </div>
  )
}

const LabQATab: React.FC<{ selectedTests: string[]; setSelectedTests: React.Dispatch<React.SetStateAction<string[]>> }> = ({ selectedTests, setSelectedTests }) => {
  const tests = ['Crude Analysis', 'Salmonella', 'Mold', 'Free Fatty Acids', 'PH', 'Coliform', 'Peroxide Value', 'Yeast']

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tests.map((test) => (
          <label key={test} className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={selectedTests.includes(test)} 
              onChange={(e) => { 
                if (e.target.checked) { 
                  setSelectedTests([...selectedTests, test]) 
                } else { 
                  setSelectedTests(selectedTests.filter(t => t !== test)) 
                } 
              }} 
              className="h-4 w-4" 
            />
            <span className="text-sm">{test}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

const DocumentsTab: React.FC<{ onboardingId: string | null }> = ({ onboardingId }) => {
  const [docType, setDocType] = useState<'specs' | 'artwork' | 'label' | 'tds'>('specs')
  const [fileUrl, setFileUrl] = useState('')
  const [documents, setDocuments] = useState<Array<{ id: string; pending: boolean; document_type: string; file_url: string }>>([])
  const syncingDocumentIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!onboardingId) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('onboarding_documents')
          .select('id, document_type, file_url')
          .eq('onboarding_id', onboardingId)
          .order('id', { ascending: true })
        if (error) throw error
        setDocuments((prev) => {
          const pending = prev.filter((p) => p.pending)
          const fetched = (data ?? []).map((r: any) => ({
            id: String(r.id),
            pending: false,
            document_type: String(r.document_type || ''),
            file_url: String(r.file_url || ''),
          }))
          return [...pending, ...fetched]
        })
      } catch (e) {
        // ignore; allow local-only usage
      }
    })()
  }, [onboardingId])

  useEffect(() => {
    if (!onboardingId) return
    const pending = documents.filter((p) => p.pending && !syncingDocumentIdsRef.current.has(p.id))
    if (pending.length === 0) return
    ;(async () => {
      for (const doc of pending) {
        syncingDocumentIdsRef.current.add(doc.id)
        try {
          const { data, error } = await supabase
            .from('onboarding_documents')
            .insert({
              onboarding_id: onboardingId,
              document_type: doc.document_type,
              file_url: doc.file_url,
            })
            .select('id, document_type, file_url')
            .single()
          if (error) throw error
          if (data?.id) {
            setDocuments((prev) =>
              prev.map((x) =>
                x.id === doc.id
                  ? {
                      id: String(data.id),
                      pending: false,
                      document_type: String(data.document_type || ''),
                      file_url: String(data.file_url || ''),
                    }
                  : x
              )
            )
          }
        } catch (e) {
          // keep pending
          syncingDocumentIdsRef.current.delete(doc.id)
        }
      }
    })()
  }, [onboardingId, documents])

  return (
    <div className="space-y-4">
      <select 
        value={docType} 
        onChange={(e) => setDocType(e.target.value as any)} 
        className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light"
      >
        <option value="specs">Specs</option>
        <option value="artwork">Artwork</option>
        <option value="label">Label</option>
        <option value="tds">TDS</option>
      </select>
      <input 
        type="url" 
        value={fileUrl} 
        onChange={(e) => setFileUrl(e.target.value)} 
        placeholder="File URL (https://...)" 
        className="w-full px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light" 
      />
      <p className="text-xs text-neutral-medium">Paste the Supabase Storage public URL or any hosted file URL</p>
      <button 
        type="button"
        disabled={!fileUrl.trim()}
        onClick={async () => {
          if (!fileUrl.trim()) return
          try {
            if (!onboardingId) {
              const tempId = `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`
              setDocuments((prev) => [
                ...prev,
                { id: tempId, pending: true, document_type: docType, file_url: fileUrl.trim() },
              ])
            } else {
              const { data, error } = await supabase
                .from('onboarding_documents')
                .insert({
                  onboarding_id: onboardingId,
                  document_type: docType,
                  file_url: fileUrl.trim(),
                })
                .select('id, document_type, file_url')
                .single()
              if (error) throw error
              if (data?.id) {
                setDocuments((prev) => [
                  ...prev,
                  {
                    id: String(data.id),
                    pending: false,
                    document_type: String(data.document_type || ''),
                    file_url: String(data.file_url || ''),
                  },
                ])
              }
            }
            setFileUrl('')
          } catch (e) {
            console.error('Failed to add document:', e)
          }
        }}
        className="px-4 py-2 bg-primary-medium text-white rounded-lg hover:bg-primary-dark transition-all disabled:opacity-60"
      >
        Add Document
      </button>

      {documents.length > 0 && (
        <div className="mt-4 space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="p-3 bg-neutral-light/30 rounded-lg flex justify-between items-center">
              <span className="font-medium">{String(doc.document_type || '').toUpperCase()}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (doc.pending) {
                      setDocuments((prev) => prev.filter((x) => x.id !== doc.id))
                      return
                    }
                    await supabase.from('onboarding_documents').delete().eq('id', doc.id)
                    setDocuments((prev) => prev.filter((x) => x.id !== doc.id))
                  } catch (e) {
                    console.error('Failed to remove document:', e)
                  }
                }}
                className="text-accent-danger hover:underline text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const Customers: React.FC = () => {
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState<boolean>(false)

  const canManageCustomers = useMemo(() => {
    const r = String(currentUserRole || '').toLowerCase()
    return r === 'admin' || r === 'procurement' || r === 'finance' || r === 'supply_chain' || r === 'sales_representative'
  }, [currentUserRole])

  const canViewCustomers = useMemo(() => {
    const r = String(currentUserRole || '').toLowerCase()
    return canManageCustomers || r === 'supply_chain_procurement'
  }, [canManageCustomers, currentUserRole])

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [onboardingId, setOnboardingId] = useState<string | null>(null)
  const [onboardingType, setOnboardingType] = useState<'DILLYS' | 'BNUTTY'>('DILLYS')
  const [onboardingNotes, setOnboardingNotes] = useState<string>('')
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([])
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false)
  const [viewData, setViewData] = useState<Customer | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    comments: '',
    status: 'Active',
  })
  const [addForm, setAddForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    comments: '',
    status: 'Active',
  })
  type Customer = {
    id: string
    name: string
    contact?: string
    email?: string
    phone?: string
    website?: string
    status?: string
    address?: string
    comments?: string
  }
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ show: boolean; message: string }>(() => ({ show: false, message: '' }))
  // Products for UI-only multi-select in Add Customer modal
  const [allProducts, setAllProducts] = useState<Array<{ id: string; name: string }>>([])
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

  // Load user role
  const loadUserRole = async () => {
    if (!user?.id) {
      setCurrentUserRole(null)
      return
    }
    setRoleLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (error) throw error
      setCurrentUserRole(data?.role ? String(data.role) : null)
    } catch (e) {
      setCurrentUserRole(null)
    } finally {
      setRoleLoading(false)
    }
  }

  useEffect(() => {
    loadUserRole()
  }, [user?.id])

  const refresh = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as any[]
      const mapped: Customer[] = rows.map((r) => ({
        id: String(r.id ?? ''),
        name: String(r.company_name ?? r.name ?? ''),
        contact: r.contact_person ? String(r.contact_person) : undefined,
        email: r.email ? String(r.email) : undefined,
        phone: r.phone ? String(r.phone) : undefined,
        website: r.website ? String(r.website) : undefined,
        status: r.status ? String(r.status) : undefined,
        address: r.address ? String(r.address) : undefined,
        comments: r.comments ? String(r.comments) : undefined,
      }))
      setCustomers(mapped)
    } catch (e: any) {
      setError(e?.message || 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // Load products for UI-only multi-select
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, product_name')
          .order('product_name', { ascending: true })
        if (error) throw error
        const list = (data ?? []).map((p: any) => ({ id: String(p.id), name: String(p.product_name || '') }))
        setAllProducts(list)
      } catch (e) {
        // UI-only; ignore silently
      }
    })()
  }, [])

  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(() => setToast({ show: false, message: '' }), 3000)
      return () => clearTimeout(t)
    }
  }, [toast.show])

  const saveLabRequirementsForOnboarding = async (ensuredOnboardingId: string) => {
    try {
      await supabase.from('onboarding_lab_requirements').delete().eq('onboarding_id', ensuredOnboardingId)
      if (selectedLabTests.length === 0) return
      const testRecords = selectedLabTests.map((test) => ({
        onboarding_id: ensuredOnboardingId,
        test_name: test,
        required: true,
      }))
      const { error } = await supabase.from('onboarding_lab_requirements').insert(testRecords)
      if (error) throw error
    } catch (e) {
      console.error('Failed to save lab requirements:', e)
    }
  }

  const handleView = (c: Customer) => {
    setViewData(c)
    setIsViewOpen(true)
  }

  const handleEdit = (c: Customer) => {
    setEditId(c.id)
    setEditForm({
      company_name: c.name || '',
      contact_person: c.contact || '',
      email: c.email || '',
      phone: c.phone || '',
      website: c.website || '',
      address: c.address || '',
      comments: c.comments || '',
      status: c.status || 'Active',
    })
    setIsEditOpen(true)
  }

  const handleDelete = async (c: Customer) => {
    if (!c?.id) return
    // open confirmation modal
    setDeleteTarget(c)
    setIsDeleteOpen(true)
  }

  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setIsStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = customers.filter((c) => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q)
    )
  })
  .filter((c) => {
    if (statusFilter === 'All') return true
    const st = (c.status || 'Active').toLowerCase()
    return statusFilter === 'Active' ? st === 'active' : st === 'inactive'
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20 overflow-x-hidden">
      <div className="p-2 sm:p-4 lg:p-6 max-w-full">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-dark mb-1">Customers</h1>
            </div>
            {canManageCustomers && (
              <button 
                onClick={() => { setIsAddOpen(true); setSelectedProductIds([]) }}
                className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                Add Customer
              </button>
            )}
            {!canViewCustomers && !roleLoading && (
              <div className="text-sm text-neutral-medium">
                Access restricted to authorized roles only.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-accent-danger/30 bg-accent-danger/10 text-accent-danger">
            {error}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteOpen && deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setIsDeleteOpen(false)}></div>
            <div className="relative z-10 w-full max-w-sm sm:max-w-lg bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-neutral-dark">Delete Customer</h2>
                <p className="text-xs sm:text-sm text-neutral-medium mt-1">This action cannot be undone.</p>
              </div>
              <div className="p-4 sm:p-6 lg:p-8">
                <p className="text-sm sm:text-base text-neutral-dark">Are you sure you want to delete "<span className="font-semibold">{deleteTarget.name}</span>"?</p>
                <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-3">
                  <button
                    className="w-full sm:w-auto px-4 sm:px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all disabled:opacity-60 text-sm sm:text-base"
                    onClick={() => !deleting && setIsDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="w-full sm:w-auto px-4 sm:px-5 py-2.5 rounded-xl bg-accent-danger text-white font-semibold hover:opacity-90 shadow-md disabled:opacity-60 text-sm sm:text-base"
                    onClick={async () => {
                      if (!deleteTarget?.id || deleting) return
                      setDeleting(true)
                      try {
                        const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id)
                        if (error) throw error
                        setCustomers((prev) => prev.filter((x) => x.id !== deleteTarget.id))
                        setIsDeleteOpen(false)
                        setDeleteTarget(null)
                        setToast({ show: true, message: 'Customer deleted successfully' })
                      } catch (e: any) {
                        setError(e?.message || 'Failed to delete customer')
                      } finally {
                        setDeleting(false)
                      }
                    }}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
            <div className="flex-1">
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-2">
                Search Customers
              </label>
              <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-neutral-medium" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium text-sm sm:text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="lg:w-64 relative" ref={statusRef}>
              <label className="flex items-center text-sm font-semibold text-neutral-dark mb-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 text-primary-medium" />
                Filter & Sort
              </label>
              <button
                type="button"
                onClick={() => setIsStatusOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border border-neutral-soft rounded-xl text-left bg-white transition-all shadow-sm hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light hover:shadow-md text-sm sm:text-base"
              >
                <span className={statusFilter === 'All' ? 'text-neutral-medium' : 'text-neutral-dark'}>
                  {statusFilter === 'All' ? 'All Segments' : statusFilter}
                </span>
                <span className="ml-2 text-neutral-medium">▼</span>
              </button>
              {isStatusOpen && (
                <div className="absolute left-0 right-0 z-[100] mt-2 w-full bg-white border border-neutral-soft rounded-xl shadow-xl max-h-56 overflow-auto">
                  <div className="px-3 py-2 text-xs text-neutral-medium">Select Status</div>
                  {(['All','Active','Inactive'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`block w-full text-left px-4 py-2 hover:bg-neutral-light ${statusFilter===opt ? 'bg-neutral-light' : ''}`}
                      onClick={() => { setStatusFilter(opt); setIsStatusOpen(false) }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Success Toast */}
        {toast.show && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70]">
            <div className="flex items-center gap-3 bg-white rounded-xl shadow-2xl border border-neutral-soft/40 px-4 py-3 animate-fade-in">
              <div className="w-8 h-8 bg-accent-success/15 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-accent-success" />
              </div>
              <span className="text-sm font-semibold text-neutral-dark">{toast.message}</span>
            </div>
          </div>
        )}

        {/* View Details Modal */}
        {isViewOpen && viewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsViewOpen(false)}></div>
            <div className="relative z-10 w-full max-w-sm sm:max-w-2xl lg:max-w-3xl bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
              <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-neutral-dark">View Details</h2>
                  <p className="text-xs sm:text-sm text-neutral-medium mt-1">Customer information overview</p>
                </div>
                <button onClick={() => setIsViewOpen(false)} className="p-2 sm:p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">✕</button>
              </div>
              <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Users className="h-4 w-4 mr-2 text-primary-medium" /> Name
                    </label>
                    <div className="text-neutral-dark font-semibold">{viewData.name || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <User className="h-4 w-4 mr-2 text-primary-medium" /> Contact
                    </label>
                    <div className="text-neutral-dark">{viewData.contact || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Mail className="h-4 w-4 mr-2 text-primary-medium" /> Email
                    </label>
                    <div className="text-neutral-dark">{viewData.email || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Phone className="h-4 w-4 mr-2 text-primary-medium" /> Phone
                    </label>
                    <div className="text-neutral-dark">{viewData.phone || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <Globe className="h-4 w-4 mr-2 text-primary-medium" /> Website
                    </label>
                    <div className="text-neutral-dark break-words">{viewData.website || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center text-xs font-semibold text-neutral-medium uppercase tracking-wide">
                      <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" /> Status
                    </label>
                    <div>
                      <span
                        className={
                          `inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ` +
                          ((viewData.status || 'Active').toLowerCase() === 'inactive'
                            ? 'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
                            : 'bg-accent-success/10 text-accent-success border-accent-success/30')
                        }
                      >
                        {viewData.status || 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setIsViewOpen(false)} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all text-sm sm:text-base">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Customer Modal */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !isEditing && setIsEditOpen(false)}></div>
            <div className="relative z-10 w-full max-w-sm sm:max-w-2xl lg:max-w-5xl h-[95vh] sm:h-[90vh] lg:h-[80vh] bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-neutral-dark">Edit Customer</h2>
                  <p className="text-xs sm:text-sm text-neutral-medium mt-1">Update customer information</p>
                </div>
                <button onClick={() => !isEditing && setIsEditOpen(false)} className="p-2 sm:p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (isEditing || !editId) return
                    setIsEditing(true)
                    try {
                      const payload: any = {
                        company_name: editForm.company_name,
                        contact_person: editForm.contact_person || null,
                        email: editForm.email || null,
                        phone: editForm.phone || null,
                        website: editForm.website || null,
                        address: editForm.address || null,
                        comments: editForm.comments || null,
                        status: editForm.status || 'Active',
                      }
                      const { error } = await supabase.from('customers').update(payload).eq('id', editId)
                      if (error) throw error
                      await refresh()
                      setIsEditOpen(false)
                      setToast({ show: true, message: 'Customer updated successfully' })
                    } catch (e: any) {
                      setError(e?.message || 'Failed to update customer')
                    } finally {
                      setIsEditing(false)
                    }
                  }}
                  className="p-4 sm:p-6 space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Building2 className="h-4 w-4 mr-2 text-primary-medium" />
                        Company Name<span className="text-accent-danger ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.company_name}
                        onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                        placeholder="e.g., ABC Foods Inc."
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <User className="h-4 w-4 mr-2 text-primary-medium" />
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={editForm.contact_person}
                        onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                        placeholder="e.g., John Dela Cruz"
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Mail className="h-4 w-4 mr-2 text-primary-medium" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="john@company.com"
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Phone className="h-4 w-4 mr-2 text-primary-medium" />
                        Phone
                      </label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="+1 900 000 0000"
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <Globe className="h-4 w-4 mr-2 text-primary-medium" />
                        Website
                      </label>
                      <input
                        type="url"
                        value={editForm.website}
                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">
                        <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" />
                        Status
                      </label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark hover:border-neutral-medium text-sm sm:text-base"
                      >
                        <option>Active</option>
                        <option>Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <MapPin className="h-4 w-4 mr-2 text-primary-medium" />
                      Address
                    </label>
                    <textarea
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      placeholder="Street, City, Country"
                      className="w-full min-h-[60px] sm:min-h-[80px] px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium text-sm sm:text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-sm font-semibold text-neutral-dark">
                      <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                      Comments
                    </label>
                    <textarea
                      value={editForm.comments}
                      onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })}
                      placeholder="Additional notes about this customer"
                      className="w-full min-h-[60px] sm:min-h-[80px] px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium text-sm sm:text-base"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md disabled:opacity-60"
                      disabled={isEditing}
                    >
                      {isEditing ? 'Updating...' : 'Update'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Add Customer Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !isSubmitting && setIsAddOpen(false)}></div>
            <div className="relative z-10 w-full max-w-sm sm:max-w-2xl lg:max-w-5xl h-[95vh] sm:h-[90vh] lg:h-[80vh] bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              {onboardingType === 'DILLYS' ? (
                <div className="flex items-center justify-between px-6 py-6 bg-gradient-to-r from-primary-dark via-primary-medium to-primary-light border-b border-neutral-soft/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white">Dilly&apos;s Customer Registration</h2>
                      <p className="text-white/90 text-sm sm:text-base mt-1">Complete customer information and manufacturing requirements</p>
                    </div>
                  </div>
                  <button onClick={() => {
                  setIsAddOpen(false)
                  setCustomerId(null)
                  setOnboardingId(null)
                  setOnboardingNotes('')
                  setAddForm({ company_name: '', contact_person: '', email: '', phone: '', website: '', address: '', comments: '', status: 'Active' })
                }} className="p-2 sm:p-3 text-white/90 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200 hover:shadow-sm">✕</button>
                </div>
              ) : onboardingType === 'BNUTTY' ? (
                <div className="flex items-center justify-between px-6 py-6 bg-gradient-to-r from-primary-dark via-primary-medium to-primary-light border-b border-neutral-soft/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white">BNutty Customer Registration</h2>
                      <p className="text-white/90 text-sm sm:text-base mt-1">Complete customer information and manufacturing requirements</p>
                    </div>
                  </div>
                  <button onClick={() => {
                    setIsAddOpen(false)
                    setCustomerId(null)
                    setOnboardingId(null)
                    setOnboardingNotes('')
                    setAddForm({ company_name: '', contact_person: '', email: '', phone: '', website: '', address: '', comments: '', status: 'Active' })
                  }} className="p-2 sm:p-3 text-white/90 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200 hover:shadow-sm">✕</button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-neutral-dark">New Customer Onboarding Form</h2>
                    <p className="text-xs sm:text-sm text-neutral-medium mt-1">Customer information and manufacturing onboarding (single form)</p>
                  </div>
                  <button onClick={() => {
                    setIsAddOpen(false)
                    setCustomerId(null)
                    setOnboardingId(null)
                    setOnboardingNotes('')
                    setAddForm({ company_name: '', contact_person: '', email: '', phone: '', website: '', address: '', comments: '', status: 'Active' })
                  }} className="p-2 sm:p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">✕</button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                <div className={onboardingType === 'DILLYS' || onboardingType === 'BNUTTY' ? 'p-6 sm:p-8 space-y-8' : 'p-4 sm:p-6 space-y-8'}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="inline-flex items-center gap-3">
                      <span className="text-sm font-semibold text-neutral-dark">Onboarding Type</span>
                      <select
                        value={onboardingType}
                        onChange={(e) => setOnboardingType(e.target.value as 'DILLYS' | 'BNUTTY')}
                        className="px-3 sm:px-4 py-2 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                      >
                        <option value="DILLYS">Dilly's</option>
                        <option value="BNUTTY">BNutty</option>
                      </select>
                      <span className="text-xs text-neutral-medium">(BNutty enables Allergens section)</span>
                    </div>
                    <div className="text-xs text-neutral-medium">
                      {customerId ? `Customer: ${addForm.company_name}` : 'Customer not yet saved'}
                    </div>
                  </div>

                  {/* Customer Information */}
                  {onboardingType === 'DILLYS' || onboardingType === 'BNUTTY' ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                      <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                        <h3 className="text-base font-semibold text-neutral-dark">Customer Information</h3>
                      </div>
                      <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <Building2 className="h-4 w-4 mr-2 text-primary-medium" />
                              Company Name<span className="text-accent-danger ml-1">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={addForm.company_name}
                              onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })}
                              placeholder="e.g., ABC Foods Inc."
                              className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <User className="h-4 w-4 mr-2 text-primary-medium" />
                              Contact Person
                            </label>
                            <input
                              type="text"
                              value={addForm.contact_person}
                              onChange={(e) => setAddForm({ ...addForm, contact_person: e.target.value })}
                              placeholder="e.g., John Dela Cruz"
                              className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <Mail className="h-4 w-4 mr-2 text-primary-medium" />
                              Email
                            </label>
                            <input
                              type="email"
                              value={addForm.email}
                              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                              placeholder="john@company.com"
                              className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <Phone className="h-4 w-4 mr-2 text-primary-medium" />
                              Phone
                            </label>
                            <input
                              type="text"
                              value={addForm.phone}
                              onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                              placeholder="+63 900 000 0000"
                              className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <Globe className="h-4 w-4 mr-2 text-primary-medium" />
                              Website
                            </label>
                            <input
                              type="url"
                              value={addForm.website}
                              onChange={(e) => setAddForm({ ...addForm, website: e.target.value })}
                              placeholder="https://example.com"
                              className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" />
                              Status
                            </label>
                            <select
                              value={addForm.status}
                              onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                              className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark hover:border-neutral-medium"
                            >
                              <option>Active</option>
                              <option>Inactive</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-semibold text-neutral-dark">
                            <MapPin className="h-4 w-4 mr-2 text-primary-medium" />
                            Address
                          </label>
                          <textarea
                            value={addForm.address}
                            onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                            placeholder="Street, City, Country"
                            rows={3}
                            className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-semibold text-neutral-dark">
                            <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                            Comments
                          </label>
                          <textarea
                            value={addForm.comments}
                            onChange={(e) => setAddForm({ ...addForm, comments: e.target.value })}
                            placeholder="Additional notes about this customer"
                            rows={3}
                            className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                        <h3 className="text-sm sm:text-base font-semibold text-neutral-dark">Customer Information</h3>
                      </div>
                      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <Building2 className="h-4 w-4 mr-2 text-primary-medium" />
                              Company Name<span className="text-accent-danger ml-1">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={addForm.company_name}
                              onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })}
                              placeholder="e.g., ABC Foods Inc."
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <User className="h-4 w-4 mr-2 text-primary-medium" />
                              Contact Person
                            </label>
                            <input
                              type="text"
                              value={addForm.contact_person}
                              onChange={(e) => setAddForm({ ...addForm, contact_person: e.target.value })}
                              placeholder="e.g., John Dela Cruz"
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <Mail className="h-4 w-4 mr-2 text-primary-medium" />
                              Email
                            </label>
                            <input
                              type="email"
                              value={addForm.email}
                              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                              placeholder="john@company.com"
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <Phone className="h-4 w-4 mr-2 text-primary-medium" />
                              Phone
                            </label>
                            <input
                              type="text"
                              value={addForm.phone}
                              onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                              placeholder="+1 900 000 0000"
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <Globe className="h-4 w-4 mr-2 text-primary-medium" />
                              Website
                            </label>
                            <input
                              type="url"
                              value={addForm.website}
                              onChange={(e) => setAddForm({ ...addForm, website: e.target.value })}
                              placeholder="https://example.com"
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium hover:border-neutral-medium text-sm sm:text-base"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-semibold text-neutral-dark">
                              <BadgeCheck className="h-4 w-4 mr-2 text-primary-medium" />
                              Status
                            </label>
                            <select
                              value={addForm.status}
                              onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark hover:border-neutral-medium text-sm sm:text-base"
                            >
                              <option>Active</option>
                              <option>Inactive</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-semibold text-neutral-dark">
                            <MapPin className="h-4 w-4 mr-2 text-primary-medium" />
                            Address
                          </label>
                          <textarea
                            value={addForm.address}
                            onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                            placeholder="Street, City, Country"
                            className="w-full min-h-[60px] sm:min-h-[80px] px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium text-sm sm:text-base"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-semibold text-neutral-dark">
                            <FileText className="h-4 w-4 mr-2 text-primary-medium" />
                            Comments
                          </label>
                          <textarea
                            value={addForm.comments}
                            onChange={(e) => setAddForm({ ...addForm, comments: e.target.value })}
                            placeholder="Additional notes about this customer"
                            className="w-full min-h-[60px] sm:min-h-[80px] px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium text-sm sm:text-base"
                          />
                        </div>

                        {/* Products multi-select (UI-only) - Only for BNutty */}
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-semibold text-neutral-dark">
                            <Package className="h-4 w-4 mr-2 text-primary-medium" />
                            Products
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 max-h-32 sm:max-h-48 overflow-auto border border-neutral-soft rounded-lg p-2 sm:p-3 bg-white">
                            {allProducts.length === 0 ? (
                              <div className="text-xs text-neutral-medium">No products found.</div>
                            ) : (
                              allProducts.map(p => (
                                <label key={p.id} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 text-primary-dark focus:ring-primary-light border-neutral-soft rounded"
                                    checked={selectedProductIds.includes(p.id)}
                                    onChange={(e) => {
                                      setSelectedProductIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))
                                    }}
                                  />
                                  <span className="text-xs sm:text-sm text-neutral-dark">{p.name}</span>
                                </label>
                              ))
                            )}
                          </div>
                          <p className="text-xs text-neutral-medium">UI-only: selections are kept in this form but are not saved to the server.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Onboarding Sections (same modal, same page) */}
                  {onboardingType === 'DILLYS' ? (
                    <div className="space-y-8">
                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <Package className="h-5 w-5 mr-2 text-primary-medium" />
                            Products & Specifications
                          </h3>
                        </div>
                        <div className="p-6">
                          <ProductsTab onboardingId={onboardingId} />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <Box className="h-5 w-5 mr-2 text-primary-medium" />
                            Packaging Configuration
                          </h3>
                        </div>
                        <div className="p-6">
                          <PackagingTab onboardingId={onboardingId} />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <Leaf className="h-5 w-5 mr-2 text-primary-medium" />
                            Ingredients & Vendors
                          </h3>
                        </div>
                        <div className="p-6">
                          <IngredientsTab onboardingId={onboardingId} />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <FlaskConical className="h-5 w-5 mr-2 text-primary-medium" />
                            Lab / QA Requirements
                          </h3>
                        </div>
                        <div className="p-6">
                          <LabQATab selectedTests={selectedLabTests} setSelectedTests={setSelectedLabTests} />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <FileUp className="h-5 w-5 mr-2 text-primary-medium" />
                            Documents
                          </h3>
                        </div>
                        <div className="p-6">
                          <DocumentsTab onboardingId={onboardingId} />
                        </div>
                      </div>
                    </div>
                  ) : onboardingType === 'BNUTTY' ? (
                    <div className="space-y-8">
                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <Package className="h-5 w-5 mr-2 text-primary-medium" />
                            Products & Specifications
                          </h3>
                        </div>
                        <div className="p-6">
                          <ProductsTab onboardingId={onboardingId} />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <Box className="h-5 w-5 mr-2 text-primary-medium" />
                            Packaging Configuration
                          </h3>
                        </div>
                        <div className="p-6">
                          <PackagingTab onboardingId={onboardingId} />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <Leaf className="h-5 w-5 mr-2 text-primary-medium" />
                            Ingredients & Vendors
                          </h3>
                        </div>
                        <div className="p-6">
                          <IngredientsTab onboardingId={onboardingId} />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <AlertTriangle className="h-5 w-5 mr-2 text-primary-medium" />
                            Allergens Matrix
                          </h3>
                        </div>
                        <div className="p-6">
                          <AllergensTab onboardingId={onboardingId} />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <FlaskConical className="h-5 w-5 mr-2 text-primary-medium" />
                            Lab / QA Requirements
                          </h3>
                        </div>
                        <div className="p-6">
                          <LabQATab selectedTests={selectedLabTests} setSelectedTests={setSelectedLabTests} />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                          <h3 className="text-base font-semibold text-neutral-dark flex items-center">
                            <FileUp className="h-5 w-5 mr-2 text-primary-medium" />
                            Documents
                          </h3>
                        </div>
                        <div className="p-6">
                          <DocumentsTab onboardingId={onboardingId} />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="bg-white rounded-2xl shadow-sm border border-neutral-soft/20 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/30">
                      <h3 className="text-base font-semibold text-neutral-dark">Notes / Special Instructions</h3>
                    </div>
                    <div className="p-6">
                      <textarea
                        value={onboardingNotes}
                        onChange={(e) => setOnboardingNotes(e.target.value)}
                        className="w-full min-h-[100px] px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all bg-white text-neutral-dark placeholder-neutral-medium resize-none hover:border-neutral-medium"
                        placeholder="Any special instructions for production, labeling, packaging, etc."
                      />
                    </div>
                  </div>

                  {/* Footer Actions (Cancel + Submit) */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-neutral-medium">
                      {onboardingId ? `Onboarding ID: ${onboardingId}` : 'Click Save Draft to create onboarding and enable saving rows.'}
                    </div>
                    <div className="flex items-center gap-3">
                      {(onboardingType === 'DILLYS' || onboardingType === 'BNUTTY') ? (
                        <>
                          <button
                            type="button"
                            onClick={() => !isSubmitting && setIsAddOpen(false)}
                            className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light/40 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (isSubmitting) return
                              setIsSubmitting(true)
                              try {
                                let ensuredCustomerId = customerId
                                if (!ensuredCustomerId) {
                                  const payload: any = {
                                    company_name: addForm.company_name,
                                    contact_person: addForm.contact_person || null,
                                    email: addForm.email || null,
                                    phone: addForm.phone || null,
                                    website: addForm.website || null,
                                    address: addForm.address || null,
                                    comments: addForm.comments || null,
                                    status: addForm.status || 'Active',
                                  }
                                  const { data, error } = await supabase.from('customers').insert(payload).select('id').single()
                                  if (error) throw error
                                  ensuredCustomerId = data.id
                                  setCustomerId(ensuredCustomerId)
                                }
                                let ensuredOnboardingId = onboardingId
                                if (!ensuredOnboardingId) {
                                  const { data: onboardingData, error: onboardingError } = await supabase
                                    .from('customer_onboardings')
                                    .insert({ customer_id: ensuredCustomerId, onboarding_type: onboardingType, status: 'Submitted', notes: onboardingNotes || null })
                                    .select('id')
                                    .single()
                                  if (onboardingError) throw onboardingError
                                  ensuredOnboardingId = onboardingData.id
                                  setOnboardingId(ensuredOnboardingId)
                                } else {
                                  const { error: updErr } = await supabase.from('customer_onboardings').update({ status: 'Submitted', onboarding_type: onboardingType, notes: onboardingNotes || null }).eq('id', ensuredOnboardingId)
                                  if (updErr) throw updErr
                                }

                                if (!ensuredOnboardingId) throw new Error('Missing onboardingId')
                                await saveLabRequirementsForOnboarding(ensuredOnboardingId)
                                await refresh()
                                setToast({ show: true, message: 'Onboarding submitted successfully' })
                                setIsAddOpen(false)
                                setCustomerId(null)
                                setOnboardingId(null)
                                setOnboardingNotes('')
                                setSelectedLabTests([])
                                setAddForm({ company_name: '', contact_person: '', email: '', phone: '', website: '', address: '', comments: '', status: 'Active' })
                              } catch (e: any) {
                                setError(e?.message || 'Failed to submit onboarding')
                              } finally {
                                setIsSubmitting(false)
                              }
                            }}
                            className="px-6 py-2 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md disabled:opacity-60"
                            disabled={isSubmitting}
                          >
                            Submit Form
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={async () => {
                              if (isSubmitting) return
                              setIsSubmitting(true)
                              try {
                                let ensuredCustomerId = customerId
                                if (!ensuredCustomerId) {
                                  const payload: any = {
                                    company_name: addForm.company_name,
                                    contact_person: addForm.contact_person || null,
                                    email: addForm.email || null,
                                    phone: addForm.phone || null,
                                    website: addForm.website || null,
                                    address: addForm.address || null,
                                    comments: addForm.comments || null,
                                    status: addForm.status || 'Active',
                                  }
                                  const { data, error } = await supabase.from('customers').insert(payload).select('id').single()
                                  if (error) throw error
                                  ensuredCustomerId = data.id
                                  setCustomerId(ensuredCustomerId)
                                }
                                let ensuredOnboardingId = onboardingId
                                if (!ensuredOnboardingId) {
                                  const { data: onboardingData, error: onboardingError } = await supabase
                                    .from('customer_onboardings')
                                    .insert({ customer_id: ensuredCustomerId, onboarding_type: onboardingType, status: 'Draft', notes: onboardingNotes || null })
                                    .select('id')
                                    .single()
                                  if (onboardingError) throw onboardingError
                                  ensuredOnboardingId = onboardingData.id
                                  setOnboardingId(ensuredOnboardingId)
                                } else {
                                  const { error: updErr } = await supabase.from('customer_onboardings').update({ status: 'Draft', onboarding_type: onboardingType, notes: onboardingNotes || null }).eq('id', ensuredOnboardingId)
                                  if (updErr) throw updErr
                                }
                                setToast({ show: true, message: 'Draft saved successfully' })
                              } catch (e: any) {
                                setError(e?.message || 'Failed to save draft')
                              } finally {
                                setIsSubmitting(false)
                              }
                            }}
                            className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all disabled:opacity-60"
                            disabled={isSubmitting}
                          >
                            Save Draft
                          </button>
                          <button
                            onClick={async () => {
                              if (isSubmitting) return
                              setIsSubmitting(true)
                              try {
                                let ensuredCustomerId = customerId
                                if (!ensuredCustomerId) {
                                  const payload: any = {
                                    company_name: addForm.company_name,
                                    contact_person: addForm.contact_person || null,
                                    email: addForm.email || null,
                                    phone: addForm.phone || null,
                                    website: addForm.website || null,
                                    address: addForm.address || null,
                                    comments: addForm.comments || null,
                                    status: addForm.status || 'Active',
                                  }
                                  const { data, error } = await supabase.from('customers').insert(payload).select('id').single()
                                  if (error) throw error
                                  ensuredCustomerId = data.id
                                  setCustomerId(ensuredCustomerId)
                                }
                                let ensuredOnboardingId = onboardingId
                                if (!ensuredOnboardingId) {
                                  const { data: onboardingData, error: onboardingError } = await supabase
                                    .from('customer_onboardings')
                                    .insert({ customer_id: ensuredCustomerId, onboarding_type: onboardingType, status: 'Submitted', notes: onboardingNotes || null })
                                    .select('id')
                                    .single()
                                  if (onboardingError) throw onboardingError
                                  ensuredOnboardingId = onboardingData.id
                                  setOnboardingId(ensuredOnboardingId)
                                } else {
                                  const { error: updErr } = await supabase.from('customer_onboardings').update({ status: 'Submitted', onboarding_type: onboardingType, notes: onboardingNotes || null }).eq('id', ensuredOnboardingId)
                                  if (updErr) throw updErr
                                }
                                await refresh()
                                setToast({ show: true, message: 'Onboarding submitted successfully' })
                                setIsAddOpen(false)
                                setCustomerId(null)
                                setOnboardingId(null)
                                setOnboardingNotes('')
                                setAddForm({ company_name: '', contact_person: '', email: '', phone: '', website: '', address: '', comments: '', status: 'Active' })
                              } catch (e: any) {
                                setError(e?.message || 'Failed to submit onboarding')
                              } finally {
                                setIsSubmitting(false)
                              }
                            }}
                            className="px-6 py-2 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md disabled:opacity-60"
                            disabled={isSubmitting}
                          >
                            Submit Form
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table + Empty State (Products-style header) */}
        <div className="bg-white rounded-xl shadow-md border border-neutral-soft/30 overflow-hidden">
          {/* Gradient header section */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-neutral-dark mb-1">Customer Directory</h3>
              </div>
              
            </div>
          </div>
          {/* Column headers */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                  <th className="px-3 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-6 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Users className="h-3 w-3 sm:h-4 sm:w-4 text-primary-medium" />
                      <span>Name</span>
                    </div>
                  </th>
                  <th className="hidden sm:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary-medium" />
                      <span>Contact</span>
                    </div>
                  </th>
                  <th className="hidden md:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-primary-medium" />
                      <span>Email</span>
                    </div>
                  </th>
                  <th className="hidden lg:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-primary-medium" />
                      <span>Phone</span>
                    </div>
                  </th>
                  <th className="hidden xl:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-primary-medium" />
                      <span>Website</span>
                    </div>
                  </th>
                  <th className="px-3 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-6 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <BadgeCheck className="h-3 w-3 sm:h-4 sm:w-4 text-primary-medium" />
                      <span>Status</span>
                    </div>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-soft/20">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-3 sm:px-4 py-3 sm:py-4 text-center text-neutral-medium text-sm sm:text-base">Loading customers…</td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 sm:px-4 py-3 sm:py-4 text-center text-neutral-medium text-sm sm:text-base">No customers found</td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id} className="group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm">
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-neutral-light/60 rounded-lg flex items-center justify-center shadow-sm">
                          <Users className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-primary-dark" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-semibold text-neutral-dark truncate">{c.name || '—'}</div>
                          <div className="sm:hidden text-xs text-neutral-medium truncate">{c.contact || c.email || '—'}</div>
                          {c.website && <div className="hidden sm:block text-xs text-neutral-medium truncate">{c.website}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <div className="text-xs sm:text-sm font-medium text-neutral-dark">{c.contact || '—'}</div>
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <div className="text-xs sm:text-sm text-neutral-dark truncate">{c.email || '—'}</div>
                    </td>
                    <td className="hidden lg:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <div className="text-xs sm:text-sm text-neutral-dark">{c.phone || '—'}</div>
                    </td>
                    <td className="hidden xl:table-cell px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <div className="text-xs sm:text-sm text-neutral-dark truncate max-w-[180px]">{c.website || '—'}</div>
                    </td>
                    <td className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                      <span
                        className={
                          `inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-semibold border ` +
                          ((c.status || 'Active').toLowerCase() === 'inactive'
                            ? 'bg-accent-danger/10 text-accent-danger border-accent-danger/30'
                            : 'bg-accent-success/10 text-accent-success border-accent-success/30')
                        }
                      >
                        {c.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                      <div className="flex items-center justify-center space-x-1">
                        <button type="button" onClick={() => handleView(c)} className="group/btn p-1.5 sm:p-2 text-primary-medium hover:text-white hover:bg-primary-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium">
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                        {canManageCustomers && (
                          <button type="button" onClick={() => handleEdit(c)} className="group/btn p-1.5 sm:p-2 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft hover:border-neutral-medium">
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        )}
                        {canManageCustomers && (
                          <button type="button" onClick={() => handleDelete(c)} className="group/btn p-1.5 sm:p-2 text-accent-danger hover:text-white hover:bg-accent-danger rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 border border-accent-danger/30 hover:border-accent-danger">
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && (
            <div className="p-8 sm:p-12 lg:p-16 text-center">
              <p className="text-neutral-medium mb-4">No customers found</p>
              <button 
                onClick={() => { setIsAddOpen(true); setSelectedProductIds([]) }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md"
              >
                Add Your First Customer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Customers
