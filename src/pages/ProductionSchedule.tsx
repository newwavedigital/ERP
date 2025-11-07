// src/pages/ProductionSchedule.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, X, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Customer = { id: string; company_name: string };
type Product = { id: string; product_name: string; product_image_url?: string; unit_of_measure?: string };
type Formula = { id: string; formula_name: string; product_id: string | null };

type BatchRow = {
  id: string;
  product_sku: string;             // we store product name/sku as text
  qty: number;
  room: string | null;
  start_date: string | null;        // ISO date
  end_date: string | null;
  status: string;
  required_capacity: number | null;
  assigned_line: string | null;
  flags: string[] | null;
  formula_id: string | null;
  customer_id: string | null;
  lot_number: string | null;
  po_number: string | null;
  completed_qty: number | null;
  samples_received: boolean | null;
  samples_sent: string | null;      // ISO date
  created_at?: string;
};

type ScheduleItem = {
  id: string;
  product: string;
  customer: string;
  formula: string;
  qty: number;
  completedQty: number;
  room: string;
  startDate: string;
  status: string;
  lot?: string;
  po?: string;
};

// ─────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────
const roomsList = ["Main Room", "Bnutty Room", "Dilly's Room", "Room A", "Room B"];
const statusList = ["Scheduled", "In Progress", "Completed", "Delayed"];
const yesNo = ["No", "Yes"];

