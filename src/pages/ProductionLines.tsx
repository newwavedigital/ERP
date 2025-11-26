import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";

// Page: Production Lines (single-file, self-contained CRUD)
// No external imports besides supabase and React

type ProductionLine = {
  id: string;
  line_name: string;
  allowed_allergens: string[];
  sanitation_minutes: number;
  needs_qa_signoff: boolean;
};

type FormState = {
  id?: string | null;
  line_name: string;
  allowed_allergens: string[];
  sanitation_minutes: number | "";
  needs_qa_signoff: boolean;
};

// Lightweight Toast system (local to this file)
function useToasts() {
  const [toasts, setToasts] = useState<{ id: number; type: "success" | "error"; message: string }[]>([]);
  const add = (type: "success" | "error", message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };
  const Toasts = () => (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl shadow-lg px-4 py-2 text-sm ${
            t.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
  return { add, Toasts };
}

// Generic Modal
function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
        <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
          <h3 className="text-xl font-semibold text-neutral-dark">{title}</h3>
          <button className="p-2 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="px-8 py-6">{children}</div>
        {footer && <div className="px-8 py-5 border-t border-neutral-soft/40 bg-neutral-50 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

// Confirm Dialog (modal)
function Confirm({ open, title, message, confirmText = "Confirm", cancelText = "Cancel", onConfirm, onCancel, loading }: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={
        <>
          <button className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100" onClick={onCancel} disabled={!!loading}>{cancelText}</button>
          <button className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60" onClick={onConfirm} disabled={!!loading}>
            {loading ? "Deleting..." : confirmText}
          </button>
        </>
      }
    >
      <p className="text-neutral-700">{message}</p>
    </Modal>
  );
}

// Allowed Allergens Tag Input (self-contained)
function TagsInput({ value, onChange, placeholder = "Type allergen and press Enter" }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; }) {
  const [input, setInput] = useState("");
  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
    setInput("");
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  return (
    <div className="rounded-xl border border-neutral-300 px-3 py-2 bg-white">
      <div className="flex flex-wrap gap-2">
        {value.map((tag, i) => (
          <span key={`${tag}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 text-neutral-800 px-2.5 py-1 text-xs">
            {tag}
            <button className="ml-1 text-neutral-500 hover:text-neutral-800" onClick={() => remove(i)} aria-label={`Remove ${tag}`}>×</button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[140px] outline-none text-sm text-neutral-900 placeholder:text-neutral-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

export default function ProductionLines({ embedded = false, refreshSignal = 0, openCreateSignal = 0 }: { embedded?: boolean; refreshSignal?: number; openCreateSignal?: number }) {
  const { add: addToast, Toasts } = useToasts();

  const [rows, setRows] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewRow, setViewRow] = useState<ProductionLine | null>(null);

  const [form, setForm] = useState<FormState>({
    id: null,
    line_name: "",
    allowed_allergens: [],
    sanitation_minutes: 30,
    needs_qa_signoff: true,
  });

  const duplicateNames = useMemo(() => new Set(rows.map((r) => r.line_name.toLowerCase())), [rows]);
  const isEdit = !!form.id;

  const resetForm = () => setForm({ id: null, line_name: "", allowed_allergens: [], sanitation_minutes: 30, needs_qa_signoff: true });

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("production_lines").select("*");
    if (error) {
      addToast("error", `Failed to load: ${error.message}`);
    } else {
      setRows((data || []) as ProductionLine[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Edge-triggered signals from parent (avoid auto-fire on mount/remount)
  const lastRefresh = useRef<number>(refreshSignal);
  const lastOpenCreate = useRef<number>(openCreateSignal);
  useEffect(() => {
    if (refreshSignal !== lastRefresh.current) {
      lastRefresh.current = refreshSignal;
      if (refreshSignal > 0) fetchRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);
  useEffect(() => {
    if (openCreateSignal !== lastOpenCreate.current) {
      lastOpenCreate.current = openCreateSignal;
      if (openCreateSignal > 0) openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateSignal]);

  const openCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (row: ProductionLine) => {
    setForm({
      id: row.id,
      line_name: row.line_name ?? "",
      allowed_allergens: Array.isArray(row.allowed_allergens) ? row.allowed_allergens : [],
      sanitation_minutes: typeof row.sanitation_minutes === "number" ? row.sanitation_minutes : 30,
      needs_qa_signoff: !!row.needs_qa_signoff,
    });
    setIsModalOpen(true);
  };

  const [deleteTarget, setDeleteTarget] = useState<ProductionLine | null>(null);
  const openDelete = (row: ProductionLine) => {
    setDeleteTarget(row);
    setIsDeleteOpen(true);
  };

  const closeDelete = () => {
    setIsDeleteOpen(false);
    setDeleteTarget(null);
  };

  const validate = (): string | null => {
    if (!form.line_name.trim()) return "Line name is required";
    const lower = form.line_name.trim().toLowerCase();
    const exists = rows.some((r) => r.line_name.toLowerCase() === lower && r.id !== form.id);
    if (exists) return "A production line with this name already exists";
    const minutes = Number(form.sanitation_minutes);
    if (Number.isNaN(minutes) || minutes < 0) return "Sanitation minutes must be a non-negative number";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      addToast("error", err);
      return;
    }
    setSaving(true);
    const payload = {
      line_name: form.line_name.trim(),
      allowed_allergens: form.allowed_allergens,
      sanitation_minutes: Number(form.sanitation_minutes || 0),
      needs_qa_signoff: !!form.needs_qa_signoff,
    } as Omit<ProductionLine, "id">;

    try {
      if (isEdit && form.id) {
        const { error } = await supabase.from("production_lines").update(payload).eq("id", form.id);
        if (error) throw error;
        addToast("success", "Production line updated");
      } else {
        const { error } = await supabase.from("production_lines").insert(payload);
        if (error) throw error;
        addToast("success", "Production line created");
      }
      setIsModalOpen(false);
      resetForm();
      await fetchRows();
    } catch (e: any) {
      addToast("error", e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("production_lines").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      addToast("success", "Production line deleted");
      closeDelete();
      await fetchRows();
    } catch (e: any) {
      addToast("error", e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={embedded ? '' : "min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20"}>
      <Toasts />

      <div className={embedded ? '' : "p-8"}>
        {/* Header card (hidden when embedded) */}
        {!embedded && (
          <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-neutral-dark mb-1">Production Lines</h1>
                <p className="text-neutral-medium text-lg">Manage manufacturing lines, sanitation, QA and allergens</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={fetchRows} className="px-5 py-3 rounded-xl bg-neutral-light hover:bg-neutral-soft text-neutral-dark text-sm font-semibold transition-all shadow-sm hover:shadow-md" disabled={loading}>
                  {loading ? "Refreshing…" : "Reload"}
                </button>
                <button onClick={openCreate} className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all shadow-lg hover:shadow-xl flex items-center">
                  <Plus className="h-5 w-5 mr-2" />
                  Add Line
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table Section */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 overflow-hidden">
          {/* Section header, like Products Catalog */}
          <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-neutral-light/40 to-neutral-light/10 border-b border-neutral-soft/40">
            <div>
              <div className="text-lg font-semibold text-neutral-dark">Production Lines Catalog</div>
              <div className="text-sm text-neutral-medium">Manage your available lines</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 shadow-sm">
                {rows.length} Total
              </div>
            </div>
          </div>
          <div className="px-6 py-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-light/60">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">Line Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">Allowed Allergens</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">Sanitation (min)</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">Needs QA Sign-off</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-soft">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-light/40">
                  <td className="px-6 py-4 whitespace-nowrap text-neutral-dark">{r.line_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1.5">
                      {(r.allowed_allergens || []).length === 0 && (
                        <span className="text-neutral-400">—</span>
                      )}
                      {(r.allowed_allergens || []).map((a, i) => (
                        <span key={`${a}-${i}`} className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-800 px-2 py-0.5 text-xs">{a}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-neutral-dark">{r.sanitation_minutes ?? 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${r.needs_qa_signoff ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-700"}`}>
                      {r.needs_qa_signoff ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        title="View"
                        onClick={() => setViewRow(r)}
                        className="p-3 text-primary-medium hover:text-white hover:bg-primary-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary-light/30 hover:border-primary-medium"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => openEdit(r)}
                        className="p-3 text-neutral-700 hover:text-white hover:bg-neutral-800 rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-neutral-soft/60 hover:border-neutral-800"
                      >
                        <Pencil className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => openDelete(r)}
                        className="p-3 text-accent-danger hover:text-white hover:bg-accent-danger rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-accent-danger/30 hover:border-accent-danger"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">{loading ? "Loading..." : "No production lines found."}</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEdit ? "Edit Production Line" : "Add Production Line"}
        footer={
          <>
            <button className="px-4 py-2 rounded-xl border border-neutral-soft text-neutral-700 bg-white hover:bg-white/60" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-sm disabled:opacity-60" onClick={save} disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Line"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1">Line Name <span className="text-rose-600">*</span></label>
            <input
              className={`w-full rounded-xl border px-4 py-3 bg-white text-neutral-dark placeholder-neutral-medium outline-none focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 ${
                form.line_name && duplicateNames.has(form.line_name.trim().toLowerCase()) && (!isEdit || rows.find((r) => r.line_name.toLowerCase() === form.line_name.trim().toLowerCase())?.id !== form.id)
                  ? "border-rose-300"
                  : "border-neutral-soft"
              }`}
              value={form.line_name}
              onChange={(e) => setForm((f) => ({ ...f, line_name: e.target.value }))}
              placeholder="e.g., Line A"
            />
            {form.line_name && duplicateNames.has(form.line_name.trim().toLowerCase()) && (!isEdit || rows.find((r) => r.line_name.toLowerCase() === form.line_name.trim().toLowerCase())?.id !== form.id) && (
              <p className="mt-1 text-xs text-rose-600">This name is already in use</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1">Allowed Allergens</label>
            <TagsInput
              value={form.allowed_allergens}
              onChange={(v) => setForm((f) => ({ ...f, allowed_allergens: v }))}
              placeholder="Type an allergen and press Enter"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-neutral-800 mb-1">Sanitation Minutes</label>
              <input
                type="number"
                className="w-full rounded-xl border border-neutral-soft px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 text-neutral-dark placeholder-neutral-medium"
                min={0}
                value={form.sanitation_minutes}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, sanitation_minutes: v === "" ? "" : Number(v) }));
                }}
              />
            </div>

            <div className="flex items-center gap-3 mt-1">
              <input
                id="needsQa"
                type="checkbox"
                className="h-5 w-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                checked={form.needs_qa_signoff}
                onChange={(e) => setForm((f) => ({ ...f, needs_qa_signoff: e.target.checked }))}
              />
              <label htmlFor="needsQa" className="text-sm font-medium text-neutral-800">Needs QA Sign-off</label>
            </div>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        open={!!viewRow}
        onClose={() => setViewRow(null)}
        title={viewRow ? `View: ${viewRow.line_name}` : 'View Line'}
        footer={<button className="px-4 py-2 rounded-xl border border-neutral-soft bg-white text-neutral-700 hover:bg-white/60" onClick={() => setViewRow(null)}>Close</button>}
      >
        {viewRow && (
          <div className="space-y-5 text-sm">
            <div>
              <div className="text-neutral-500">Line Name</div>
              <div className="text-neutral-900 font-semibold">{viewRow.line_name}</div>
            </div>
            <div>
              <div className="text-neutral-500">Allowed Allergens</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {(viewRow.allowed_allergens || []).length === 0 && <span className="text-neutral-400">—</span>}
                {(viewRow.allowed_allergens || []).map((a, i) => (
                  <span key={`${a}-${i}`} className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-800 px-2.5 py-1 text-xs">{a}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className="text-neutral-500">Sanitation Minutes</div>
                <div className="text-neutral-900 font-semibold">{viewRow.sanitation_minutes ?? 0}</div>
              </div>
              <div>
                <div className="text-neutral-500">Needs QA Sign-off</div>
                <div className="text-neutral-900 font-semibold">{viewRow.needs_qa_signoff ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Confirm
        open={isDeleteOpen}
        title="Delete Production Line"
        message={`Are you sure you want to delete \"${deleteTarget?.line_name}\"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={closeDelete}
        loading={deleting}
      />
    </div>
  );
}
