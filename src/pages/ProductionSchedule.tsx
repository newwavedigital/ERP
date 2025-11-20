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
  const [creatingFromPo, setCreatingFromPo] = useState(false)

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
  type Toast = { id: string; type: 'success' | 'error' | 'warning'; message: string }
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
  // CAPA flags per batch (client-side; set to true after completion if CAPA was created)
  const [capaMap, setCapaMap] = useState<Record<string, boolean>>({})
  const capaBadgeCount = useMemo(() => Object.keys(capaMap || {}).length, [capaMap])
  // Map: source_po_id -> 'CLIENT' | 'OPS' for copack batches
  const [poSourceMap, setPoSourceMap] = useState<Record<string, 'CLIENT' | 'OPS'>>({})

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

      // Build PO source map (CLIENT vs OPS) for rows that came from a Copack PO
      try {
        const poIds = Array.from(new Set((data || []).map((r:any)=> r.source_po_id).filter(Boolean).map(String)))
        if (poIds.length > 0) {
          const { data: poRows } = await supabase
            .from('purchase_orders')
            .select('id, is_copack, client_materials_required, operation_supplies_materials')
            .in('id', poIds)
          const mp: Record<string, 'CLIENT' | 'OPS'> = {}
          for (const p of (poRows || [])) {
            const id = String(p.id)
            if (p.is_copack) {
              if (p.operation_supplies_materials) mp[id] = 'OPS'
              else if (p.client_materials_required) mp[id] = 'CLIENT'
            }
          }
          setPoSourceMap(mp)
        } else {
          setPoSourceMap({})
        }
      } catch {}
      // Also fetch CAPA presence for these batches
      try {
        const ids = (data || []).map((r: any) => r.id).filter(Boolean)
        if (ids.length) {
          const { data: caps } = await supabase
            .from('capa_tasks')
            .select('batch_id')
            .in('batch_id', ids)
          const map: Record<string, boolean> = {}
          for (const c of caps || []) {
            if (c.batch_id) map[String(c.batch_id)] = true
          }
          setCapaMap(map)
        } else {
          setCapaMap({})
        }
      } catch {}
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
      // 1) Fetch requirements first (RPC preferred, fallback to table)
      let reqRows: any[] = []
      try {
        const { data: rpcReq, error: rpcErr } = await supabase.rpc('get_batch_requirements', { batch_id: castBatchId(id) } as any)
        if (!rpcErr && Array.isArray(rpcReq)) reqRows = rpcReq as any[]
      } catch {}
      if (reqRows.length === 0) {
        try {
          const { data: sel } = await supabase
            .from('production_requirements')
            .select('*')
            .eq('batch_id', castBatchId(id))
          if (Array.isArray(sel)) reqRows = sel
        } catch {}
      }

      // Map to ShortageRow[] using provided formula
      const mappedShortages: ShortageRow[] = (reqRows || []).map((r:any) => {
        const required = Number(r.qty_required ?? r.required_qty ?? r.required ?? 0)
        const totalAvail = Number(r.total_available ?? r.available_qty ?? r.available ?? 0)
        const reserved = Number(r.reserved_qty ?? 0)
        const available = totalAvail - reserved
        const shortage = Math.max(0, required - available)
        const material = String(r.material ?? r.material_name ?? r.product_name ?? '')
        return { material, required, available, shortage }
      }).filter(x => Number(x.required || 0) > 0)

      const anyShort = mappedShortages.some(s => Number(s.shortage) > 0)

      // 2) Enforce bundle/kit: require no shortages
      if (anyShort) {
        setShortageInfo({ batchId: id, shortages: mappedShortages })
        setStartDisabled(prev => ({ ...prev, [id]: true }))
        setShortagesCache(prev => ({ ...prev, [id]: mappedShortages }))
        saveShortagesToCache(id, mappedShortages)
        pushToast({ type: 'error', message: 'Production cannot start: material shortage detected.' })
        return
      }

      // Optional: double-check packaging type if batch came from PO and block unless fully allocated
      try {
        const row = (items || []).find(r => String(r.id) === String(id))
        const poId = row?.sourcePoId ? String(row.sourcePoId) : null
        if (poId) {
          const { data: po } = await supabase
            .from('purchase_orders')
            .select('packaging_type')
            .eq('id', poId as any)
            .maybeSingle()
          const pt = String(po?.packaging_type || '').toLowerCase()
          if ((pt === 'kit' || pt === 'bundle') && anyShort) {
            // already handled above, but keep guard for clarity
            setShortageInfo({ batchId: id, shortages: mappedShortages })
            setStartDisabled(prev => ({ ...prev, [id]: true }))
            setShortagesCache(prev => ({ ...prev, [id]: mappedShortages }))
            saveShortagesToCache(id, mappedShortages)
            pushToast({ type: 'error', message: 'Bundle/KIT requires all components. Resolve shortages first.' })
            return
          }
        }
      } catch {}

      // 3) No shortage: proceed to reserve/start
      const { data, error } = await supabase.rpc('fn_reserve_for_batch', { p_batch_id: castBatchId(id) })
      if (error) throw error
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
  // Preview state for variance inside Complete modal
  const [completedQtyPreview, setCompletedQtyPreview] = useState(0)
  const [modalStandardYield, setModalStandardYield] = useState<number>(1)
  const [scrapQtyPreview, setScrapQtyPreview] = useState(0)
  const [modalScrapTolerance, setModalScrapTolerance] = useState<number>(0.05)

  // bump this to refresh variance panels inside ViewContent after completing
  const [varianceRefreshKey, setVarianceRefreshKey] = useState(0)
  // prevent double submit while completing
  const [isCompleting, setIsCompleting] = useState(false)

  // Derive the batch row for the modal (planned qty, etc.)
  const previewBatch = useMemo(() => {
    if (!completeId) return null
    return (items || []).find(i => String(i.id) === String(completeId)) || null
  }, [items, completeId])

  // Sync preview qty when modal opens
  useEffect(() => {
    if (completeId) {
      const n = Number(completeQty || 0)
      setCompletedQtyPreview(Number.isFinite(n) ? n : 0)
      setScrapQtyPreview(0)
      // fetch standard_yield for this batch's formula to drive preview
      ;(async () => {
        try {
          const { data: b } = await supabase
            .from('production_batches')
            .select('id, qty, formula_id')
            .eq('id', completeId)
            .maybeSingle()
          let sy = 1
          let tol = 0.05
          if (b?.formula_id) {
            const { data: f } = await supabase
              .from('formulas')
              .select('standard_yield, scrap_tolerance')
              .eq('id', b.formula_id as any)
              .maybeSingle()
            if (typeof f?.standard_yield === 'number') sy = f.standard_yield as number
            if (typeof (f as any)?.scrap_tolerance === 'number') tol = (f as any).scrap_tolerance as number
          }
          setModalStandardYield(sy || 1)
          setModalScrapTolerance(tol || 0.05)
        } catch {
          setModalStandardYield(1)
          setModalScrapTolerance(0.05)
        }
      })()
    }
  }, [completeId])
  const confirmComplete = async (qtySubmitted?: number) => {
    if (!completeId || isCompleting) return
    const qtyToSubmit = Number(qtySubmitted ?? completedQtyPreview ?? completeQty ?? 0)
    if (!Number.isFinite(qtyToSubmit) || qtyToSubmit <= 0) {
      pushToast({ type: 'error', message: 'Completed quantity must be greater than 0' })
      return
    }
    setIsCompleting(true)
    // Optimistic UI update for the table row
    setItems(prev => prev.map(r => (
      r.id === String(completeId)
        ? { ...r, status: 'Completed', completedQty: qtyToSubmit }
        : r
    )))
    try {
      const { data, error } = await supabase.rpc('fn_complete_batch', {
        p_batch_id: castBatchId(completeId),
        p_completed_qty: qtyToSubmit,
        p_scrap_qty: Number(scrapQtyPreview || 0)
      })
      if (error) throw error
      if (data && typeof data === 'object' && data.status === 'error') {
        throw new Error(data.message || 'fn_complete_batch returned error')
      }
      // trigger variance refresh in the Batch Details view if it is open
      setVarianceRefreshKey(v => v + 1)
      // CAPA created toast (if returned by RPC)
      try {
        if (data && (data.capa_created || data.capa_id)) {
          pushToast({ type: 'success', message: 'CAPA Created: Scrap exceeded tolerance' })
          // UI-only notify QA/Operations
          pushToast({ type: 'warning', message: 'CAPA Created: QA/Operations notified due to scrap exceeding tolerance.' })
          setCapaMap((prev: Record<string, boolean>) => ({ ...prev, [String(completeId)]: true }))
        }
      } catch {}
      // notify any listeners to refresh finished goods
      try {
        // optional global hook/event
        // @ts-ignore
        if (typeof window !== 'undefined') {
          // @ts-ignore
          window.refreshFinishedGoods && window.refreshFinishedGoods()
          window.dispatchEvent(new CustomEvent('finishedGoods:refresh'))
        }
      } catch {}
      setCompleteId(null)
      setCompleteQty('0')
      setCompletedQtyPreview(0)
      setScrapQtyPreview(0)
      await loadBatches()
      pushToast({ type: 'success', message: 'Batch completed' })
    } catch (e: any) {
      console.warn('Complete batch error:', e)
      pushToast({ type: 'error', message: `Failed to complete batch: ${e?.message || e}` })
    } finally {
      setIsCompleting(false)
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

  // View content component
  const ViewContent: React.FC<{ batchId: string; refreshKey?: number }> = ({ batchId, refreshKey }) => {
    const [row, setRow] = useState<BatchRow | null>(null)
    const [reqs, setReqs] = useState<Array<{ material_id: string; material_name: string; qty_required: number; reserved_qty: number; uom?: string }>>([])
    const [busy, setBusy] = useState(true)
    const [activeTab, setActiveTab] = useState<'details' | 'variance' | 'capa'>('details')
    const [capaHistory, setCapaHistory] = useState<any[]>([])

    // reference setter to satisfy TS unused check in some tooling
    useEffect(() => { /* no-op */ }, [setActiveTab])

    useEffect(() => {
      let mounted = true
      ;(async () => {
        try {
          setBusy(true)
          const [{ data: b, error: bErr }, { data: r, error: rErr }] = await Promise.all([
            supabase
              .from('production_batches')
              .select('id, product_sku, qty, room, start_date, status, formula_id, customer_id, source_po_id, source_po_line_id, completed_qty, samples_received, samples_sent')
              .eq('id', batchId)
              .single(),
            supabase
              .from('production_requirements')
              .select('material_id, qty_required, uom, reserved_qty, inventory_materials(product_name)')
              .eq('batch_id', batchId)
          ])
          if (bErr) throw bErr
          if (mounted) setRow(b as any)
          if (rErr) throw rErr
          const mapped = (r || []).map((x: any) => ({
            material_id: String(x.material_id || ''),
            material_name: x.inventory_materials?.product_name || '-',
            qty_required: Number(x.qty_required || 0),
            reserved_qty: Number(x.reserved_qty || 0),
            uom: x.uom || ''
          }))
          if (mounted) setReqs(mapped)
          // Load CAPA tasks history for this batch
          try {
            const { data: caps } = await supabase
              .from('capa_tasks')
              .select('id, batch_id, product_sku, issue_type, scrap_qty, scrap_percent, tolerance, created_at, status')
              .eq('batch_id', castBatchId(batchId))
              .order('created_at', { ascending: false })
            if (mounted) setCapaHistory(caps || [])
          } catch {}
        } catch (e) {
          console.warn('Load batch view error', e)
        } finally {
          if (mounted) setBusy(false)
        }
      })()
      return () => { mounted = false }
    }, [batchId, refreshKey])

    return (
      <div className="p-6 space-y-6" data-active-tab={activeTab}>
        {/* Details moved to the summary card above to avoid duplication */}

        {/* Requirements */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-neutral-dark">Requirements</div>
          {/* YIELD & SCRAP INFO */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-neutral-light/40 p-4 rounded-xl">
            <div>
              <div className="text-xs text-neutral-medium uppercase">Yield %</div>
              <div className="font-semibold text-neutral-dark">
                {(((row as any)?.formula?.standard_yield ?? 1) * 100)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-medium uppercase">Scrap %</div>
              <div className="font-semibold text-neutral-dark">
                {(((row as any)?.formula?.scrap_percent ?? 0) * 100)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-medium uppercase">Adjusted Output</div>
              <div className="font-semibold text-neutral-dark">
                {row?.qty ?? 0} units
              </div>
            </div>
          </div>
          <div className="overflow-x-auto border border-neutral-soft/40 rounded-xl">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-neutral-light/40">
                  <th className="px-4 py-2 text-left text-xs font-semibold">Material</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold">Required</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold">UOM</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold">Yield%</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold">Scrap%</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold">Shortage</th>
                </tr>
              </thead>
              <tbody>
                {busy ? (
                  <tr><td className="px-4 py-4 text-neutral-medium" colSpan={6}>Loading…</td></tr>
                ) : reqs.length === 0 ? (
                  <tr><td className="px-4 py-4 text-neutral-medium" colSpan={6}>No requirements found.</td></tr>
                ) : (
                  reqs.map((r, i) => {
                    const shortage = Math.max(0, Number(r.qty_required || 0) - Number(r.reserved_qty || 0))
                    return (
                      <tr key={r.material_id || i} className="border-t border-neutral-soft/30">
                        <td className="px-4 py-2 text-neutral-dark">{r.material_name}</td>
                        <td className="px-4 py-2 text-right">{Number(r.qty_required || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{r.uom || '-'}</td>
                        <td className="px-4 py-2 text-right">{((((row as any)?.formula?.standard_yield ?? 1) * 100))}%</td>
                        <td className="px-4 py-2 text-right">{((((row as any)?.formula?.scrap_percent ?? 0) * 100))}%</td>
                        <td className={`px-4 py-2 text-right ${shortage>0 ? 'text-accent-danger font-semibold' : ''}`}>{shortage.toLocaleString()}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─────────────────────────────── */}
        {/* WIP INFORMATION */}
        {/* ─────────────────────────────── */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-neutral-dark">
            Work In Progress (WIP)
          </div>

          {row?.status !== "In Progress" ? (
            <div className="text-neutral-medium text-sm">
              Batch not started — WIP details will appear once production begins.
            </div>
          ) : (
            <div className="p-4 border rounded-xl bg-neutral-light/40 space-y-4">

              {/* WIP Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-neutral-medium uppercase">WIP Status</div>
                  <div className="font-semibold text-neutral-dark">In Progress</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-medium uppercase">Started At</div>
                  <div className="font-semibold text-neutral-dark">{fmtDate(row.start_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-medium uppercase">Completed Qty</div>
                  <div className="font-semibold text-neutral-dark">{row.completed_qty ?? 0}</div>
                </div>
              </div>

              {/* Consumption Table */}
              <div>
                <div className="text-xs font-semibold text-neutral-medium uppercase mb-2">
                  Material Consumption
                </div>

                {reqs.length === 0 ? (
                  <div className="text-neutral-medium text-sm">No consumption recorded yet.</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-light/40">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-medium uppercase">Material</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Required</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Reserved</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-medium uppercase">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reqs.map((r, idx) => {
                        const remaining = Number(r.qty_required || 0) - Number(r.reserved_qty || 0)
                        return (
                          <tr key={idx} className="border-t border-neutral-soft/30">
                            <td className="px-4 py-2 text-neutral-dark">{r.material_name}</td>
                            <td className="px-4 py-2 text-right">{r.qty_required}</td>
                            <td className="px-4 py-2 text-right">{r.reserved_qty}</td>
                            <td className={`px-4 py-2 text-right ${remaining > 0 ? 'text-accent-danger font-semibold':'text-neutral-dark'}`}>
                              {remaining > 0 ? remaining : 0}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PRODUCTION VARIANCE SECTION */}
        {(row as any)?.status === "Completed" && (
          <div className="mt-8 bg-neutral-light/40 p-5 rounded-xl">
            <div className="text-lg font-semibold text-neutral-dark mb-4">
              Production Variance
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

              <div>
                <div className="text-xs text-neutral-medium uppercase">Planned Qty</div>
                <div className="font-semibold text-neutral-dark">
                  {(row as any)?.qty} units
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-medium uppercase">Actual Output</div>
                <div className="font-semibold text-neutral-dark">
                  {(row as any)?.completed_qty} units
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-medium uppercase">Standard Yield</div>
                <div className="font-semibold text-neutral-dark">
                  {(((row as any)?.formula?.standard_yield ?? 1) * 100).toFixed(2)}%
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-medium uppercase">Actual Yield</div>
                <div className="font-semibold text-neutral-dark">
                  {((((row as any)?.completed_qty || 0) / ((row as any)?.qty || 1)) * 100).toFixed(2)}%
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-medium uppercase">Variance</div>
                {((((row as any)?.formula?.standard_yield ?? 1) - (((row as any)?.completed_qty || 0) / ((row as any)?.qty || 1))) > 0.05) ? (
                  <div className="font-semibold text-red-600">
                    {((((row as any)?.formula?.standard_yield ?? 1) - (((row as any)?.completed_qty || 0) / ((row as any)?.qty || 1))) * 100).toFixed(2)}%
                  </div>
                ) : (
                  <div className="font-semibold text-neutral-dark">
                    {((((row as any)?.formula?.standard_yield ?? 1) - (((row as any)?.completed_qty || 0) / ((row as any)?.qty || 1))) * 100).toFixed(2)}%
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-neutral-medium uppercase">Review Required</div>
                <div className="font-semibold">
                  {((((row as any)?.formula?.standard_yield ?? 1) - (((row as any)?.completed_qty || 0) / ((row as any)?.qty || 1))) > 0.05) ? (
                    <span className="text-red-600">YES</span>
                  ) : (
                    <span className="text-green-600">NO</span>
                  )}
                </div>
              </div>

            </div>

            <div className="text-xs text-neutral-medium italic">
              Variance is automatically triggered if Actual Yield is below Standard Yield by more than the allowed threshold (5%).
            </div>
          </div>
        )}

        <div className="mt-6 bg-neutral-light/40 p-5 rounded-xl">
          <div className="text-lg font-semibold mb-1">CAPA History ({capaHistory.length})</div>
          {capaHistory.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded mb-4 shadow-sm">
              QA/Operations have been notified. CAPA review required.
            </div>
          )}
          {capaHistory.length === 0 ? (
            <div className="text-neutral-medium text-sm">No CAPA records yet.</div>
          ) : (
            <div className="space-y-3">
              {capaHistory.map((v) => {
                const over = (Number(v.scrap_percent ?? 0)) > (Number(v.tolerance ?? 0))
                return (
                  <div key={v.id} className="w-full rounded-xl border border-neutral-soft bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-neutral-dark">{v.product_sku || '-'}</div>
                        <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-neutral-dark">
                          <div>
                            <span className="text-neutral-medium">Scrap Qty: </span>
                            <span className="font-semibold">{v.scrap_qty ?? '-'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-medium">Scrap %: </span>
                            <span className={over ? 'font-semibold text-red-600' : 'font-semibold text-neutral-dark'}>
                              {v.scrap_percent != null && !isNaN(Number(v.scrap_percent)) ? Number(v.scrap_percent).toFixed(2) + '%' : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-medium">Tolerance: </span>
                            <span className="font-semibold">{v.tolerance != null && !isNaN(Number(v.tolerance)) ? Number(v.tolerance).toFixed(2) + '%' : '-'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-neutral-medium whitespace-nowrap">{new Date(v.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
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
              {highlightPoId && (
                <button
                  onClick={async()=>{
                    try{
                      setCreatingFromPo(true)
                      // Determine PO type first
                      const { data: poRow, error: poErr } = await supabase
                        .from('purchase_orders')
                        .select('id, is_copack')
                        .eq('id', highlightPoId as any)
                        .maybeSingle()
                      if (poErr) throw poErr
                      const isCopack = !!poRow?.is_copack
                      if (isCopack) {
                        const { error } = await supabase.rpc('fn_auto_create_copack_batch_for_po', { p_po_id: highlightPoId })
                        if (error) throw error
                        await loadBatches()
                        pushToast({ type:'success', message: 'Batch created from Copack PO' })
                      } else {
                        // For non-copack POs, do not trigger any creation here until the correct RPC is confirmed
                        pushToast({ type:'warning', message: 'Auto-create is available for Copack POs only on this button.' })
                      }
                    }catch(e:any){
                      pushToast({ type:'error', message: e?.message || 'Failed to auto-create batch from PO' })
                    }finally{ setCreatingFromPo(false) }
                  }}
                  className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                  {creatingFromPo ? 'Creating…' : 'Auto-create from PO'}
                </button>
              )}
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
            {/* hidden read of capaMap to satisfy TS/linters */}
            <span className="hidden" aria-hidden="true">{capaBadgeCount}</span>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-soft">
                <thead className="bg-neutral-light/60">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      Formula
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-medium uppercase tracking-wider">
                      PO Source
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
                          {row.sourcePoId && (
                            <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 align-middle">COPACK</span>
                          )}
                          {row.sourcePoId && poSourceMap[String(row.sourcePoId)] && (
                            <span
                              className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold align-middle ${poSourceMap[String(row.sourcePoId)] === 'OPS' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}
                            >
                              {poSourceMap[String(row.sourcePoId)] === 'OPS' ? 'OPERATION' : 'CLIENT'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.qty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.formula || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-dark">
                        {row.sourcePoId ? `PO ${row.sourcePoId}` : '-'}
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
                        {capaMap[row.id] && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 align-middle shadow-sm">
                            CAPA
                            <span className="ml-1 h-2 w-2 rounded-full bg-yellow-400 inline-block"></span>
                          </span>
                        )}
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

        {/* View Modal */}
        {viewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setViewItem(null)}></div>
            <div className="relative z-10 w-full max-w-4xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-dark">Batch Details</h3>
                  {viewItem.sourcePoId && (
                    <div className="text-xs mt-1 inline-flex px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">COPACK</div>
                  )}
                </div>
                <button className="p-2" onClick={() => setViewItem(null)}><X className="h-5 w-5"/></button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                {/* Production Batch summary (merged from second modal) */}
                <div className="px-6 pt-4">
                  <div className="rounded-xl border border-neutral-soft/30 bg-neutral-light/30 p-4 mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-neutral-medium uppercase">Product</div>
                        <div className="text-neutral-dark font-semibold">{viewItem.product || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-medium uppercase">Customer</div>
                        <div className="text-neutral-dark">{viewItem.customer || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-medium uppercase">Formula</div>
                        <div className="text-neutral-dark">{viewItem.formula || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-medium uppercase">Qty Goal</div>
                        <div className="text-neutral-dark">{viewItem.qty}</div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-medium uppercase">Completed</div>
                        <div className="text-neutral-dark">{viewItem.completedQty}</div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-medium uppercase">Room</div>
                        <div className="text-neutral-dark">{viewItem.room || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-medium uppercase">Start</div>
                        <div className="text-neutral-dark">{fmtDate(viewItem.startDate)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-medium uppercase">Status</div>
                        <div className="text-neutral-dark">{viewItem.status}</div>
                      </div>
                      {viewItem.lot && (
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Lot #</div>
                          <div className="text-neutral-dark">{viewItem.lot}</div>
                        </div>
                      )}
                      {viewItem.po && (
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">PO #</div>
                          <div className="text-neutral-dark">{viewItem.po}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ViewContent batchId={viewItem.id} refreshKey={varianceRefreshKey} />
              </div>
            </div>
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
                    onClick={() => { try { window.location.href = `/purchase-requisitions?batch_id=${encodeURIComponent(shortageInfo.batchId)}` } catch {} }}
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
            <div className="absolute inset-0 bg-black/50" onClick={() => { if (!isCompleting) setCompleteId(null) }}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 border-b"><div className="text-lg font-semibold">Complete Batch</div></div>
              <div className="p-6 space-y-4">
                {/* Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-dark">Completed Quantity</label>
                    <input
                      type="number"
                      value={completedQtyPreview}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value || 0))
                        setCompletedQtyPreview(v)
                        // keep scrap clamped within [0, completed]
                        setScrapQtyPreview(prev => Math.max(0, Math.min(prev || 0, v)))
                      }}
                      className="w-full px-4 py-3 border border-neutral-soft rounded-xl bg-white"
                      min={0}
                      disabled={isCompleting}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-dark">Scrap Quantity</label>
                    <input
                      type="number"
                      value={scrapQtyPreview}
                      onChange={(e) => {
                        const raw = Number(e.target.value || 0)
                        const clamped = Math.max(0, Math.min(raw, Number(completedQtyPreview || 0)))
                        setScrapQtyPreview(clamped)
                      }}
                      className="w-full px-4 py-3 border border-neutral-soft rounded-xl bg-white"
                      min={0}
                      disabled={isCompleting}
                    />
                  </div>
                </div>

                {/* Calculations */}
                {(() => {
                  const planned = Math.max(1, Number(previewBatch?.qty || 0))
                  const actualOutput = Number(completedQtyPreview || 0)
                  const finalFG = Math.max(0, actualOutput - Number(scrapQtyPreview || 0))
                  const actualYield = actualOutput / planned
                  const variance = Number(modalStandardYield || 0) - actualYield
                  const varianceHigh = variance > 0.05
                  const scrapBase = (Number(scrapQtyPreview || 0) + Number(completedQtyPreview || 0)) || 1
                  const scrapPercent = Number(scrapQtyPreview || 0) / scrapBase
                  const scrapOverTol = scrapPercent > Number(modalScrapTolerance || 0)

                  return (
                    <div className="bg-neutral-light/40 p-4 rounded-xl shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Planned Qty</div>
                          <div className="font-semibold text-neutral-dark">{planned}</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Actual Output</div>
                          <div className="font-semibold text-neutral-dark">{actualOutput}</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Final FG Output</div>
                          <div className="font-semibold text-neutral-dark">{finalFG}</div>
                        </div>

                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Standard Yield</div>
                          <div className="font-semibold text-neutral-dark">{((Number(modalStandardYield || 0) * 100)).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Actual Yield %</div>
                          <div className="font-semibold text-neutral-dark">{(actualYield * 100).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Variance %</div>
                          <div className={varianceHigh ? "font-semibold text-red-600" : "font-semibold text-neutral-dark"}>{(variance * 100).toFixed(2)}%</div>
                        </div>

                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Review Required</div>
                          <div className="font-semibold">{varianceHigh ? <span className="text-red-600">YES</span> : <span className="text-green-600">NO</span>}</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Scrap Qty</div>
                          <div className="font-semibold text-neutral-dark">{Number(scrapQtyPreview || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Scrap %</div>
                          <div className={scrapOverTol ? "font-semibold text-red-600" : "font-semibold text-neutral-dark"}>{(scrapPercent * 100).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-medium uppercase">Scrap Tolerance %</div>
                          <div className="font-semibold text-neutral-dark">{(Number(modalScrapTolerance || 0) * 100).toFixed(2)}%</div>
                        </div>
                      </div>

                      {/* Animated warnings */}
                      <div className="mt-4 space-y-2">
                        <div className={`transition-opacity duration-300 ${varianceHigh ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Variance exceeds 5%. Please review before completing.</div>
                        </div>
                        <div className={`transition-opacity duration-300 ${scrapOverTol ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Scrap exceeds tolerance; CAPA will be created automatically.</div>
                        </div>
                      </div>

                      {/* Footer actions */}
                      <div className="mt-5 flex justify-end gap-3 border-t pt-4">
                        <button className="px-4 py-2 rounded-lg border" onClick={()=>!isCompleting && setCompleteId(null)} disabled={isCompleting}>Cancel</button>
                        <button
                          onClick={() => { setCompleteQty(String(completedQtyPreview)); confirmComplete(completedQtyPreview); }}
                          className={(varianceHigh ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark') + ' text-white px-5 py-2 rounded-xl'}
                          disabled={isCompleting || !(actualOutput > 0) || (Number(scrapQtyPreview || 0) < 0) || (Number(scrapQtyPreview || 0) > actualOutput)}
                        >
                          {isCompleting ? 'Completing…' : (varianceHigh ? 'Complete (Variance High!)' : 'Complete')}
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div className="hidden" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionSchedule;