const statusChip = (status: string) => {
  switch (status) {
    case "Scheduled":
      return "bg-blue-100 text-blue-800";
    case "In Progress":
      return "bg-yellow-100 text-yellow-800";
    case "Completed":
      return "bg-green-100 text-green-800";
    case "Delayed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const fmtDate = (d?: string | null) => {
  if (!d) return "";
  try {
    const dt = new Date(d);
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    const yyyy = String(dt.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
  } catch {
    return d;
  }
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
const ProductionSchedule: React.FC = () => {
  const [open, setOpen] = useState(false);

  // Reference datasets
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; product_name: string } | null>(null);
  const [isProductOpen, setIsProductOpen] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const [formulas, setFormulas] = useState<Formula[]>([]);

  // Batches table
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters / tabs
  const tabs: Array<{ key: string; label: string; color?: string }> = [
    { key: "All", label: "All" },
    { key: "Main Room", label: "Main Room", color: "bg-blue-500" },
    { key: "Bnutty Room", label: "Bnutty Room", color: "bg-green-500" },
    { key: "Dilly's Room", label: "Dilly's Room", color: "bg-amber-500" },
  ];
  const [activeTab, setActiveTab] = useState<string>("All");

  // Create form state
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>("");
  const [room, setRoom] = useState<string>("Main Room");
  const [qty, setQty] = useState<string>("");
  const [completedQty, setCompletedQty] = useState<string>("0");
  const [lot, setLot] = useState<string>("");
  const [po, setPO] = useState<string>("");
  const [samplesReceived, setSamplesReceived] = useState<"Yes" | "No">("No");
  const [samplesSent, setSamplesSent] = useState<string>("");

  // Modals
  const [viewItem, setViewItem] = useState<ScheduleItem | null>(null);
  const [editItem, setEditItem] = useState<BatchRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  // Notifications
  type Toast = { id: string; type: 'success' | 'error'; message: string }
  const [toasts, setToasts] = useState<Toast[]>([])
  const pushToast = (t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, ...t }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4000)
  }

  // Requirements preview
  type RequirementRow = {
    material: string
    per_unit: number | null
    required: number | null
    net_available: number | null
    shortage: number | null
  }
  const [requirements, setRequirements] = useState<RequirementRow[]>([])
  const [reqLoading, setReqLoading] = useState(false)

  // Memos for lookups
  const customersMap = useMemo(
    () =>
      new Map<string, string>(
        customers.map((c) => [String(c.id), c.company_name || ""])
      ),
    [customers]
  );
  const formulasMap = useMemo(
    () => new Map<string, string>(formulas.map((f) => [String(f.id), f.formula_name || ""])),
    [formulas]
  );
  const productsMap = useMemo(
    () => new Map<string, Product>(products.map((p) => [String(p.id), p])),
    [products]
  );

  // ───────── Load lookups + batches
  const loadLookups = async () => {
    const [{ data: c }, { data: p }, { data: f }] = await Promise.all([
      supabase.from("customers").select("id, company_name").order("company_name"),
      supabase
        .from("products")
        .select("id, product_name, product_image_url, unit_of_measure")
        .order("product_name", { ascending: true }),
      supabase.from("formulas").select("id, formula_name, product_id"),
    ]);
    setCustomers(c || []);
    setProducts(p || []);
    setFormulas(f || []);
  };

  // Close product dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node)) {
        setIsProductOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadBatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("production_batches")
        .select(
          "id, product_sku, qty, room, start_date, end_date, status, required_capacity, assigned_line, flags, formula_id, customer_id, lot_number, po_number, completed_qty, samples_received, samples_sent, created_at"
        )
        .order("start_date", { ascending: false })
        .limit(200);
      if (error) throw error;

      const mapped: ScheduleItem[] =
        (data || []).map((r: any) => ({
          id: String(r.id),
          product: String(r.product_sku || ""),
          customer: customersMap.get(String(r.customer_id || "")) || "",
          formula: formulasMap.get(String(r.formula_id || "")) || "",
          qty: Number(r.qty || 0),
          completedQty: Number(r.completed_qty || 0),
          room: String(r.room || r.assigned_line || ""),
          startDate: r.start_date || "",
          status: r.status || "Scheduled",
          lot: r.lot_number || "",
          po: r.po_number || "",
        })) ?? [];

      setItems(mapped);
    } catch (e) {
      console.warn("Load batches error:", e);
      pushToast({ type: 'error', message: 'Failed to load production batches' })
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load lookups first, then batches (so map has names)
    (async () => {
      await loadLookups();
      await loadBatches();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────── Helpers for create
  const selectedProductName = useMemo(() => {
    if (!selectedProductId) return "";
    const p = productsMap.get(selectedProductId);
    return p?.product_name || "";
  }, [selectedProductId, productsMap]);

  const formulasForProduct = useMemo(() => {
    if (!selectedProductId) return formulas;
    return formulas.filter((f) => String(f.product_id || "") === selectedProductId);
  }, [selectedProductId, formulas]);

  const resetCreateForm = () => {
    setScheduledDate("");
    setSelectedCustomerId("");
    setSelectedProductId("");
    setSelectedFormulaId("");
    setRoom("Main Room");
    setQty("");
    setCompletedQty("0");
    setLot("");
    setPO("");
    setSamplesReceived("No");
    setSamplesSent("");
  };

  // ───────── Create batch
  const onCreate = async () => {
    try {
      if (!scheduledDate || !selectedProductId || !selectedCustomerId || !qty) {
        return; // simple guard
      }

      const productName = selectedProductName || "Product";
      const goalQty = Number(qty || 0);
      const doneQty = Number(completedQty || 0);

      const payload: Omit<BatchRow, "id"> = {
        product_sku: productName, // keeping as text per schema
        qty: goalQty,
        room: room || null,
        start_date: scheduledDate,
        end_date: scheduledDate,
        status: "Scheduled",
        required_capacity: goalQty,
        assigned_line: room || null,
        flags: null,
        formula_id: selectedFormulaId || null,
        customer_id: selectedCustomerId || null,
        lot_number: lot || null,
        po_number: po || null,
        completed_qty: doneQty,
        samples_received: samplesReceived === "Yes",
        samples_sent: samplesSent || null,
      };

      const { error } = await supabase.from("production_batches").insert(payload as any).select('id').single();
      if (error) throw error;

      resetCreateForm();
      setOpen(false);
      await loadBatches();
      pushToast({ type: 'success', message: 'Production schedule created' })
    } catch (e) {
      console.warn("Create batch error:", e);
      pushToast({ type: 'error', message: 'Failed to create schedule' })
    }
  };

  // ───────── Filtered table items
  const filtered = useMemo(() => {
    if (activeTab === "All") return items;
    return items.filter(
      (i) => (i.room || "").toLowerCase() === activeTab.toLowerCase()
    );
  }, [activeTab, items]);

  // ───────── Row → full record (for edit)
  const fetchRowById = async (id: string) => {
    const { data, error } = await supabase
      .from("production_batches")
      .select(
        "id, product_sku, qty, room, start_date, end_date, status, required_capacity, assigned_line, flags, formula_id, customer_id, lot_number, po_number, completed_qty, samples_received, samples_sent, created_at"
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as BatchRow;
  };

  // ───────── Delete
  const doDelete = async (id: string) => {
    try {
      await supabase.from("production_batches").delete().eq("id", id);
      setDelId(null);
      await loadBatches();
      pushToast({ type: 'success', message: 'Batch deleted' })
    } catch (e) {
      console.warn("Delete error:", e);
      pushToast({ type: 'error', message: 'Failed to delete batch' })
    }
  };

  // ───────── Edit save
  const saveEdit = async () => {
    if (!editItem) return;
    setSavingEdit(true);
    try {
      const payload = { ...editItem } as any;
      delete payload.created_at;
      const { error } = await supabase
        .from("production_batches")
        .update(payload)
        .eq("id", editItem.id);
      if (error) throw error;
      setEditItem(null);
      await loadBatches();
      pushToast({ type: 'success', message: 'Batch updated' })
    } catch (e) {
      console.warn("Edit save error:", e);
      pushToast({ type: 'error', message: 'Failed to update batch' })
    } finally {
      setSavingEdit(false);
    }
  };

  // ───────── Requirement calc (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!selectedFormulaId || !qty) {
        setRequirements([])
        return
      }
      try {
        setReqLoading(true)
        const { data, error } = await supabase.rpc('fn_calc_requirements', {
          p_formula_id: selectedFormulaId,
          p_target_qty: Number(qty)
        })
        if (error) throw error
        const rows = (data || []) as any[]
        const mapped: RequirementRow[] = rows.map(r => ({
          material: String(r.material ?? r.material_name ?? ''),
          per_unit: r.per_unit ?? r.per_unit_qty ?? null,
          required: r.required ?? r.total_required ?? null,
          net_available: r.net_available ?? r.available ?? null,
          shortage: r.shortage ?? (r.required && r.available != null ? r.required - r.available : null)
        }))
        setRequirements(mapped)
      } catch (e) {
        console.warn('Requirement calc error', e)
        pushToast({ type: 'error', message: 'Failed to calculate requirements' })
      } finally {
        setReqLoading(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [selectedFormulaId, qty])

  // ───────── Row actions (RPC)
  const onStartBatch = async (id: string) => {
    try {
      const { error } = await supabase.rpc('fn_reserve_for_batch', { p_batch_id: id })
      if (error) throw error
      await loadBatches()
      pushToast({ type: 'success', message: 'Batch started and materials reserved' })
    } catch (e) {
      console.warn(e)
      pushToast({ type: 'error', message: 'Failed to start batch' })
    }
  }

  const onCancelBatch = async (id: string) => {
    try {
      const { error } = await supabase.rpc('fn_release_reservations', { p_batch_id: id })
      if (error) throw error
      await loadBatches()
      pushToast({ type: 'success', message: 'Batch cancelled and materials released' })
    } catch (e) {
      console.warn(e)
      pushToast({ type: 'error', message: 'Failed to cancel batch' })
    }
  }

  const [completeId, setCompleteId] = useState<string | null>(null)
  const [completeQty, setCompleteQty] = useState<string>('0')
  const confirmComplete = async () => {
    if (!completeId) return
    try {
      const { error } = await supabase.rpc('fn_complete_batch', { p_batch_id: completeId, p_completed_qty: Number(completeQty || 0) })
      if (error) throw error
      setCompleteId(null)
      setCompleteQty('0')
      await loadBatches()
      pushToast({ type: 'success', message: 'Batch completed' })
    } catch (e) {
      console.warn(e)
      pushToast({ type: 'error', message: 'Failed to complete batch' })
    }
  }

  const onGeneratePO = async (id: string) => {
    try {
      const { error } = await supabase.rpc('fn_generate_po_for_batch_shortages', { p_batch_id: id })
      if (error) throw error
      pushToast({ type: 'success', message: 'Purchase Orders generated for shortages' })
    } catch (e) {
      console.warn(e)
      pushToast({ type: 'error', message: 'Failed to generate purchase orders' })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        {/* Toasts */}
        <div className="fixed top-4 right-4 z-[1000] space-y-2">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-lg shadow-md text-sm ${t.type==='error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>{t.message}</div>
          ))}
        </div>
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-1">
                Production Schedule
              </h1>
              <p className="text-neutral-medium text-lg">
                Schedule production with material requirements
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadBatches}
                className="px-5 py-3 rounded-xl bg-neutral-light hover:bg-neutral-soft text-neutral-dark text-sm font-semibold transition-all shadow-sm hover:shadow-md"
              >
                {loading ? "Loading…" : "Reload"}
              </button>
              <button
                onClick={() => setOpen(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all shadow-lg hover:shadow-xl flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Schedule Production
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6">
            <div className="flex items-center gap-6 text-sm font-medium text-neutral-dark">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`pb-2 border-b-2 transition-colors ${
                    activeTab === t.key
                      ? "border-primary-medium text-primary-medium"
                      : "border-transparent text-neutral-medium hover:text-neutral-dark"
                  }`}
                >
                  <span className="inline-flex items-center">
                    {t.color && (
                      <span className={`w-2 h-2 rounded-full mr-2 ${t.color}`}></span>
                    )}
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 border-t border-neutral-soft"></div>
          </div>
        </div>

        {/* Empty */}
        {filtered.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="mx-auto w-16 h-16 bg-neutral-light rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-neutral-medium" />
            </div>
            <p className="text-neutral-dark font-semibold mb-1">
              No production scheduled
            </p>
            <p className="text-neutral-medium mb-6">
              Create a production schedule to get started.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="px-6 py-3 rounded-xl bg-primary-medium hover:bg-primary-dark text-white font-semibold shadow-sm"
            >
              Schedule Production
            </button>
          </div>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-soft">
                <thead className="bg-neutral-light/60">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Formula
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Qty Goal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Room
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-soft">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-neutral-light/40">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-neutral-dark">
                          {row.product}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.customer}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.formula}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.qty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.completedQty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.room}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {fmtDate(row.startDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusChip(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button className="p-2 rounded-md hover:bg-neutral-light" onClick={() => setViewItem(row)} title="View"><Eye className="h-4 w-4"/></button>
                          <button className="p-2 rounded-md hover:bg-neutral-light" onClick={async ()=>{ const full = await fetchRowById(row.id); setEditItem(full) }} title="Edit"><Pencil className="h-4 w-4"/></button>
                          <button className="p-2 rounded-md hover:bg-red-50 text-accent-danger" onClick={() => setDelId(row.id)} title="Delete"><Trash2 className="h-4 w-4"/></button>
                          <button className="px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={() => onStartBatch(row.id)}>Start</button>
                          <button className="px-3 py-1.5 rounded-md bg-neutral-light text-neutral-dark hover:bg-neutral-soft" onClick={() => onCancelBatch(row.id)}>Cancel</button>
                          <button className="px-3 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100" onClick={() => setCompleteId(row.id)}>Complete</button>
                          <button className="px-3 py-1.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={() => onGeneratePO(row.id)}>Auto-PO</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ───────── Create Modal */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)}></div>
            <div className="relative z-10 w-full max-w-4xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Add Production Schedule</h2>
                  <p className="text-sm text-neutral-medium mt-1">Plan a new production run</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-8 space-y-6">
                  {/* Date */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-neutral-dark">Scheduled Date</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium"
                    />
                  </div>

                  {/* Customer / Product / Formula */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Customer</label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl bg-white"
                      >
                        <option value="">Select Customer</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.company_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3" ref={productRef}>
                      <label className="text-sm font-semibold text-neutral-dark">Product</label>
                      <button
                        type="button"
                        onClick={() => setIsProductOpen(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-neutral-soft rounded-xl text-left bg-white hover:border-neutral-medium focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all shadow-sm"
                      >
                        <span className={selectedProduct?.product_name ? 'text-neutral-dark' : 'text-neutral-medium'}>
                          {selectedProduct?.product_name || 'Select Product'}
                        </span>
                        <span className="ml-2 text-neutral-medium">▼</span>
                      </button>

                      {isProductOpen && (
                        <div className="absolute z-[100] mt-2 w-[calc(100%-4rem)] bg-white border border-neutral-soft rounded-xl shadow-xl max-h-64 overflow-auto">
                          <div className="px-3 py-2 text-xs text-neutral-medium">Select Product</div>
                          {products.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={`flex w-full items-center justify-between px-4 py-2 hover:bg-neutral-light`}
                              onClick={() => {
                                setSelectedProduct({ id: p.id, product_name: p.product_name })
                                setSelectedProductId(p.id)
                                setSelectedFormulaId("")
                                setIsProductOpen(false)
                              }}
                            >
                              <span className="text-neutral-dark">{p.product_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Formula</label>
                      <select
                        value={selectedFormulaId}
                        onChange={(e) => setSelectedFormulaId(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl bg-white"
                      >
                        <option value="">Select Formula</option>
                        {formulasForProduct.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.formula_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Requirements Preview */}
                  <div className="mt-4 bg-white border border-neutral-soft rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-neutral-dark">Material Requirements</div>
                      <button
                        type="button"
                        disabled
                        title="Save schedule first to generate POs"
                        className="px-3 py-2 rounded-lg bg-neutral-light text-neutral-dark border border-neutral-soft disabled:opacity-60"
                      >
                        Auto-Generate Purchase Orders for Shortages
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-neutral-medium">
                          <tr>
                            <th className="text-left py-2 pr-4">Material</th>
                            <th className="text-right py-2 pr-4">Per Unit</th>
                            <th className="text-right py-2 pr-4">Required</th>
                            <th className="text-right py-2 pr-4">Net Available</th>
                            <th className="text-right py-2">Shortage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reqLoading ? (
                            <tr><td className="py-3 text-neutral-medium" colSpan={5}>Calculating…</td></tr>
                          ) : requirements.length === 0 ? (
                            <tr><td className="py-3 text-neutral-medium" colSpan={5}>Select a formula and enter a goal quantity</td></tr>
                          ) : (
                            requirements.map((r, i) => (
                              <tr key={i} className="border-t border-neutral-soft/60">
                                <td className="py-2 pr-4 text-neutral-dark">{r.material}</td>
                                <td className="py-2 pr-4 text-right">{r.per_unit ?? '-'}</td>
                                <td className="py-2 pr-4 text-right">{r.required ?? '-'}</td>
                                <td className="py-2 pr-4 text-right">{r.net_available ?? '-'}</td>
                                <td className={`py-2 text-right ${r.shortage && Number(r.shortage) > 0 ? 'text-accent-danger font-semibold' : 'text-neutral-dark'}`}>{r.shortage ?? '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Lot / PO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Lot #</label>
                      <input
                        placeholder="e.g., LOT-2024-001"
                        value={lot}
                        onChange={(e) => setLot(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Purchase Order #</label>
                      <input
                        placeholder="e.g., PO-2024-001"
                        value={po}
                        onChange={(e) => setPO(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium"
                      />
                    </div>
                  </div>

                  {/* Room / Qty / Completed */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Production Room</label>
                      <select
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl bg-white"
                      >
                        {roomsList.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Goal (Qty)</label>
                      <input
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="Target quantity"
                        type="number"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Completed</label>
                      <input
                        value={completedQty}
                        onChange={(e) => setCompletedQty(e.target.value)}
                        type="number"
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium"
                      />
                    </div>
                  </div>

                  {/* Samples */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Samples Received</label>
                      <select
                        value={samplesReceived}
                        onChange={(e) =>
                          setSamplesReceived((e.target.value as "Yes" | "No") ?? "No")
                        }
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl bg-white"
                      >
                        {yesNo.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Samples Sent</label>
                      <input
                        type="date"
                        value={samplesSent}
                        onChange={(e) => setSamplesSent(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      onClick={onCreate}
                      disabled={
                        !scheduledDate ||
                        !selectedCustomerId ||
                        !selectedProductId ||
                        !qty
                      }
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white text-sm font-semibold shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Create Schedule
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ───────── View Modal */}
        {viewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setViewItem(null)}></div>
            <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">Production Batch</h3>
                <button onClick={() => setViewItem(null)} className="p-2">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 text-sm space-y-2">
                <div><strong>Product:</strong> {viewItem.product}</div>
                <div><strong>Customer:</strong> {viewItem.customer}</div>
                <div><strong>Formula:</strong> {viewItem.formula}</div>
                <div><strong>Qty Goal:</strong> {viewItem.qty}</div>
                <div><strong>Completed:</strong> {viewItem.completedQty}</div>
                <div><strong>Room:</strong> {viewItem.room}</div>
                <div><strong>Start:</strong> {fmtDate(viewItem.startDate)}</div>
                <div><strong>Status:</strong> {viewItem.status}</div>
                {viewItem.lot && <div><strong>Lot #:</strong> {viewItem.lot}</div>}
                {viewItem.po && <div><strong>PO #:</strong> {viewItem.po}</div>}
              </div>
            </div>
          </div>
        )}

        {/* ───────── Edit Modal */}
        {editItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => !savingEdit && setEditItem(null)}></div>
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">Edit Production Batch</h3>
                <button onClick={() => !savingEdit && setEditItem(null)} className="p-2">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Product (text)</label>
                    <input
                      value={editItem.product_sku}
                      onChange={(e) => setEditItem({ ...editItem, product_sku: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Qty Goal</label>
                    <input
                      type="number"
                      value={String(editItem.qty ?? "")}
                      onChange={(e) => setEditItem({ ...editItem, qty: Number(e.target.value || 0), required_capacity: Number(e.target.value || 0) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Completed</label>
                    <input
                      type="number"
                      value={String(editItem.completed_qty ?? 0)}
                      onChange={(e) => setEditItem({ ...editItem, completed_qty: Number(e.target.value || 0) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Room</label>
                    <input
                      value={editItem.room || ""}
                      onChange={(e) => setEditItem({ ...editItem, room: e.target.value, assigned_line: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <input
                      type="date"
                      value={editItem.start_date || ""}
                      onChange={(e) => setEditItem({ ...editItem, start_date: e.target.value, end_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={editItem.status}
                      onChange={(e) => setEditItem({ ...editItem, status: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {statusList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Lot #</label>
                    <input
                      value={editItem.lot_number || ""}
                      onChange={(e) => setEditItem({ ...editItem, lot_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">PO #</label>
                    <input
                      value={editItem.po_number || ""}
                      onChange={(e) => setEditItem({ ...editItem, po_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Samples Received</label>
                    <select
                      value={editItem.samples_received ? "Yes" : "No"}
                      onChange={(e) =>
                        setEditItem({ ...editItem, samples_received: e.target.value === "Yes" })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {yesNo.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Samples Sent</label>
                    <input
                      type="date"
                      value={editItem.samples_sent || ""}
                      onChange={(e) => setEditItem({ ...editItem, samples_sent: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setEditItem(null)}
                    className="px-4 py-2 rounded-lg border"
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="px-5 py-2.5 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-semibold disabled:opacity-60"
                    disabled={savingEdit}
                  >
                    {savingEdit ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ───────── Delete Confirm */}
        {delId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDelId(null)}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 border-b">
                <div className="text-lg font-semibold">Delete Batch</div>
              </div>
              <div className="p-6 text-sm">
                Are you sure you want to delete this batch?
              </div>
              <div className="px-6 py-4 flex justify-end gap-3 border-t">
                <button className="px-4 py-2 rounded-lg border" onClick={() => setDelId(null)}>
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-accent-danger text-white"
                  onClick={() => doDelete(delId)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Qty Modal */}
        {completeId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setCompleteId(null)}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 border-b"><div className="text-lg font-semibold">Complete Batch</div></div>
              <div className="p-6 space-y-3">
                <label className="text-sm font-medium text-neutral-dark">Completed Quantity</label>
                <input type="number" value={completeQty} onChange={(e)=>setCompleteQty(e.target.value)} className="w-full px-4 py-3 border border-neutral-soft rounded-xl bg-white" />
              </div>
              <div className="px-6 py-4 flex justify-end gap-3 border-t">
                <button className="px-4 py-2 rounded-lg border" onClick={()=>setCompleteId(null)}>Cancel</button>
                <button className="px-4 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white" onClick={confirmComplete}>Complete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionSchedule;
