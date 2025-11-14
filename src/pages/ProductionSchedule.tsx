// src/pages/ProductionSchedule.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from 'react-router-dom'
import { Calendar, X, Plus, Eye, Pencil, Trash2, MoreVertical, AlertTriangle } from "lucide-react";
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
  source_po_id?: string | null;
  source_po_line_id?: string | null;
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
  sourcePoId?: string | null;
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
  const location = useLocation()

  // Reference datasets
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; product_name: string } | null>(null);
  const [isProductOpen, setIsProductOpen] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const menuPopupRef = useRef<HTMLDivElement | null>(null);
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
  const [highlightPoId, setHighlightPoId] = useState<string | null>(null)
  const [menuRowId, setMenuRowId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

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

  // Shortage modal state
  type ShortageRow = { material: string; required: number; available: number; shortage: number }
  const [shortageInfo, setShortageInfo] = useState<{ batchId: string; shortages: ShortageRow[] } | null>(null)
  const [prListOpenFor, setPrListOpenFor] = useState<string | null>(null)
  const [prs, setPrs] = useState<any[]>([])
  const [startDisabled, setStartDisabled] = useState<Record<string, boolean>>({})
  const [shortagesCache, setShortagesCache] = useState<Record<string, ShortageRow[]>>({})
  const [prExistsMap, setPrExistsMap] = useState<Record<string, boolean>>({})
  const SHORTAGE_CACHE_PREFIX = 'batchShortages:'

  const saveShortagesToCache = (batchId: string, shortages: ShortageRow[]) => {
    try { localStorage.setItem(SHORTAGE_CACHE_PREFIX + batchId, JSON.stringify(shortages)) } catch {}
  }
  const removeShortagesFromCache = (batchId: string) => {
    try { localStorage.removeItem(SHORTAGE_CACHE_PREFIX + batchId) } catch {}
  }
  const loadShortagesFromCache = (batchId: string): ShortageRow[] | null => {
    try {
      const raw = localStorage.getItem(SHORTAGE_CACHE_PREFIX + batchId)
      return raw ? (JSON.parse(raw) as ShortageRow[]) : null
    } catch { return null }
  }

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
        .select("id, product_name, product_image_url, unit_of_measure, product_type")
        .eq('product_type', 'Finished Goods')
        .order("product_name", { ascending: true }),
      supabase.from("formulas").select("id, formula_name, product_id"),
    ]);
    setCustomers(c || []);
    setProducts(p || []);
    setFormulas(f || []);
  };

  // Helper: cast ID to number if numeric to satisfy RPC/query param types
  const castBatchId = (v: string): any => (/^\d+$/.test(String(v)) ? Number(v) : v)

  // Helper: sanitize PR note text to hide internal batch reference like 'for Batch-<uuid>'
  const sanitizePrNote = (note?: string | null): string => {
    if (!note) return ''
    try {
      return note.replace(/\s*for\s+Batch-[a-z0-9-]+/i, '').trim()
    } catch {
      return String(note)
    }
  }

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

  // Close row action menu on outside click
  useEffect(() => {
    if (!menuRowId) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const clickedInsideButton = !!(menuRef.current && menuRef.current.contains(target))
      const clickedInsidePopup = !!(menuPopupRef.current && menuPopupRef.current.contains(target))
      if (!clickedInsideButton && !clickedInsidePopup) {
        setMenuRowId(null)
        setMenuPosition(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuRowId])

  const loadBatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("production_batches")
        .select(
          "id, product_sku, qty, room, start_date, end_date, status, required_capacity, assigned_line, flags, formula_id, customer_id, lot_number, po_number, completed_qty, samples_received, samples_sent, created_at, source_po_id, source_po_line_id"
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
          sourcePoId: r.source_po_id || null,
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
    // Read poId from query string, if any
    try {
      const params = new URLSearchParams(location.search)
      const poId = params.get('poId')
      if (poId) setHighlightPoId(poId)
    } catch {}

    // Load lookups first, then batches (so map has names)
    (async () => {
      await loadLookups();
      await loadBatches();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

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
      if (!scheduledDate || !selectedCustomerId || !selectedProductId || !qty) {
        return;
      }

      const productName = selectedProductName || "Product";
      const goalQty = Number(qty || 0);
      const doneQty = Number(completedQty || 0);

      const payload: Omit<BatchRow, "id"> = {
        product_sku: productName,
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

      // 1️⃣ Insert batch and get ID
      const { data: created, error: insertErr } = await supabase
        .from("production_batches")
        .insert(payload)
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      // 2️⃣ Generate required materials (IMPORTANT!)
      const { error: reqErr } = await supabase.rpc(
        "fn_generate_requirements_for_batch",
        { p_batch_id: created.id }
      );
      if (reqErr) throw reqErr;

      // 3️⃣ Finalize
      resetCreateForm();
      setOpen(false);
      await loadBatches();
      pushToast({ type: "success", message: "Production schedule created" });

    } catch (e) {
      console.warn("Create batch error:", e);
      pushToast({ type: "error", message: "Failed to create schedule" });
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
        "id, product_sku, qty, room, start_date, end_date, status, required_capacity, assigned_line, flags, formula_id, customer_id, lot_number, po_number, completed_qty, samples_received, samples_sent, created_at, source_po_id, source_po_line_id"
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
      // Only send editable columns; avoid sending immutable/source link fields
      const payload: any = {
        product_sku: editItem.product_sku,
        qty: editItem.qty,
        room: editItem.room,
        start_date: editItem.start_date,
        end_date: editItem.end_date,
        status: editItem.status,
        required_capacity: editItem.required_capacity,
        assigned_line: editItem.assigned_line,
        flags: editItem.flags,
        formula_id: editItem.formula_id,
        customer_id: editItem.customer_id,
        lot_number: editItem.lot_number,
        po_number: editItem.po_number,
        completed_qty: editItem.completed_qty,
        samples_received: editItem.samples_received,
        samples_sent: editItem.samples_sent,
      };
      const { error } = await supabase
        .from("production_batches")
        .update(payload)
        .eq("id", editItem.id);
      if (error) throw error;
      // Pull the updated row to reflect instantly without full reload
      const { data: updated, error: selErr } = await supabase
        .from("production_batches")
        .select(
          "id, product_sku, qty, room, start_date, end_date, status, required_capacity, assigned_line, flags, formula_id, customer_id, lot_number, po_number, completed_qty, samples_received, samples_sent, created_at, source_po_id, source_po_line_id"
        )
        .eq("id", editItem.id)
        .single();
      if (selErr) throw selErr;

      // Update table row state
      if (updated) {
        const updatedRow: ScheduleItem = {
          id: String(updated.id),
          product: String(updated.product_sku || ""),
          customer: customersMap.get(String(updated.customer_id || "")) || "",
          formula: formulasMap.get(String(updated.formula_id || "")) || "",
          qty: Number(updated.qty || 0),
          completedQty: Number(updated.completed_qty || 0),
          room: String(updated.room || updated.assigned_line || ""),
          startDate: updated.start_date || "",
          status: updated.status || "Scheduled",
          lot: updated.lot_number || "",
          po: updated.po_number || "",
          sourcePoId: updated.source_po_id || null,
        };
        setItems(prev => prev.map(r => r.id === updatedRow.id ? updatedRow : r));
      }
      setEditItem(null);
      pushToast({ type: 'success', message: 'Batch updated' })
    } catch (e: any) {
      console.warn("Edit save error:", e);
      pushToast({ type: 'error', message: `Failed to update batch: ${e?.message || e}` })
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

  // Restore shortage caches after batches load so UI persists across reload/navigation
  useEffect(() => {
    if (!items || items.length === 0) return
    const nextDisabled: Record<string, boolean> = {}
    const nextCache: Record<string, ShortageRow[]> = {}
    for (const r of items) {
      const s = loadShortagesFromCache(r.id)
      if (s && s.length) {
        nextDisabled[r.id] = true
        nextCache[r.id] = s
      }
    }
    if (Object.keys(nextDisabled).length) setStartDisabled(prev => ({ ...prev, ...nextDisabled }))
    if (Object.keys(nextCache).length) setShortagesCache(prev => ({ ...prev, ...nextCache }))
    // Also detect existing PRs for these batches to persist the indicator via DB
    ;(async () => {
      try {
        const ids = items.map(i => castBatchId(i.id))
        if (!ids.length) return
        const { data } = await supabase
          .from('purchase_requisitions')
          .select('id, batch_id')
          .in('batch_id', ids)
        const map: Record<string, boolean> = {}
        for (const pr of data || []) {
          if (pr.batch_id) map[String(pr.batch_id)] = true
        }
        setPrExistsMap(map)
      } catch {}
    })()
  }, [items])

  // ───────── Row actions (RPC)
  const onStartBatch = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc('fn_reserve_for_batch', { p_batch_id: castBatchId(id) })
      if (error) throw error
      // If API returns shortages object, show modal and disable Start for this row
      if (data && typeof data === 'object' && (data as any).status === 'error' && Array.isArray((data as any).shortages)) {
        const s = (data as any).shortages as ShortageRow[]
        setShortageInfo({ batchId: id, shortages: s })
        setStartDisabled(prev => ({ ...prev, [id]: true }))
        setShortagesCache(prev => ({ ...prev, [id]: s }))
        saveShortagesToCache(id, s)
        pushToast({ type: 'error', message: 'Shortages detected. PRs created.' })
        return
      }
      // Success path
      await loadBatches()
      pushToast({ type: 'success', message: 'Batch started successfully' })
      // If batch can start, clear any cached shortage
      removeShortagesFromCache(id)
      setStartDisabled(prev => { const n = { ...prev }; delete n[id]; return n })
      setShortagesCache(prev => { const n = { ...prev }; delete n[id]; return n })
    } catch (e: any) {
      console.warn('Start batch error:', e)
      pushToast({ type: 'error', message: `Failed to start batch: ${e?.message || e}` })
    }
  }

  const onCancelBatch = async (id: string) => {
    try {
      const { error } = await supabase.rpc('fn_release_reservations', { p_batch_id: castBatchId(id) })
      if (error) throw error
      await loadBatches()
      pushToast({ type: 'success', message: 'Batch cancelled and materials released' })
    } catch (e: any) {
      console.warn('Cancel batch error:', e)
      pushToast({ type: 'error', message: `Failed to cancel batch: ${e?.message || e}` })
    }
  }

  const [completeId, setCompleteId] = useState<string | null>(null)
  const [completeQty, setCompleteQty] = useState<string>('0')
  const confirmComplete = async () => {
    if (!completeId) return
    try {
      const { error } = await supabase.rpc('fn_complete_batch', { p_batch_id: castBatchId(completeId), p_completed_qty: Number(completeQty || 0) })
      if (error) throw error
      setCompleteId(null)
      setCompleteQty('0')
      await loadBatches()
      pushToast({ type: 'success', message: 'Batch completed' })
    } catch (e: any) {
      console.warn('Complete batch error:', e)
      pushToast({ type: 'error', message: `Failed to complete batch: ${e?.message || e}` })
    }
  }

  const onGeneratePO = async (id: string) => {
    try {
      const { error } = await supabase.rpc('fn_generate_po_for_batch_shortages', { p_batch_id: castBatchId(id) })
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
          <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-soft">
                <thead className="bg-neutral-light/60">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Qty Goal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Completed
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
                  {filtered.map((row) => {
                    const isHighlighted = highlightPoId && row.sourcePoId && String(row.sourcePoId) === highlightPoId
                    return (
                    <tr
                      key={row.id}
                      className={
                        isHighlighted
                          ? "bg-teal-50/60 hover:bg-teal-50 border-l-4 border-teal-400"
                          : "hover:bg-neutral-light/40"
                      }
                      onClick={() => { setHighlightPoId(null); setMenuRowId(null); setMenuPosition(null); }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-neutral-dark">
                          {row.product}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.qty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.completedQty}
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
                        <div className="flex items-center justify-end gap-3">
                          {/* Action buttons horizontal, smaller */}
                          <div className="flex flex-row gap-1">
                            <button
                              className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px]"
                              disabled={!!(startDisabled[row.id] || shortagesCache[row.id] || prExistsMap[row.id])}
                              onClick={(e) => { e.stopPropagation(); onStartBatch(row.id); }}
                            >
                              Start
                            </button>
                            {shortagesCache[row.id] && (
                              <button
                                className="px-2.5 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 text-[11px]"
                                onClick={(e) => { e.stopPropagation(); setShortageInfo({ batchId: row.id, shortages: shortagesCache[row.id] }); }}
                                title="View detected material shortages"
                              >
                                View Shortage
                              </button>
                            )}
                            {!shortagesCache[row.id] && prExistsMap[row.id] && (
                              <button
                                className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px]"
                                onClick={async (e) => { 
                                  e.stopPropagation(); 
                                  const { data } = await supabase
                                    .from('purchase_requisitions')
                                    .select('id, item_name, required_qty, needed_by, status, created_at, notes')
                                    .eq('batch_id', row.id)
                                    .order('created_at', { ascending: false })
                                  setPrs(data || [])
                                  setPrListOpenFor(row.id)
                                }}
                                title="View auto-created PRs for this batch"
                              >
                                View PRs
                              </button>
                            )}
                            <button
                              className="px-2.5 py-1 rounded-md bg-neutral-light text-neutral-dark hover:bg-neutral-soft text-[11px]"
                              onClick={(e) => { e.stopPropagation(); onCancelBatch(row.id); }}
                            >
                              Cancel
                            </button>
                            <button
                              className="px-2.5 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 text-[11px]"
                              onClick={(e) => { e.stopPropagation(); setCompleteId(row.id); }}
                            >
                              Complete
                            </button>
                            <button
                              className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px]"
                              onClick={(e) => { e.stopPropagation(); onGeneratePO(row.id); }}
                            >
                              Auto-PO
                            </button>
                          </div>

                          {/* More menu for view/edit/delete */}
                          <div className="relative">
                            <button
                              ref={menuRef}
                              className="p-2 rounded-full hover:bg-neutral-light"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (menuRowId === row.id) {
                                  setMenuRowId(null);
                                  setMenuPosition(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMenuPosition({
                                    top: rect.bottom + 4,
                                    left: rect.right - 128 // 128px = w-32
                                  });
                                  setMenuRowId(row.id);
                                }
                              }}
                              title="More actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fixed positioned dropdown menu */}
        {menuRowId && menuPosition && (
          <div 
            ref={menuPopupRef}
            className="fixed w-32 bg-white border border-neutral-soft rounded-lg shadow-lg z-50 text-xs"
            style={{ 
              top: `${menuPosition.top}px`, 
              left: `${menuPosition.left}px` 
            }}
          >
            <button
              className="w-full flex items-center px-3 py-2 hover:bg-neutral-light/60"
              onClick={(e) => { 
                e.stopPropagation(); 
                const row = filtered.find(r => r.id === menuRowId);
                if (row) setViewItem(row); 
                setMenuRowId(null);
                setMenuPosition(null);
              }}
            >
              <Eye className="h-3.5 w-3.5 mr-2" /> View
            </button>
            <button
              className="w-full flex items-center px-3 py-2 hover:bg-neutral-light/60"
              onClick={async (e) => {
                e.stopPropagation();
                if (menuRowId) {
                  const full = await fetchRowById(menuRowId);
                  setEditItem(full);
                }
                setMenuRowId(null);
                setMenuPosition(null);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
            </button>
            <button
              className="w-full flex items-center px-3 py-2 hover:bg-red-50 text-accent-danger"
              onClick={(e) => { 
                e.stopPropagation(); 
                setDelId(menuRowId); 
                setMenuRowId(null);
                setMenuPosition(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </button>
          </div>
        )}

        {/* Shortage Modal */}
        {shortageInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShortageInfo(null)}></div>
            <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-dark">Production Cannot Start – Material Shortage Detected</h3>
                  <p className="text-sm text-neutral-medium">This batch cannot begin production because required raw materials are insufficient.</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-light/50">
                        <th className="px-4 py-2 text-left border border-neutral-soft">Material</th>
                        <th className="px-4 py-2 text-right border border-neutral-soft">Required Qty</th>
                        <th className="px-4 py-2 text-right border border-neutral-soft">Available Qty</th>
                        <th className="px-4 py-2 text-right border border-neutral-soft">Shortage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shortageInfo.shortages.map((s, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 border border-neutral-soft">{s.material}</td>
                          <td className="px-4 py-2 text-right border border-neutral-soft">{s.required}</td>
                          <td className="px-4 py-2 text-right border border-neutral-soft">{s.available}</td>
                          <td className="px-4 py-2 text-right border border-neutral-soft text-accent-danger font-semibold">{s.shortage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-neutral-medium">Auto-generated purchase requisitions have been created for these items.</div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    className="px-5 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm"
                    onClick={async () => {
                      // Load PRs for this batch
                      const { data } = await supabase
                        .from('purchase_requisitions')
                        .select('id, item_name, required_qty, needed_by, status, created_at, notes')
                        .eq('batch_id', shortageInfo.batchId)
                        .order('created_at', { ascending: false })
                      setPrs(data || [])
                      setPrListOpenFor(shortageInfo.batchId)
                    }}
                  >
                    View Purchase Requisitions
                  </button>
                  <button className="px-4 py-2 rounded-lg border" onClick={() => setShortageInfo(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PR List Modal (message layout) */}
        {prListOpenFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setPrListOpenFor(null)}></div>
            <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Purchase Requisitions Created</h3>
                    <p className="text-xs text-neutral-medium">These requisitions were auto-generated due to material shortages. Records are read-only.</p>
                  </div>
                </div>
                <button className="p-2" onClick={() => setPrListOpenFor(null)}><X className="h-5 w-5"/></button>
              </div>
              <div className="p-6 space-y-4">
                {prs.length === 0 && (
                  <div className="text-sm text-neutral-medium">No purchase requisitions found for this batch.</div>
                )}
                {prs.map((p: any) => (
                  <div key={p.id} className="rounded-xl border border-neutral-soft bg-neutral-light/40 p-4">
                    <div className="text-sm text-neutral-dark">
                      <p className="mb-1"><span className="font-semibold">Item:</span> {p.item_name}</p>
                      <p className="mb-1"><span className="font-semibold">Required Qty:</span> {p.required_qty}</p>
                      <p className="mb-1"><span className="font-semibold">Needed By:</span> {fmtDate(p.needed_by)}</p>
                      <p className="mb-1"><span className="font-semibold">Status:</span> {p.status}</p>
                      <p className="mb-1"><span className="font-semibold">Created:</span> {fmtDate(p.created_at)}</p>
                      {p.notes && (
                        <p className="mt-2 text-[13px] text-neutral-dark"><span className="font-semibold">Notes:</span> {sanitizePrNote(p.notes)}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-2 text-xs text-neutral-medium">For audit purposes, these entries cannot be modified or deleted from this screen.</div>
              </div>
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
                    <label className="text-sm font-medium">Customer</label>
                    <select
                      value={editItem.customer_id || ''}
                      onChange={(e) => setEditItem({ ...editItem, customer_id: e.target.value || null })}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="">Select Customer</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.company_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Formula</label>
                    <select
                      value={editItem.formula_id || ''}
                      onChange={(e) => setEditItem({ ...editItem, formula_id: e.target.value || null })}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="">Select Formula</option>
                      {formulas.map(f => (
                        <option key={f.id} value={f.id}>{f.formula_name}</option>
                      ))}
                    </select>
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
                    <select
                      value={editItem.room || ''}
                      onChange={(e) => setEditItem({ ...editItem, room: e.target.value, assigned_line: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      {roomsList.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
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
