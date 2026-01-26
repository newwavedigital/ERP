import React, { useEffect, useState } from "react";
import { Plus, Inbox, X, Trash2, Eye, Pencil } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
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
  const { user } = useAuth();
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const isSalesRepViewOnly = String(currentUserRole || '').toLowerCase() === 'sales_representative';
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesTarget, setNotesTarget] = useState<any | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewFormula, setViewFormula] = useState<any | null>(null);
  const [viewItems, setViewItems] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    product_name: "",
    customer_id: "",
    comments: "",
  });
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>([{ ...emptyIngredient }]);
  const [updating, setUpdating] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [formulasList, setFormulasList] = useState<any[]>([]); // ✅ FOR DISPLAYING FORMULAS

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    product_name: "",
    customer_id: "",
    comments: "",
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { ...emptyIngredient },
  ]);

  const resetForm = () => {
    setForm({ product_name: "", customer_id: "", comments: "" });
    setIngredients([{ ...emptyIngredient }]);
  };

  const openView = async (row: any) => {
    try {
      setIsViewOpen(true);
      setViewFormula(row);
      setViewItems([]);
      setViewLoading(true);
      const formulaId = String(row?.id || '');
      if (!formulaId) return;
      const { data: items } = await supabase
        .from('formula_items')
        .select(`id, material_id, qty_per_unit, uom, percentage, inventory_materials:material_id ( product_name, unit_of_measure )`)
        .eq('formula_id', formulaId)
        .order('created_at', { ascending: true });
      setViewItems(Array.isArray(items) ? items : []);
    } finally {
      setViewLoading(false);
    }
  };

  const openEdit = async (row: any) => {
    try {
      if (isSalesRepViewOnly) return;
      const formulaId = String(row?.id || '');
      setEditId(formulaId || null);
      setIsEditOpen(true);
      setEditForm({
        product_name: String(row?.formula_name || ''),
        customer_id: String(row?.customer_id || ''),
        comments: String(row?.comments || ''),
      });
      setEditIngredients([{ ...emptyIngredient }]);

      if (!formulaId) return;
      const { data: items } = await supabase
        .from('formula_items')
        .select('material_id, qty_per_unit, uom, percentage')
        .eq('formula_id', formulaId)
        .order('created_at', { ascending: true });
      const mapped: Ingredient[] = (items || []).map((it: any) => ({
        material_id: String(it?.material_id || ''),
        qty: (it?.qty_per_unit ?? '') === null ? '' : String(it?.qty_per_unit ?? ''),
        uom: String(it?.uom || ''),
        percentage: (it?.percentage ?? '') === null ? '' : String(it?.percentage ?? ''),
      }));
      setEditIngredients(mapped.length ? mapped : [{ ...emptyIngredient }]);
    } catch {
      setEditIngredients([{ ...emptyIngredient }]);
    }
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditId(null);
    setEditForm({ product_name: "", customer_id: "", comments: "" });
    setEditIngredients([{ ...emptyIngredient }]);
    setUpdating(false);
  };

  const handleUpdate = async () => {
    try {
      if (isSalesRepViewOnly) return;
      if (!editId) return;
      if (!editForm.product_name || !editForm.customer_id) return;
      setUpdating(true);
      const { error: upErr } = await supabase
        .from('formulas')
        .update({
          customer_id: editForm.customer_id,
          formula_name: editForm.product_name.trim(),
          comments: editForm.comments,
        })
        .eq('id', editId);
      if (upErr) throw upErr;

      await supabase.from('formula_items').delete().eq('formula_id', editId);
      const items = editIngredients
        .filter((r) => r.material_id)
        .map((r) => ({
          formula_id: editId,
          material_id: r.material_id,
          qty_per_unit: r.qty ? Number(r.qty) : null,
          uom: r.uom || null,
          percentage: r.percentage ? Number(r.percentage) : null,
        }));
      if (items.length) {
        const { error: insErr } = await supabase.from('formula_items').insert(items);
        if (insErr) throw insErr;
      }

      await loadFormulas();
      closeEdit();
    } catch (e) {
      console.warn('Failed to update formula', e);
    } finally {
      setUpdating(false);
    }
  };

  const confirmDelete = (row: any) => {
    if (isSalesRepViewOnly) return;
    setDeleteTarget(row);
    setIsDeleteOpen(true);
  };

  const openNotes = (row: any) => {
    if (isSalesRepViewOnly) return;
    setNotesTarget(row);
    setNotesValue(String(row?.comments || ''));
    setIsNotesOpen(true);
  };

  const closeNotes = () => {
    setIsNotesOpen(false);
    setNotesTarget(null);
    setNotesValue('');
    setSavingNotes(false);
  };

  const handleSaveNotes = async () => {
    try {
      if (isSalesRepViewOnly) return;
      const id = String(notesTarget?.id || '');
      if (!id) return;
      setSavingNotes(true);
      const { error } = await supabase
        .from('formulas')
        .update({ comments: notesValue })
        .eq('id', id);
      if (error) throw error;
      setFormulasList((prev) =>
        prev.map((f) => (String(f?.id) === id ? { ...f, comments: notesValue } : f))
      );
      closeNotes();
    } catch (e) {
      console.warn('Failed to save notes', e);
      setSavingNotes(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (isSalesRepViewOnly) return;
      if (!deleteTarget?.id) return;
      setDeleting(true);
      const id = String(deleteTarget.id);
      await supabase.from('formula_items').delete().eq('formula_id', id);
      const { error } = await supabase.from('formulas').delete().eq('id', id);
      if (error) throw error;
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      await loadFormulas();
    } catch (e) {
      console.warn('Failed to delete formula', e);
    } finally {
      setDeleting(false);
    }
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
      const [{ data: m }, { data: c }] = await Promise.all([
        supabase
          .from("inventory_materials")
          .select("id, product_name, unit_of_measure"),
        supabase.from("customers").select("id, company_name"),
      ]);

      setMaterials(m || []);
      setCustomersList(c || []);
    };
    load();
  }, []);

  useEffect(() => {
    let active = true;
    const loadRole = async () => {
      try {
        if (!user?.id) return;
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (!active) return;
        setCurrentUserRole((data as any)?.role ? String((data as any).role) : null);
      } catch {
        if (!active) return;
        setCurrentUserRole(null);
      }
    };
    loadRole();
    return () => { active = false; };
  }, [user?.id]);

  // Allow parent header button to open modal
  useEffect(() => {
    if (typeof openSignal === 'number' && openSignal > 0) {
      if (!isSalesRepViewOnly) setIsAddOpen(true);
    }
  }, [openSignal, isSalesRepViewOnly]);

  /* ✅ 2. LOAD FORMULAS FOR DISPLAY */
  const loadFormulas = async () => {
    const { data, error } = await supabase
      .from("formulas")
      .select(`
        id,
        formula_name,
        customer_id,
        comments,
        version,
        created_at,
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
      if (isSalesRepViewOnly) return;
      if (!form.product_name || !form.customer_id) return;
      setSaving(true);
      const { data: fdata, error: ferr } = await supabase
        .from("formulas")
        .insert([
          {
            customer_id: form.customer_id,
            formula_name: form.product_name.trim(),
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
            </div>

            {!isSalesRepViewOnly && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md hover:shadow-lg flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Formula
              </button>
            )}
          </div>
        )}

        {/* ✅ DISPLAY FORMULA LIST IF AVAILABLE */}
        {formulasList.length > 0 ? (
          <div className="mt-10 bg-white rounded-xl shadow-md border border-neutral-soft/30 overflow-hidden">
            <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5 border-b border-neutral-soft/40">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-neutral-dark mb-1">Formula Directory</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b-2 border-neutral-soft/50">
                    <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Formula Name</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Customer</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Version</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Created</th>
                    <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-bold text-neutral-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-soft/20">
                  {formulasList.map((f) => (
                    <tr
                      key={f.id}
                      className={
                        (() => {
                          return `group hover:bg-gradient-to-r hover:from-primary-light/5 hover:to-primary-medium/5 transition-all duration-300 hover:shadow-sm`;
                        })()
                      }
                    >
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <div className="text-xs sm:text-sm font-semibold text-neutral-dark truncate flex items-center gap-2">
                          <span className="truncate">{f.formula_name}</span>
                          {(() => {
                            const created = f?.created_at ? new Date(f.created_at).getTime() : 0;
                            const isNew = created && (Date.now() - created) < 24 * 60 * 60 * 1000;
                            return isNew ? (
                              <span className="shrink-0 text-[10px] sm:text-[11px] font-bold text-primary-medium bg-primary-light/20 border border-primary-light/30 px-1.5 py-0.5 rounded-md">
                                NEW
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {String(f?.comments || '').trim() ? (
                          <div className="mt-0.5 text-[11px] sm:text-xs text-neutral-medium truncate">
                            {String(f.comments)}
                          </div>
                        ) : null}
                        {!isSalesRepViewOnly && (
                          <button
                            type="button"
                            onClick={() => openNotes(f)}
                            className="mt-1 text-[11px] sm:text-xs text-primary-medium hover:underline"
                          >
                            {String(f?.comments || '').trim() ? 'Edit Notes' : '+ Add Notes'}
                          </button>
                        )}
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <div className="text-xs sm:text-sm font-medium text-neutral-dark">{f.customers?.company_name || '—'}</div>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <div className="text-xs sm:text-sm text-neutral-dark">{f.version}</div>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <div className="text-xs sm:text-sm text-neutral-dark">{new Date(f.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => openView(f)}
                            className="group/btn p-1.5 sm:p-2 text-primary-medium hover:text-white hover:bg-primary-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium"
                          >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                          {!isSalesRepViewOnly && (
                            <button
                              type="button"
                              onClick={() => openEdit(f)}
                              className="group/btn p-1.5 sm:p-2 text-neutral-medium hover:text-white hover:bg-neutral-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft hover:border-neutral-medium"
                            >
                              <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                          )}
                          {!isSalesRepViewOnly && (
                            <button
                              type="button"
                              onClick={() => confirmDelete(f)}
                              className="group/btn p-1.5 sm:p-2 text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 border border-red-200 hover:border-red-600"
                            >
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
            {!isSalesRepViewOnly && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="mt-4 px-5 py-2.5 rounded-lg bg-primary-medium hover:bg-primary-dark text-white text-sm font-medium shadow-sm"
              >
                Create Your First Formula
              </button>
            )}
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
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white"
                      placeholder="Formula Name"
                      value={form.product_name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setForm({ ...form, product_name: name });
                      }}
                    />
                    
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
                    Notes
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
                  disabled={saving || !form.product_name || !form.customer_id}
                  onClick={handleCreate}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Create Formula"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isViewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsViewOpen(false)}></div>
            <div className="relative z-10 w-full max-w-5xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-neutral-light border-b border-neutral-soft/50">
                <h2 className="text-xl font-semibold text-neutral-dark">Formula Details</h2>
                <button onClick={() => setIsViewOpen(false)} className="p-2 text-neutral-medium hover:text-neutral-dark">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs text-neutral-medium">Formula Name</div>
                    <div className="text-sm text-neutral-dark font-semibold">{viewFormula?.formula_name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-medium">Customer</div>
                    <div className="text-sm text-neutral-dark font-semibold">{viewFormula?.customers?.company_name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-medium">Version</div>
                    <div className="text-sm text-neutral-dark">{viewFormula?.version ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-medium">Created</div>
                    <div className="text-sm text-neutral-dark">{viewFormula?.created_at ? new Date(viewFormula.created_at).toLocaleString() : '-'}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-neutral-medium">Notes</div>
                  <div className="text-sm text-neutral-dark whitespace-pre-wrap">{viewFormula?.comments || '-'}</div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-neutral-dark">Ingredients</div>
                  <div className="border border-neutral-soft rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-neutral-light/40 border-b">
                          <th className="text-left px-4 py-2 text-xs text-neutral-medium">Material</th>
                          <th className="text-right px-4 py-2 text-xs text-neutral-medium">Qty</th>
                          <th className="text-left px-4 py-2 text-xs text-neutral-medium">UOM</th>
                          <th className="text-right px-4 py-2 text-xs text-neutral-medium">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewLoading ? (
                          <tr><td className="px-4 py-3 text-sm text-neutral-medium" colSpan={4}>Loading…</td></tr>
                        ) : (Array.isArray(viewItems) && viewItems.length > 0) ? (
                          viewItems.map((it: any, idx: number) => (
                            <tr key={it.id || idx} className="border-t">
                              <td className="px-4 py-2">{it?.inventory_materials?.product_name || it?.material_id || '-'}</td>
                              <td className="px-4 py-2 text-right">{(it?.qty_per_unit ?? '-') === null ? '-' : String(it?.qty_per_unit ?? '-') }</td>
                              <td className="px-4 py-2">{it?.uom || it?.inventory_materials?.unit_of_measure || '-'}</td>
                              <td className="px-4 py-2 text-right">{(it?.percentage ?? '-') === null ? '-' : String(it?.percentage ?? '-') }</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td className="px-4 py-3 text-sm text-neutral-medium" colSpan={4}>No ingredients</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="px-8 py-5 bg-white border-t border-neutral-soft/60 flex items-center justify-end gap-3">
                <button onClick={() => setIsViewOpen(false)} className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark bg-white hover:border-neutral-medium">Close</button>
              </div>
            </div>
          </div>
        )}

        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => closeEdit()}></div>
            <div className="relative z-10 w-full max-w-6xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-neutral-light border-b border-neutral-soft/50">
                <h2 className="text-xl font-semibold text-neutral-dark">Update Formula</h2>
                <button onClick={() => closeEdit()} className="p-2 text-neutral-medium hover:text-neutral-dark">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-neutral-dark">Product</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white"
                      placeholder="Formula Name"
                      value={editForm.product_name}
                      onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-dark">Customer</label>
                    <select
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white"
                      value={editForm.customer_id}
                      onChange={(e) => setEditForm({ ...editForm, customer_id: e.target.value })}
                    >
                      <option value="">Select Customer</option>
                      {customersList.map((c) => (
                        <option key={c.id} value={c.id}>{c.company_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-dark">Ingredients</h3>
                    <button
                      type="button"
                      onClick={() => setEditIngredients((prev) => [...prev, { ...emptyIngredient }])}
                      className="px-3 py-2 rounded-lg bg-white border border-neutral-soft hover:border-neutral-medium text-sm text-neutral-dark shadow-sm"
                    >
                      Add Ingredient
                    </button>
                  </div>

                  {editIngredients.map((ing, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-end">
                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">Raw Material</label>
                        <select
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg bg-white"
                          value={ing.material_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            const mat = materials.find((mm) => mm.id === val);
                            setEditIngredients((prev) => prev.map((it, i) => i === idx ? { ...it, material_id: val, uom: mat?.unit_of_measure || '' } : it));
                          }}
                        >
                          <option value="">Select Material</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>{m.product_name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">Quantity</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg bg-white"
                          placeholder="0"
                          value={ing.qty}
                          onChange={(e) => setEditIngredients((prev) => prev.map((it, i) => i === idx ? { ...it, qty: e.target.value } : it))}
                        />
                      </div>

                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">Unit</label>
                        <input
                          readOnly
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg bg-neutral-50 text-neutral-dark"
                          value={ing.uom}
                          placeholder="Auto"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-neutral-medium block mb-1">%</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2.5 border border-neutral-soft rounded-lg bg-white"
                          placeholder="0-100"
                          value={ing.percentage}
                          onChange={(e) => setEditIngredients((prev) => prev.map((it, i) => i === idx ? { ...it, percentage: e.target.value } : it))}
                        />
                      </div>

                      <div className="flex justify-end pb-0">
                        <button
                          type="button"
                          onClick={() => setEditIngredients((prev) => prev.filter((_, i) => i !== idx))}
                          className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-neutral-soft text-neutral-medium hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-dark">
                    Notes
                  </label>
                  <textarea
                    className="w-full min-h-[100px] px-4 py-3 border border-neutral-soft rounded-lg bg-white resize-none"
                    placeholder="Additional notes..."
                    value={editForm.comments}
                    onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })}
                  />
                </div>
              </div>
              <div className="px-8 py-5 bg-white border-t border-neutral-soft/60 flex items-center justify-end gap-3">
                <button onClick={() => closeEdit()} className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark bg-white hover:border-neutral-medium">Cancel</button>
                <button
                  disabled={updating || !editForm.product_name || !editForm.customer_id}
                  onClick={handleUpdate}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isDeleteOpen && deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setIsDeleteOpen(false)}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-soft/40">
                <div className="text-lg font-semibold text-neutral-dark">Delete Formula</div>
              </div>
              <div className="p-6 text-sm text-neutral-dark">
                Are you sure you want to delete "{deleteTarget.formula_name}"? This action cannot be undone.
              </div>
              <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-soft/40">
                <button onClick={() => !deleting && setIsDeleteOpen(false)} className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark">Cancel</button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-lg bg-accent-danger text-white"
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isNotesOpen && notesTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !savingNotes && closeNotes()}></div>
            <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 bg-neutral-light border-b border-neutral-soft/50">
                <div>
                  <div className="text-lg font-semibold text-neutral-dark">Notes</div>
                  <div className="text-xs text-neutral-medium mt-0.5 truncate">{notesTarget?.formula_name || ''}</div>
                </div>
                <button onClick={() => !savingNotes && closeNotes()} className="p-2 text-neutral-medium hover:text-neutral-dark">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                <textarea
                  className="w-full min-h-[140px] px-4 py-3 border border-neutral-soft rounded-lg bg-white resize-none"
                  placeholder="Add notes..."
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                />
              </div>
              <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-soft/40">
                <button onClick={() => !savingNotes && closeNotes()} className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark">Cancel</button>
                <button
                  onClick={handleSaveNotes}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white"
                  disabled={savingNotes}
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
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
