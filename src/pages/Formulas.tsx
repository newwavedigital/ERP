import React, { useEffect, useState } from "react";
import { Plus, Inbox, X, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type Product = { id: string; product_name: string };
type Material = { id: string; product_name: string; unit_of_measure: string };
type Customer = { id: string; company_name: string };

type Ingredient = {
  material_id: string;
  qty: string;
  uom: string;
  percentage: string;
};

const emptyIngredient: Ingredient = {
  material_id: "",
  qty: "",
  uom: "",
  percentage: "",
};

interface FormulasProps { openSignal?: number; embedded?: boolean }

const Formulas: React.FC<FormulasProps> = ({ openSignal, embedded = false }) => {
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [formulasList, setFormulasList] = useState<any[]>([]); // ✅ FOR DISPLAYING FORMULAS

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    product_id: "",
    customer_id: "",
    comments: "",
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { ...emptyIngredient },
  ]);

  const resetForm = () => {
    setForm({ product_id: "", customer_id: "", comments: "" });
    setIngredients([{ ...emptyIngredient }]);
  };

  const addIngredient = () =>
    setIngredients((prev) => [...prev, { ...emptyIngredient }]);

  const removeIngredient = (idx: number) =>
    setIngredients((prev) => prev.filter((_, i) => i !== idx));

  const updateIngredient = (idx: number, patch: Partial<Ingredient>) =>
    setIngredients((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );

  /* ✅ 1. LOAD PRODUCTS, MATERIALS, CUSTOMERS */
  useEffect(() => {
    const load = async () => {
      const [{ data: p }, { data: m }, { data: c }] = await Promise.all([
        supabase.from("products").select("id, product_name"),
        supabase
          .from("inventory_materials")
          .select("id, product_name, unit_of_measure"),
        supabase.from("customers").select("id, company_name"),
      ]);

      setProducts(p || []);
      setMaterials(m || []);
      setCustomersList(c || []);
    };
    load();
  }, []);

  // Allow parent header button to open modal
  useEffect(() => {
    if (typeof openSignal === 'number' && openSignal > 0) {
      setIsAddOpen(true);
    }
  }, [openSignal]);

  /* ✅ 2. LOAD FORMULAS FOR DISPLAY */
  const loadFormulas = async () => {
    const { data, error } = await supabase
      .from("formulas")
      .select(`
        id,
        formula_name,
        version,
        created_at,
        products:formulas_product_id_fkey ( product_name ),
        customers:formulas_customer_id_fkey ( company_name )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error loading formulas:", error);
      return;
    }

    setFormulasList(data || []);
  };

  useEffect(() => {
    loadFormulas();
  }, []);

  /* ✅ 2b. REALTIME: auto-refresh list on any INSERT/UPDATE/DELETE in formulas */
  useEffect(() => {
    const channel = supabase
      ?.channel('rt-formulas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'formulas' }, () => {
        // Safer: reload full list to include joined product/customer names
        loadFormulas();
      })
      .subscribe();
    return () => { if (channel) supabase?.removeChannel(channel); };
  }, []);

  /* ✅ 3. CREATE FORMULA */
  const handleCreate = async () => {
    try {
      if (!form.product_id || !form.customer_id) return;
      setSaving(true);

      const selectedProduct = products.find(
        (p) => p.id === form.product_id
      )?.product_name;

      const { data: fdata, error: ferr } = await supabase
        .from("formulas")
        .insert([
          {
            product_id: form.product_id,
            customer_id: form.customer_id,
            formula_name: `${selectedProduct} Formula`,
            comments: form.comments,
            version: 1,
          },
        ])
        .select()
        .single();

      if (ferr) {
        console.warn("Formula insert error:", ferr);
        setSaving(false);
        return;
      }

      const formulaId = fdata.id;

      // ✅ Build formula items (ingredients)
      const items = ingredients
        .filter((r) => r.material_id)
        .map((r) => ({
          formula_id: formulaId,
          material_id: r.material_id,
          qty_per_unit: r.qty ? Number(r.qty) : null,
          uom: r.uom || null,
          percentage: r.percentage ? Number(r.percentage) : null,
        }));

      if (items.length > 0) {
        const { error: ierr } = await supabase
          .from("formula_items")
          .insert(items);

        if (ierr) console.warn("Ingredient insert error:", ierr);
      }

      // Optimistic add to list so user sees result instantly (no full reload needed)
      setFormulasList(prev => [{
        ...fdata,
        products: { product_name: selectedProduct || '' },
        customers: { company_name: customersList.find(c=>c.id===form.customer_id)?.company_name || '' },
      }, ...prev]);

      resetForm();
      setIsAddOpen(false);
    } catch (e) {
      console.warn("Unexpected:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? "" : "min-h-screen bg-neutral-light/20"}>
      <div className={embedded ? "" : "p-8"}>
        {/* HEADER (hidden when embedded) */}
        {!embedded && (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-dark">
                Formula Manager
              </h1>
              <p className="text-neutral-medium">
                Manage product recipes and bills of materials
              </p>
            </div>

            <button
              onClick={() => setIsAddOpen(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md hover:shadow-lg flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Formula
            </button>
          </div>
        )}

        {/* ✅ DISPLAY FORMULA LIST IF AVAILABLE */}
        {formulasList.length > 0 ? (
          <div className="mt-10 bg-white rounded-xl shadow border border-neutral-soft p-6">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-neutral-medium border-b">
                  <th className="py-3">Formula Name</th>
                  <th className="py-3">Product</th>
                  <th className="py-3">Customer</th>
                  <th className="py-3">Version</th>
                  <th className="py-3">Created</th>
                </tr>
              </thead>

              <tbody>
                {formulasList.map((f) => (
                  <tr key={f.id} className="border-b text-sm">
                    <td className="py-3">{f.formula_name}</td>
                    <td className="py-3">{f.products?.product_name}</td>
                    <td className="py-3">{f.customers?.company_name}</td>
                    <td className="py-3">{f.version}</td>
                    <td className="py-3">
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ✅ EMPTY STATE */
          <div className="flex flex-col items-center justify-center text-center mt-16">
            <Inbox className="h-14 w-14 text-neutral-medium/40 mb-3" />
            <div className="text-neutral-dark font-semibold">
              No formulas found
            </div>
            <p className="text-sm text-neutral-medium">
              Create product formulas to enable accurate production planning.
            </p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="mt-4 px-5 py-2.5 rounded-lg bg-primary-medium hover:bg-primary-dark text-white text-sm font-medium shadow-sm"
            >
              Create Your First Formula
            </button>
          </div>
        )}

        {/* ✅ ADD FORMULA MODAL */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsAddOpen(false)}
            ></div>

            <div className="relative z-10 w-full max-w-6xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-neutral-light border-b border-neutral-soft/50">
                <h2 className="text-xl font-semibold text-neutral-dark">
                  Create New Formula
                </h2>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="p-2 text-neutral-medium hover:text-neutral-dark"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {/* PRODUCT + CUSTOMER */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-neutral-dark">
                      Product
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white"
                      value={form.product_id}
                      onChange={(e) =>
                        setForm({ ...form, product_id: e.target.value })
                      }
                    >
                      <option value="">Select Product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-neutral-dark">
                      Customer
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white"
                      value={form.customer_id}
                      onChange={(e) =>
                        setForm({ ...form, customer_id: e.target.value })
                      }
                    >
                      <option value="">Select Customer</option>
                      {customersList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* INGREDIENTS */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-dark">
                      Ingredients
                    </h3>

                    <button
                      type="button"
                      onClick={addIngredient}
                      className="px-3 py-2 rounded-lg bg-white border border-neutral-soft hover:border-neutral-medium text-sm text-neutral-dark shadow-sm"
                    >
                      Add Ingredient
                    </button>
                  </div>

                  {ingredients.map((ing, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-end"
                    >
                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">
                          Raw Material
                        </label>
                        <select
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg bg-white"
                          value={ing.material_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            const mat = materials.find(
                              (mm) => mm.id === val
                            );
                            updateIngredient(idx, {
                              material_id: val,
                              uom: mat?.unit_of_measure || "",
                            });
                          }}
                        >
                          <option value="">Select Material</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.product_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg bg-white"
                          placeholder="0"
                          value={ing.qty}
                          onChange={(e) =>
                            updateIngredient(idx, { qty: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">
                          Unit
                        </label>
                        <input
                          readOnly
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg bg-neutral-50 text-neutral-dark"
                          value={ing.uom}
                          placeholder="Auto"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">
                          %
                        </label>
                        <input
                          type="number"
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg bg-white"
                          placeholder="0-100"
                          value={ing.percentage}
                          onChange={(e) =>
                            updateIngredient(idx, {
                              percentage: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="flex justify-end pb-0">
                        <button
                          type="button"
                          onClick={() => removeIngredient(idx)}
                          className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-neutral-soft text-neutral-medium hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* COMMENTS */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-dark">
                    Comments
                  </label>
                  <textarea
                    className="w-full min-h-[100px] px-4 py-3 border border-neutral-soft rounded-lg bg-white resize-none"
                    placeholder="Additional notes..."
                    value={form.comments}
                    onChange={(e) =>
                      setForm({ ...form, comments: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* FOOTER */}
              <div className="px-8 py-5 bg-white border-t border-neutral-soft/60 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    resetForm();
                    setIsAddOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark bg-white hover:border-neutral-medium"
                >
                  Cancel
                </button>

                <button
                  disabled={saving || !form.product_id || !form.customer_id}
                  onClick={handleCreate}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Create Formula"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Formulas;
