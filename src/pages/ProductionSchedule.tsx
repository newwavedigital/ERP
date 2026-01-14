// src/pages/ProductionSchedule.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from 'react-router-dom'
import { Calendar, X, Plus, Eye, Pencil, Trash2, MoreVertical, AlertTriangle, FileText, Lightbulb, CheckCircle2, Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import ProductionLines from "./ProductionLines";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Customer = { id: string; company_name: string };

// COA fail detector (UI only)
const hasCoaFlag = (flags: any): boolean => {
  try {
    if (!flags) return false
    if (typeof flags === 'string') return flags.toUpperCase().includes('COA_FAIL')
    const s = JSON.stringify(flags).toUpperCase()
    return s.includes('COA_FAIL')
  } catch { return false }
}
const isCoaFail = (row: { status?: string; flags?: any }) => {
  const st = String(row.status || '')
  return st === 'COA Failed' || (st.toUpperCase() === 'QA_HOLD' && hasCoaFlag(row.flags))
}

const diffMinutes = (a?: string | null, b?: string | null): number | null => {
  if (!a || !b) return null
  try { return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) } catch { return null }
}
type Product = { id: string; product_name: string; product_image_url?: string; unit_of_measure?: string; allergen_profile?: string[]; formula_id?: string | null; formula_name?: string | null };
type Formula = { id: string; formula_name: string };
type ProductionLine = { id: string; line_name: string; allowed_allergens: string[] | null; sanitation_minutes?: number | null; needs_qa_signoff?: boolean | null };

// QA Hold component type for modal display
interface QAHoldComponent {
  material_id: string;
  material_name: string;
  sku: string | null;
  qa_hold_reason: string | null;
}

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
  // Compliance fields
  sanitation_required?: boolean | null;
  sanitation_start?: string | null;
  sanitation_end?: string | null;
  qa_required?: boolean | null;
  qa_approved?: boolean | null;
};

type ScheduleItem = {
  id: string;
  sku?: string;
  product?: string | null;
  customer: string;
  formula: string;
  qty: number;
  completedQty: number;
  room: string;
  startDate: string;
  status: string;
  lot?: string | null;
  po?: string;
  sourcePoId?: string | null;
  createdAt?: string | null;
  // Compliance
  sanitationRequired?: boolean | null;
  sanitationStart?: string | null;
  sanitationEnd?: string | null;
  qaRequired?: boolean | null;
  qaApproved?: boolean | null;
  flags?: any;
  batchType?: string | null; // Original or Rework
};

// ─────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────
const statusList = ["Scheduled", "In Progress", "Production Complete", "Completed", "Quality Hold", "Ready to Ship", "Shipped", "COA Failed", "Delayed"];
const yesNo = ["No", "Yes"];

const statusChip = (status: string) => {
  switch (status) {
    case "Scheduled":
      return "bg-blue-100 text-blue-800";
    case "In Progress":
      return "bg-yellow-100 text-yellow-800";
    case "Production Complete":
      return "bg-orange-100 text-orange-800";
    case "Completed":
      return "bg-green-100 text-green-800";
    case "Quality Hold":
      return "bg-purple-100 text-purple-800 border border-purple-200";
    case "Ready to Ship":
      return "bg-emerald-100 text-emerald-800";
    case "Shipped":
      return "bg-gray-100 text-gray-800";
    case "COMPLETED_REWORK":
      return "bg-green-100 text-green-800";
    case "QA_HOLD":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "COA Failed":
      return "bg-rose-100 text-rose-800 border border-rose-200";
    case "Delayed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const statusText = (status: string) => {
  switch (status) {
    case "COMPLETED_REWORK":
      return "Rework Completed";
    case "Production Complete":
      return "Production Complete";
    case "Quality Hold":
      return "Quality Hold";
    case "Ready to Ship":
      return "Ready to Ship";
    default:
      return status;
  }
};

// Role-based access helpers
const canManageProduction = (role: string | null) => {
  return role === 'production_manager' || role === 'admin'
}

const canManageWarehouse = (role: string | null) => {
  return role === 'admin'
}

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
  const { user } = useAuth()
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const isScheduleFromPoViewOnly = ['warehouse', 'sales_representative', 'finance', 'procurement', 'supply_chain_procurement'].includes(String(currentUserRole || '').toLowerCase())

  // Reference datasets
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; product_name: string } | null>(null);
  const [isProductOpen, setIsProductOpen] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const menuPopupRef = useRef<HTMLDivElement | null>(null);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);

  const productionLineNames = useMemo(() => {
    return (productionLines || [])
      .map((pl) => String(pl?.line_name || '').trim())
      .filter(Boolean)
  }, [productionLines])

  // Batches table
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingFromPo, setCreatingFromPo] = useState(false)

  const tabs: Array<{ key: string; label: string; color?: string }> = useMemo(() => {
    return [{ key: 'All', label: 'All' }].concat(
      productionLineNames.map((n) => ({ key: n, label: n }))
    )
  }, [productionLineNames])

  // Batch type filter (Original vs Rework)
  const [batchKind, setBatchKind] = useState<'original' | 'rework'>('original')
  const [activeTab, setActiveTab] = useState<string>("All");
  const [activeSection, setActiveSection] = useState<'schedule' | 'lines'>('schedule');
  // Signals to control embedded ProductionLines actions
  const [linesRefreshSignal, setLinesRefreshSignal] = useState(0)
  const [linesOpenCreateSignal, setLinesOpenCreateSignal] = useState(0)

  // Create form state
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>("");
  const [room, setRoom] = useState<string>("");
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

  // PO Selection Panel State
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const [scheduleFromPoOpen, setScheduleFromPoOpen] = useState(false);
  const [batchGoal, setBatchGoal] = useState<string>("");
  const [productGoal, setProductGoal] = useState<number>(0);
  const [alreadyScheduled, setAlreadyScheduled] = useState<number>(0);

  // Notifications
  type Toast = { id: string; type: 'success' | 'error' | 'warning'; message: string }
  const [toasts, setToasts] = useState<Toast[]>([])
  const pushToast = (t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, ...t }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4000)
  }

  // CAPA flags per batch (client-side; set to true after completion if CAPA was created)
  const [capaMap, setCapaMap] = useState<Record<string, boolean>>({})
  const [capaEverMap, setCapaEverMap] = useState<Record<string, boolean>>({})
  const [capaScrapQtyMap, setCapaScrapQtyMap] = useState<Record<string, number>>({})

  // Merge batches modal state
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeTargets, setMergeTargets] = useState<ScheduleItem[]>([])
  const handleOpenMergeModal = (batches: ScheduleItem[]) => {
    setMergeTargets(batches)
    setMergeModalOpen(true)
  }
  const handleOpenEditFromStartError = async (batchId: string) => {
    try {
      const row = await fetchRowById(batchId)
      setEditItem(row)
    } catch {
      // fall back to toast
      pushToast({ type: 'error', message: 'Unable to open batch for editing.' })
    } finally {
      setStartErrorModal(null)
    }
  }
  const handleConfirmMerge = async () => {
    try {
      const ids = mergeTargets.map(b => b.id)
      const { error } = await supabase.rpc('merge_batches', { batch_ids: ids as any })
      if (error) { pushToast({ type:'error', message: `Merge failed: ${error.message}` }); return }
      pushToast({ type:'success', message: 'Batches merged successfully' })
      setMergeModalOpen(false)
      await loadBatches()
    } catch (e:any) {
      pushToast({ type:'error', message: `Merge failed: ${e?.message || 'Unexpected error'}` })
    }
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
  const [qaHoldMap, setQaHoldMap] = useState<Record<string, boolean>>({})
  const capaBadgeCount = useMemo(() => Object.keys(capaMap || {}).length, [capaMap])
  // Map: source_po_id -> 'CLIENT' | 'OPS' for copack batches
  const [poSourceMap, setPoSourceMap] = useState<Record<string, 'CLIENT' | 'OPS'>>({})
  const [allergenConflictMap, setAllergenConflictMap] = useState<Record<string, boolean>>({})
  const [sanitationDetailsMap, setSanitationDetailsMap] = useState<Record<string, { minutes?: number | null; start?: string | null; end?: string | null }>>({})
  const [qaRequiredMap, setQaRequiredMap] = useState<Record<string, boolean>>({})
  const [qaApprovedMap, setQaApprovedMap] = useState<Record<string, boolean>>({})
  const [allergenModalBatchId, setAllergenModalBatchId] = useState<string | null>(null)

  // Modal: Block start if mandatory fields missing (e.g., lot_out)
  const [startErrorModal, setStartErrorModal] = useState<{ batchId: string; message: string } | null>(null)

  // QA Hold modal state
  const [qaHoldModalBatch, setQaHoldModalBatch] = useState<ScheduleItem | null>(null)
  const [qaHoldComponents, setQaHoldComponents] = useState<QAHoldComponent[]>([])
  // QA Hold indicator per batch (client-side cache)

  // Disposition modal state
  const [dispositionModal, setDispositionModal] = useState<{
    isOpen: boolean;
    batchId: string;
    lotNumber: string;
    action: 'REWORK' | 'DOWNGRADE' | 'SCRAP' | null;
  }>({ isOpen: false, batchId: '', lotNumber: '', action: null })
  const [dispositionNotes, setDispositionNotes] = useState('')
  const [isApplyingDisposition, setIsApplyingDisposition] = useState(false)
  
  // Warehouse shipping controls
  const [shippingModal, setShippingModal] = useState<{
    isOpen: boolean;
    batchId: string;
    poId: string;
  } | null>(null)
  const [shippingFile, setShippingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

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
  const productByName = useMemo(() => new Map<string, Product>(products.map((p)=> [String(p.product_name || ''), p])), [products])
  const productionLineByName = useMemo(() => new Map<string, ProductionLine>(productionLines.map(pl => [String(pl.line_name || ''), pl])), [productionLines])

  // ───────── Load current user role
  const loadUserRole = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (error) throw error
      setCurrentUserRole(data?.role || null)
    } catch (e) {
      console.warn('Failed to load user role:', e)
    }
  }

  // ───────── Load lookups + batches
  const loadLookups = async () => {
    const [{ data: c }, { data: p }, { data: f }, { data: pl }] = await Promise.all([
      supabase.from("customers").select("id, company_name").order("company_name"),
      supabase
        .from("products")
        .select("id, product_name, product_image_url, unit_of_measure, product_type, allergen_profile, formula_id, formula_name")
        .eq('product_type', 'Finished Goods')
        .order("product_name", { ascending: true }),
      supabase.from("formulas").select("id, formula_name"),
      supabase.from('production_lines').select('id, line_name, allowed_allergens, sanitation_minutes, needs_qa_signoff')
    ]);
    setCustomers(c || []);
    setProducts(p || []);
    setFormulas(f || []);
    setProductionLines(pl || []);
  };

  // ───────── Load Purchase Orders for scheduling
  const loadPurchaseOrders = async () => {
    setPoLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, risk_flag')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      const raw = Array.isArray(data) ? data : []
      const allowed = new Set([
        'approved',
        'allocated',
        'open',
        'backordered',
        'ready to schedule',
        'ready_to_schedule',
        'scheduled',
        'in progress',
        'in_progress',
        'quality hold',
        'qa_hold',
        'ready to ship',
        'ready_to_ship',
        'completed',
      ])
      const filtered = raw.filter((po: any) => allowed.has(String(po?.status || '').toLowerCase()))
      setPurchaseOrders(filtered);
    } catch (e) {
      console.error('Failed to load purchase orders:', e);
      pushToast({ type: 'error', message: 'Failed to load purchase orders' });
    } finally {
      setPoLoading(false);
    }
  };

  const mapBatchStatusToPoStatus = (batchStatus: string) => {
    const s = String(batchStatus || '').toLowerCase().trim()
    if (s === 'in progress' || s === 'in_progress') return 'in_progress'
    if (s === 'quality hold' || s === 'qa hold' || s === 'qa_hold') return 'qa_hold'
    if (s === 'ready to ship' || s === 'ready_to_ship') return 'ready_to_ship'
    if (s === 'completed') return 'completed'
    if (s === 'scheduled') return 'scheduled'
    return null
  }

  const syncPoStatusFromBatch = async (batchId: string, batchStatus: string) => {
    const poStatus = mapBatchStatusToPoStatus(batchStatus)
    if (!poStatus) return

    const row = (items || []).find(r => String(r.id) === String(batchId)) as any
    const poId = row?.sourcePoId ? String(row.sourcePoId) : null
    if (!poId) return

    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: poStatus })
      .eq('id', poId)
    if (error) throw error

    // Update local PO list without waiting for full reload
    setPurchaseOrders(prev => prev.map((po: any) => String(po.id) === poId ? { ...po, status: poStatus } : po))
  }

  const formatPoStatusLabel = (status: any) => {
    const st = String(status || '')
    const low = st.toLowerCase().trim()
    if (low === 'ready to schedule' || low === 'ready_to_schedule') return 'Ready to Schedule'
    if (low === 'in progress' || low === 'in_progress') return 'In Progress'
    if (low === 'quality hold' || low === 'qa hold' || low === 'qa_hold') return 'QA Hold'
    if (low === 'ready to ship' || low === 'ready_to_ship') return 'Completed - Ready to Ship'
    if (low === 'approved') return 'Approved'
    if (low === 'open') return 'Open'
    if (low === 'backordered') return 'Backordered'
    if (low === 'scheduled') return 'Scheduled'
    if (low === 'completed') return 'Completed'
    return st || '—'
  }

  // ───────── Calculate already scheduled quantity for a PO
  const calculateAlreadyScheduled = async (poId: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .select('qty')
        .eq('source_po_id', poId);
      
      if (error) throw error;
      return (data || []).reduce((sum, batch) => sum + Number(batch.qty || 0), 0);
    } catch (e) {
      console.error('Failed to calculate scheduled quantity:', e);
      return 0;
    }
  };

  const todayLocalISO = (() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 10)
  })()

  // ───────── Handle PO click for scheduling
  const handlePoClick = async (po: any) => {
    setSelectedPo(po);
    const scheduled = await calculateAlreadyScheduled(po.id);
    setAlreadyScheduled(scheduled);
    const remaining = Number(po.quantity || 0) - scheduled
    setProductGoal(remaining);
    setBatchGoal(String(Math.max(0, remaining)));
    setScheduleFromPoOpen(true);
  };

  // ───────── Create batch from PO
  const createBatchFromPo = async () => {
    if (isScheduleFromPoViewOnly) {
      pushToast({ type: 'error', message: 'View-only access: You cannot create batches.' });
      return;
    }
    if (!selectedPo || !batchGoal || !scheduledDate) {
      pushToast({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    if (String(scheduledDate) < todayLocalISO) {
      pushToast({ type: 'error', message: 'Scheduled Date cannot be in the past' })
      return
    }

    const batchQty = Number(batchGoal);
    if (batchQty <= 0 || batchQty > productGoal) {
      pushToast({ type: 'error', message: 'Batch Goal must be between 1 and Product Goal' });
      return;
    }

    setCreatingFromPo(true);
    try {
      let resolvedFormulaId: string | null = null
      try {
        if (selectedPo.product_id) {
          const { data: pRow, error: pErr } = await supabase
            .from('products')
            .select('formula_id, formula_name')
            .eq('id', selectedPo.product_id)
            .maybeSingle()
          if (!pErr && pRow?.formula_id) resolvedFormulaId = String(pRow.formula_id)

          if (!resolvedFormulaId) {
            const baseName = String(pRow?.formula_name || selectedPo.product_name || '').trim()
            if (baseName) {
              const { data: fRow, error: fErr } = await supabase
                .from('formulas')
                .select('id, version')
                .ilike('formula_name', `%${baseName}%`)
                .order('version', { ascending: false })
                .limit(1)
                .maybeSingle()
              if (!fErr && fRow?.id) resolvedFormulaId = String(fRow.id)
            }
          }
        }

        if (!resolvedFormulaId && selectedPo.product_name) {
          const { data: prod } = await supabase
            .from('products')
            .select('id, formula_id, formula_name')
            .ilike('product_name', `%${selectedPo.product_name}%`)
            .maybeSingle()

          if (prod?.formula_id) resolvedFormulaId = String(prod.formula_id)

          if (!resolvedFormulaId) {
            const baseName = String(prod?.formula_name || selectedPo.product_name || '').trim()
            if (baseName) {
              const { data: fRow2, error: fErr2 } = await supabase
                .from('formulas')
                .select('id, version')
                .ilike('formula_name', `%${baseName}%`)
                .order('version', { ascending: false })
                .limit(1)
                .maybeSingle()
              if (!fErr2 && fRow2?.id) resolvedFormulaId = String(fRow2.id)
            }
          }
        }
      } catch {}

      const poId = String(selectedPo.id)
      const isCopack = !!selectedPo.is_copack
      const desiredPoNumber = selectedPo.po_number || poId

      // Copack: ensure batch exists via RPC, then update it with schedule info.
      // Brand: create batch directly.
      let createdBatchId: string | null = null

      if (isCopack) {
        // If a batch already exists for this PO, re-use it.
        const { data: existingBatch } = await supabase
          .from('production_batches')
          .select('id')
          .eq('source_po_id', poId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        createdBatchId = existingBatch?.id ? String(existingBatch.id) : null

        if (!createdBatchId) {
          const { error: rpcErr } = await supabase.rpc('fn_auto_create_copack_batch_for_po', { p_po_id: poId })
          if (rpcErr) throw rpcErr

          const { data: createdByRpc, error: fetchErr } = await supabase
            .from('production_batches')
            .select('id')
            .eq('source_po_id', poId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (fetchErr) throw fetchErr
          createdBatchId = createdByRpc?.id ? String(createdByRpc.id) : null
        }

        if (!createdBatchId) {
          throw new Error('Copack batch was not created')
        }

        const { error: updErr } = await supabase
          .from('production_batches')
          .update({
            product_sku: selectedPo.product_name,
            qty: batchQty,
            room: room,
            start_date: scheduledDate,
            end_date: scheduledDate,
            status: 'Scheduled',
            customer_id: selectedPo.customer_id,
            po_number: desiredPoNumber,
            source_po_id: poId,
            formula_id: resolvedFormulaId,
            lot_number: lot,
            samples_received: samplesReceived === 'Yes',
            samples_sent: samplesSent || null,
            completed_qty: Number(completedQty) || 0,
          })
          .eq('id', createdBatchId)
        if (updErr) throw updErr
      } else {
        // Create batch with PO reference
        const { data: createdBatch, error: createErr } = await supabase
          .from('production_batches')
          .insert({
            product_sku: selectedPo.product_name,
            qty: batchQty,
            room: room,
            start_date: scheduledDate,
            end_date: scheduledDate,
            status: 'Scheduled',
            customer_id: selectedPo.customer_id,
            po_number: desiredPoNumber,
            source_po_id: poId,
            formula_id: resolvedFormulaId,
            lot_number: lot,
            samples_received: samplesReceived === 'Yes',
            samples_sent: samplesSent || null,
            completed_qty: Number(completedQty) || 0
          })
          .select('id')
          .maybeSingle();

        if (createErr) throw createErr;
        createdBatchId = createdBatch?.id ? String(createdBatch.id) : null
      }

      if (createdBatchId && resolvedFormulaId) {
        try {
          const { data: fiRows, error: fiErr } = await supabase
            .from('formula_items')
            .select('material_id, qty_per_unit, uom')
            .eq('formula_id', resolvedFormulaId)

          if (fiErr) throw fiErr

          const reqRows = (fiRows || [])
            .map((it: any) => {
              const materialId = String(it?.material_id || '')
              const perUnit = Number(it?.qty_per_unit || 0)
              const uom = String(it?.uom || '')
              if (!materialId || !uom || !(perUnit > 0)) return null
              return {
                batch_id: createdBatchId,
                material_id: materialId,
                qty_required: Number(batchQty) * perUnit,
                uom,
              }
            })
            .filter(Boolean) as Array<{ batch_id: string; material_id: string; qty_required: number; uom: string }>

          if (reqRows.length > 0) {
            const { error: reqErr } = await supabase
              .from('production_requirements')
              .insert(reqRows)
            if (reqErr) throw reqErr
          } else {
            pushToast({ type: 'warning', message: 'Batch created, but no formula items found to generate requirements.' })
          }
        } catch (e: any) {
          pushToast({ type: 'warning', message: e?.message || 'Batch created, but failed to generate requirements.' })
        }
      } else if (createdBatchId && !resolvedFormulaId) {
        pushToast({ type: 'warning', message: 'Batch created, but no formula was found to generate requirements.' })
      }

      try {
        const { error: poUpdateErr } = await supabase
          .from('purchase_orders')
          .update({ status: 'scheduled' })
          .eq('id', selectedPo.id)
        if (poUpdateErr) throw poUpdateErr
      } catch (e: any) {
        pushToast({ type: 'warning', message: e?.message || 'Batch created, but failed to update PO status.' })
      }

      // Update Product Goal
      const newScheduled = alreadyScheduled + batchQty;
      setAlreadyScheduled(newScheduled);
      setProductGoal(Number(selectedPo.quantity || 0) - newScheduled);
      setBatchGoal('');

      await loadBatches();
      await loadPurchaseOrders();
      pushToast({ type: 'success', message: 'Production batch created from PO' });

      setScheduleFromPoOpen(false)
      setSelectedPo(null)
      setScheduledDate('')
      setRoom(productionLineNames[0] || '')
      setLot('')
      setSamplesReceived('No')
      setSamplesSent('')
      setCompletedQty('0')
    } catch (e: any) {
      console.error('Create batch from PO error:', e);
      pushToast({ type: 'error', message: e?.message || 'Failed to create batch from PO' });
    } finally {
      setCreatingFromPo(false);
    }
  };

  // ───────── QA Approve action (optimistic)
  const markQaApproved = async (batchId: string) => {
    try {
      const { error } = await supabase
        .from('production_batches')
        .update({ qa_approved: true })
        .eq('id', batchId)
      if (error) throw error

      // Resolve CAPA tasks (Option A)
      try {
        await supabase
          .from('capa_tasks')
          .update({ status: 'Revoked' })
          .eq('batch_id', castBatchId(batchId))
          .neq('status', 'Revoked')
      } catch {}

      // Lift Quality Hold if present and move back to Completed (Option A)
      try {
        const { data: b } = await supabase
          .from('production_batches')
          .select('status')
          .eq('id', batchId)
          .maybeSingle()
        if (String((b as any)?.status || '') === 'Quality Hold') {
          const { error: stErr } = await supabase
            .from('production_batches')
            .update({ status: 'Completed' })
            .eq('id', batchId)
          if (stErr) throw stErr
        }
      } catch {}

      // PO becomes Ready to Ship after QA approval (Option A)
      try {
        await syncPoStatusFromBatch(batchId, 'Ready to Ship')
        await loadPurchaseOrders()
      } catch {}

      try {
        const row = (items || []).find(r => String(r.id) === String(batchId)) as any
        const completed = Number(row?.completedQty || 0)
        const scrap = Number(capaScrapQtyMap[String(batchId)] ?? 0)
        const net = Math.max(0, completed - scrap)
        pushToast({ type: 'success', message: `Finished Goods: ${net} (Completed ${completed} - Scrap ${scrap})` })
      } catch {}

      // Optimistic update: list rows
      setItems(prev => prev.map(r => r.id === batchId ? { ...r, qaApproved: true, status: (String((r as any).status || '') === 'Quality Hold' ? 'Completed' : (r as any).status) } : r))
      // Update view modal if open
      setViewItem(prev => prev && prev.id === batchId ? { ...prev, qaApproved: true, status: (String((prev as any).status || '') === 'Quality Hold' ? 'Completed' : (prev as any).status) } as any : prev)
      // Update gating map used by Start button disabled check
      setQaApprovedMap(prev => ({ ...prev, [batchId]: true }))
      // CAPA stays visible, but becomes revoked (not active)
      setCapaEverMap(prev => ({ ...(prev || {}), [String(batchId)]: true }))
      setCapaMap(prev => { const n = { ...(prev || {}) } as any; delete n[String(batchId)]; return n })
      pushToast({ type: 'success', message: 'QA marked as approved' })
    } catch (e:any) {
      pushToast({ type: 'error', message: e?.message || 'Failed to mark QA approved' })
    }
  }

  // ───────── Production Manager Status Change
  const changeProductionStatus = async (batchId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus }
      
      // If setting to "In Progress", also update start time
      if (newStatus === 'In Progress') {
        updates.start_date = new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('production_batches')
        .update(updates)
        .eq('id', batchId)
      
      if (error) throw error

      try {
        await syncPoStatusFromBatch(batchId, newStatus)
      } catch {}
      
      // If status is "Completed", move to "Ready to Ship" and trigger communications
      if (newStatus === 'Completed') {
        if (capaMap[String(batchId)]) {
          try {
            await syncPoStatusFromBatch(batchId, 'Quality Hold')
          } catch {}
        } else {
          await handleProductionCompleted(batchId)
        }
      }
      
      await loadBatches()
      pushToast({ type: 'success', message: `Status updated to ${newStatus}` })
    } catch (e: any) {
      pushToast({ type: 'error', message: e?.message || 'Failed to update status' })
    } finally {
    }
  }

  // ───────── Handle Production Completed
  const handleProductionCompleted = async (batchId: string) => {
    try {
      try {
        await syncPoStatusFromBatch(batchId, 'Ready to Ship')
      } catch {}
      
      // TODO: Trigger communication with sales rep and warehouse
      // This would involve creating notifications or sending emails
      console.log('TODO: Trigger communication with sales rep and warehouse for batch:', batchId)
      
    } catch (e: any) {
      console.error('Failed to handle production completion:', e)
      throw e
    }
  }

  // ───────── Handle Quality Hold
  const handleQualityHold = async (batchId: string) => {
    try {
      const { error } = await supabase
        .from('production_batches')
        .update({ status: 'Quality Hold' })
        .eq('id', batchId)
      
      if (error) throw error

      try {
        await syncPoStatusFromBatch(batchId, 'Quality Hold')
      } catch {}
      
      // TODO: Trigger communication between Quality Manager, Production Manager, and sales rep
      console.log('TODO: Trigger communication for Quality Hold on batch:', batchId)
      
      await loadBatches()
      pushToast({ type: 'success', message: 'Batch placed on Quality Hold' })
    } catch (e: any) {
      pushToast({ type: 'error', message: e?.message || 'Failed to place on Quality Hold' })
    }
  }

  // ───────── Warehouse Shipping Controls
  const handleShipOrder = async (batchId: string, poId: string) => {
    if (!shippingFile) {
      pushToast({ type: 'error', message: 'Please upload shipping file' })
      return
    }
    
    setUploading(true)
    try {
      // Upload shipping file
      const fileExt = shippingFile.name.split('.').pop()
      const fileName = `shipping-${poId}-${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('shipping-documents')
        .upload(fileName, shippingFile)
      
      if (uploadError) throw uploadError
      
      // Update batch status to "Shipped"
      const { error: updateError } = await supabase
        .from('production_batches')
        .update({ 
          status: 'Shipped',
          shipping_file: fileName
        })
        .eq('id', batchId)
      
      if (updateError) throw updateError
      
      await loadBatches()
      setShippingModal(null)
      setShippingFile(null)
      pushToast({ type: 'success', message: 'Order marked as shipped' })
    } catch (e: any) {
      pushToast({ type: 'error', message: e?.message || 'Failed to ship order' })
    } finally {
      setUploading(false)
    }
  }

  // ───────── Check if date has arrived for auto status change
  const checkAutoStatusChange = async () => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const scheduledBatches = items.filter(item => 
      item.status === 'Scheduled' && 
      item.startDate && 
      String(item.startDate).split('T')[0] < today
    )
    
    for (const batch of scheduledBatches) {
      try {
        await supabase
          .from('production_batches')
          .update({ status: 'In Progress' })
          .eq('id', batch.id)
      } catch (e) {
        console.warn('Failed to auto-update batch status:', e)
      }
    }
    
    if (scheduledBatches.length > 0) {
      await loadBatches()
    }
  }

  // ───────── Mark Sanitation Complete RPC
  const markSanitationComplete = async (batchId: string) => {
    try {
      const { error } = await supabase.rpc("mark_sanitation_complete", {
        p_batch_id: batchId,
      });

      if (error) throw error;

      // Optimistic UI: clear sanitation + conflict immediately
      setItems(prev => prev.map(r => r.id === String(batchId) ? { ...r, sanitationRequired: false, sanitationStart: null, sanitationEnd: null } : r))
      setAllergenConflictMap(prev => ({ ...prev, [String(batchId)]: false }))
      pushToast({ type: 'success', message: 'Sanitation marked as complete!' });
      await loadBatches();
    } catch (err) {
      console.error(err);
      pushToast({ type: 'error', message: 'Failed to mark sanitation + QA complete.' });
    }
  }

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
          "id, product_sku, qty, room, start_date, end_date, status, required_capacity, assigned_line, flags, formula_id, customer_id, lot_number, po_number, completed_qty, samples_received, samples_sent, created_at, source_po_id, source_po_line_id, sanitation_required, sanitation_start, sanitation_end, qa_required, qa_approved"
        )
        .order("start_date", { ascending: false })
        .limit(200);

      if (error) throw error;

      const mapped: ScheduleItem[] =
        (data || []).map((r: any) => {
          const lineName = String(r.room || r.assigned_line || "")
          const line = productionLineByName.get(lineName)
          const needsQaSignoff = Boolean((line as any)?.needs_qa_signoff)
          return {
            id: String(r.id),
            product: String(r.product_sku || ""),
            customer: customersMap.get(String(r.customer_id || "")) || "",
            formula: formulasMap.get(String(r.formula_id || "")) || "",
            qty: Number(r.qty || 0),
            completedQty: Number(r.completed_qty || 0),
            room: lineName,
            startDate: r.start_date || "",
            status: r.status || "Scheduled",
            lot: r.lot_number || "",
            po: r.po_number || "",
            sourcePoId: r.source_po_id || null,
            createdAt: r.created_at || null,
            sanitationRequired: r.sanitation_required ?? null,
            sanitationStart: r.sanitation_start || null,
            sanitationEnd: r.sanitation_end || null,
            qaRequired: r.qa_required ?? (needsQaSignoff ? true : null),
            qaApproved: r.qa_approved ?? null,
            flags: r.flags,
            batchType: (Array.isArray(r.flags)
              ? r.flags.includes('REWORK')
              : String(r.flags || '') === 'REWORK')
              ? 'rework'
              : 'original'
          }
        })
 ?? [];

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
            .select('batch_id, status, scrap_qty, created_at')
            .in('batch_id', ids)
          const ever: Record<string, boolean> = {}
          const active: Record<string, boolean> = {}
          const scrap: Record<string, number> = {}
          const scrapTs: Record<string, number> = {}
          for (const c of caps || []) {
            const bid = (c as any)?.batch_id
            if (!bid) continue
            const id = String(bid)
            ever[id] = true
            const st = String((c as any)?.status || '').toLowerCase().trim()
            if (st !== 'resolved' && st !== 'revoked') active[id] = true

            const ts = (c as any)?.created_at ? new Date(String((c as any).created_at)).getTime() : 0
            const sq = Number((c as any)?.scrap_qty)
            if (Number.isFinite(sq)) {
              if (!scrapTs[id] || ts >= scrapTs[id]) {
                scrapTs[id] = ts
                scrap[id] = sq
              }
            }
          }
          setCapaEverMap(ever)
          setCapaMap(active)
          setCapaScrapQtyMap(scrap)
          setItems(prev => prev.map(r => (active[String(r.id)] ? { ...r, status: 'Quality Hold' } : r)))

          // Enforce PO status = qa_hold when batch is Quality Hold (including CAPA-triggered holds)
          try {
            const holdPoIds = new Set<string>()
            for (const r of (data || [])) {
              const batchId = String(r.id)
              const isHold = String(r.status || '') === 'Quality Hold' || Boolean(active[batchId])
              const poId = r.source_po_id ? String(r.source_po_id) : null
              if (isHold && poId) holdPoIds.add(poId)
            }

            const poIds = Array.from(holdPoIds)
            if (poIds.length) {
              const { error: poHoldErr } = await supabase
                .from('purchase_orders')
                .update({ status: 'qa_hold' })
                .in('id', poIds)
              if (poHoldErr) throw poHoldErr

              setPurchaseOrders(prev => prev.map((po: any) => (poIds.includes(String(po.id)) ? { ...po, status: 'qa_hold' } : po)))
            }
          } catch {}
        } else {
          setCapaMap({})
          setCapaEverMap({})
          setCapaScrapQtyMap({})
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
      await loadUserRole();
      await loadLookups();
      await loadBatches();
      await loadPurchaseOrders();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, user?.id]);

  useEffect(() => {
    if (!room && productionLineNames.length > 0) {
      setRoom(productionLineNames[0])
    }
    if (activeTab !== 'All' && productionLineNames.length > 0 && !productionLineNames.includes(activeTab)) {
      setActiveTab('All')
    }
  }, [productionLineNames, room, activeTab])

  // ───────── Helpers for create
  const selectedProductName = useMemo(() => {
    if (!selectedProductId) return "";
    const p = productsMap.get(selectedProductId);
    return p?.product_name || "";
  }, [selectedProductId, productsMap]);


  const resetCreateForm = () => {
    setScheduledDate("");
    setSelectedCustomerId("");
    setSelectedProductId("");
    setSelectedFormulaId("");
    setRoom(productionLineNames[0] || "");
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

  // ───────── Auto-check for status changes on load
  useEffect(() => {
    if (items.length > 0) {
      checkAutoStatusChange()
    }
  }, [items.length])

  // ───────── Filtered table items
  const filtered = useMemo(() => {
    const byRoom = activeTab === "All"
      ? items
      : items.filter((i) => (i.room || "").toLowerCase() === activeTab.toLowerCase());
    const byKind = byRoom.filter((i) =>
      batchKind === 'rework' ? i.batchType === 'rework' : i.batchType !== 'rework'
    );
    return byKind;
  }, [items, activeTab, batchKind]);

  // ───────── Row → full record (for edit)
  const fetchRowById = async (id: string) => {
    const { data, error } = await supabase
      .from("production_batches")
      .select(
        "id, product_sku, qty, room, start_date, end_date, status, required_capacity, assigned_line, flags, formula_id, customer_id, lot_number, po_number, completed_qty, samples_received, samples_sent, created_at, source_po_id, source_po_line_id, sanitation_required, sanitation_start, sanitation_end, qa_required, qa_approved"
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
      try {
        const { data: gate, error: gateErr } = await supabase.rpc('fn_check_allergen_conflict', { p_batch_id: castBatchId(id) })
        if (gateErr) {
          pushToast({ type: 'error', message: `Allergen check failed: ${gateErr.message}` })
          return
        }
        if (gate && typeof gate === 'object' && (gate as any).status === 'conflict') {
          // Close any batch modals so conflict dialog is not stacked within them
          setViewItem(null)
          setEditItem(null)
          setAllergenConflictMap(prev => ({ ...prev, [id]: true }))
          setSanitationDetailsMap(prev => ({ ...prev, [id]: { minutes: (gate as any).sanitation_minutes ?? null, start: null, end: null } }))
          setQaRequiredMap(prev => ({ ...prev, [id]: !!(gate as any).qa_required }))
          setAllergenModalBatchId(id)
          return
        }
      } catch {}

      // NEW: QA Hold check – block start if any component is on QA hold
      try {
        const { data: qaData, error: qaError } = await supabase.rpc('fn_check_qa_hold_for_batch', { p_batch_id: castBatchId(id) })
        if (qaError) {
          console.error('QA hold check failed', qaError)
          pushToast({ type: 'error', message: 'Unable to verify QA Hold status. Please try again or contact QA.' })
          return
        }
        if (qaData && typeof qaData === 'object' && (qaData as any).status === 'hold') {
          setQaHoldComponents(((qaData as any).held_components ?? []) as QAHoldComponent[])
          const batchRow = (items || []).find(r => String(r.id) === String(id)) || null
          setQaHoldModalBatch(batchRow)
          setQaHoldMap(prev => ({ ...prev, [String(id)]: true }))
          return
        }
      } catch {}
      // 1) Fetch requirements first (RPC preferred, fallback to table)
      let reqRows: any[] = []
      try {
      const { data: rpcReq, error: rpcErr } = await supabase.rpc(
        'fn_requirements_for_batch',
        { p_batch_id: castBatchId(id) }
      )
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

      // Check batch compliance requirements before starting
      const batch = (items || []).find(r => String(r.id) === String(id))
      if (batch) {
        if (batch.sanitationRequired && !(batch as any).sanitationComplete) {
          pushToast({ type: 'error', message: 'Cannot start batch: sanitation not completed.' })
          return
        }
        if (batch.qaRequired && !batch.qaApproved) {
          pushToast({ type: 'error', message: 'Cannot start batch: QA approval required.' })
          return
        }
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

      // 3) Mandatory fields check: ensure lot_out and other required fields via RPC
      try {
        const { data: traceCheck, error: traceErr } = await supabase.rpc('fn_record_lot_traceability', { p_batch_id: castBatchId(id) })
        if (traceErr) {
          setStartErrorModal({ batchId: id, message: traceErr.message || 'Required field missing. Please review batch details.' })
          return
        }
        if (traceCheck && typeof traceCheck === 'object' && (traceCheck as any).status === 'error') {
          setStartErrorModal({ batchId: id, message: String((traceCheck as any).message || 'Required field missing. Please review batch details.') })
          return
        }
      } catch (vErr) {
        setStartErrorModal({ batchId: id, message: 'Unable to validate batch requirements. Please try again.' })
        return
      }

      // 4) No shortage and validations passed: proceed to reserve/start
      const { data, error } = await supabase.rpc('fn_reserve_for_batch', { p_batch_id: castBatchId(id) })
      if (error) throw error
      
      // Debug: Log the RPC response
      console.log('fn_reserve_for_batch response:', data)
      
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
      try {
        await syncPoStatusFromBatch(id, 'In Progress')
        await loadPurchaseOrders()
      } catch (e: any) {
        console.warn('Failed to sync PO status from started batch:', e)
      }
      await loadBatches()
      
      // Lot traceability already validated above. If needed, backend should handle idempotency.
      
      pushToast({ type: 'success', message: 'Batch started successfully' })
      // If batch can start, clear any cached shortage
      removeShortagesFromCache(id)
      setStartDisabled(prev => { const n = { ...prev }; delete n[id]; return n })
      setShortagesCache(prev => { const n = { ...prev }; delete n[id]; return n })
      setAllergenConflictMap(prev => { const n = { ...prev }; delete n[id]; return n })
      setSanitationDetailsMap(prev => { const n = { ...prev }; delete n[id]; return n })
      setQaRequiredMap(prev => { const n = { ...prev }; delete n[id]; return n })
      setQaHoldMap(prev => { const n = { ...prev }; delete n[String(id)]; return n })
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
              .select('standard_yield, scrap_percent')
              .eq('id', b.formula_id as any)
              .maybeSingle()
            if (typeof f?.standard_yield === 'number') sy = f.standard_yield as number
            if (typeof (f as any)?.scrap_percent === 'number') tol = (f as any).scrap_percent as number
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
    const batchId = String(completeId)
    const qtyToSubmit = Number(qtySubmitted ?? completedQtyPreview ?? completeQty ?? 0)
    if (!Number.isFinite(qtyToSubmit) || qtyToSubmit <= 0) {
      pushToast({ type: 'error', message: 'Completed quantity must be greater than 0' })
      return
    }
    setIsCompleting(true)
    // Optimistic UI update for the table row
    setItems(prev => prev.map(r => (
      r.id === String(batchId)
        ? { ...r, status: 'Completed', completedQty: qtyToSubmit }
        : r
    )))
    try {
      const { data, error } = await supabase.rpc('fn_complete_batch', {
        p_batch_id: castBatchId(batchId),
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
      
      // Record lot traceability after successful completion
      try {
        await supabase.rpc('fn_record_lot_traceability', { p_batch_id: castBatchId(batchId) })
      } catch (traceError) {
        console.warn('Lot traceability recording failed:', traceError)
        // Don't fail the completion process if traceability fails
      }

      const scrapBase = (Number(scrapQtyPreview || 0) + Number(qtyToSubmit || 0)) || 1
      const scrapPercent = Number(scrapQtyPreview || 0) / scrapBase
      const scrapOverTol = scrapPercent > Number(modalScrapTolerance || 0)
      const capaTriggered = Boolean(
        scrapOverTol ||
          (data &&
            typeof data === 'object' &&
            ((data as any).capa_created || (data as any).capa_id))
      )

      try {
        if (capaTriggered) {
          const { error: updateError } = await supabase
            .from('production_batches')
            .update({ status: 'Quality Hold' })
            .eq('id', batchId)
          if (updateError) throw updateError

          setItems(prev => prev.map(r => (r.id === String(batchId) ? { ...r, status: 'Quality Hold' } : r)))
          setViewItem(prev => prev && String((prev as any).id) === String(batchId) ? ({ ...(prev as any), status: 'Quality Hold' } as any) : prev)

          await syncPoStatusFromBatch(batchId, 'Quality Hold')
        } else {
          await handleProductionCompleted(batchId)
        }
        await loadPurchaseOrders()
      } catch (e: any) {
        console.warn('Failed to update PO status after completion:', e)
      }
      
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

  // Disposition handlers
  const openDispositionModal = (batchId: string, lotNumber: string, action: 'REWORK' | 'DOWNGRADE' | 'SCRAP') => {
    setDispositionModal({ isOpen: true, batchId, lotNumber, action })
    setDispositionNotes('')
  }

  const closeDispositionModal = () => {
    setDispositionModal({ isOpen: false, batchId: '', lotNumber: '', action: null })
    setDispositionNotes('')
    setIsApplyingDisposition(false)
  }

 const applyDisposition = async () => {
  if (!dispositionModal.action || !dispositionModal.batchId) return;

  setIsApplyingDisposition(true);

  try {
    const { error: rpcError } = await supabase.rpc("fn_apply_disposition", {
      p_batch_id: dispositionModal.batchId,
      p_lot_number: dispositionModal.lotNumber,
      p_action: dispositionModal.action.toUpperCase(),
      p_notes: dispositionNotes || null
    });

    if (rpcError) throw rpcError;

    pushToast({
      type: 'success',
      message: `Disposition ${dispositionModal.action} applied successfully.`
    });

    await loadBatches();
    closeDispositionModal();

  } catch (e: any) {
    console.warn('Apply disposition error:', e);
    pushToast({
      type: 'error',
      message: e?.message || 'Failed to apply disposition'
    });
  } finally {
    setIsApplyingDisposition(false);
  }
};


  // Traceability section component
  const TraceabilitySection: React.FC<{ batchId: string }> = ({ batchId }) => {
    const [traceabilityData, setTraceabilityData] = useState<Array<{
      raw_material_name: string;
      lot_in: string;
      lot_out: string;
    }>>([]) 
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      const loadTraceability = async () => {
        try {
          setLoading(true)
          const { data, error } = await supabase
            .from('lot_traceability')
            .select('raw_material_name, lot_in, lot_out')
            .eq('batch_id', batchId)
          
          if (error) throw error
          setTraceabilityData(data || [])
        } catch (error) {
          console.warn('Failed to load traceability data:', error)
          setTraceabilityData([])
        } finally {
          setLoading(false)
        }
      }

      loadTraceability()
    }, [batchId])

    return (
      <div className="rounded-2xl border border-neutral-soft/40 bg-white shadow-sm hover:shadow-md transition-shadow p-6">
        <div className="text-lg font-semibold text-neutral-dark mb-5 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-primary-medium"/>
          Lot Traceability
        </div>
        
        {loading ? (
          <div className="text-neutral-medium text-sm">Loading lot traceability...</div>
        ) : traceabilityData.length === 0 ? (
          <div className="text-neutral-medium text-sm">No lot traceability records available.</div>
        ) : (
          <div className="space-y-4">
            {traceabilityData.map((item, idx) => (
              <div key={idx} className="bg-neutral-light/30 rounded-xl p-4 border border-neutral-soft/30">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">Raw Material</div>
                    <div className="text-sm font-medium text-neutral-dark">{item.raw_material_name}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">Incoming Lot</div>
                      <div className="text-sm text-neutral-dark">{item.lot_in || 'Not specified'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">Outgoing Lot</div>
                      <div className="text-sm text-neutral-dark">{item.lot_out || 'Not specified'}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // View content component
  const ViewContent: React.FC<{ batchId: string; refreshKey?: number }> = ({ batchId, refreshKey }) => {
    const [row, setRow] = useState<BatchRow | null>(null)
    const [reqs, setReqs] = useState<Array<{ material_id: string; material_name: string; qty_required: number; reserved_qty: number; uom?: string }>>([])
    const [busy, setBusy] = useState(true)
    const [activeTab, setActiveTab] = useState<'details' | 'variance' | 'capa'>('details')
    const [capaHistory, setCapaHistory] = useState<any[]>([])
    const [qualityDeviations, setQualityDeviations] = useState<any[]>([])
    const [segregationData, setSegregationData] = useState<{ segregated_qty: number; segregated_location: string | null; disposition: string | null } | null>(null)
    const [reworkData, setReworkData] = useState<{ id: string; original_lot: string; product_sku: string; rework_qty: number; status: string; notes: string; disposition_action: string; disposition_notes: string } | null>(null)

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
              .select('id, product_sku, qty, room, start_date, status, formula_id, customer_id, source_po_id, source_po_line_id, completed_qty, samples_received, samples_sent, sanitation_required, qa_required, qa_approved, flags, scheduled_batch_id, lot_number')
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
          // Load Quality Deviations separately for this batch
          try {
            const { data: qdev } = await supabase
              .from('quality_deviations')
              .select('id, batch_id, product_sku, issue_type, status, disposition, created_at, lot_number, severity, action_required')
              .eq('batch_id', castBatchId(batchId))
              .order('created_at', { ascending: false })
            if (mounted) setQualityDeviations(qdev || [])
          } catch {
            if (mounted) setQualityDeviations([])
          }
          // Load segregation data from finished_goods for this product
          try {
            if (b?.product_sku) {
              const { data: fgData } = await supabase
                .from('finished_goods')
                .select('segregated_qty, segregated_location, disposition')
                .eq('product_name', b.product_sku)
                .maybeSingle()
              if (mounted && fgData) {
                setSegregationData({
                  segregated_qty: Number(fgData.segregated_qty || 0),
                  segregated_location: fgData.segregated_location || null,
                  disposition: fgData.disposition || null
                })
              }
            }
          } catch {
            if (mounted) setSegregationData(null)
          }
          // Load rework data if this is a rework batch
          try {
            if (b?.flags === 'REWORK' && b?.scheduled_batch_id) {
              const { data: reworkBatch } = await supabase
                .from('rework_batches')
                .select('id, original_lot, product_sku, rework_qty, status, notes, disposition_action, disposition_notes')
                .eq('id', b.scheduled_batch_id)
                .maybeSingle()
              if (mounted && reworkBatch) {
                setReworkData(reworkBatch)
              }
            }
          } catch {
            if (mounted) setReworkData(null)
          }
        } catch (e) {
          console.warn('Load batch view error', e)
        } finally {
          if (mounted) setBusy(false)
        }
      })()
      return () => { mounted = false }
    }, [batchId, refreshKey])

    const visibleCapa = useMemo(() => (capaHistory || []).filter((v: any) => String(v.issue_type || '').toUpperCase() !== 'COA_FAIL'), [capaHistory])

    return (
      <div className="p-6 space-y-6" data-active-tab={activeTab}>
        {/* Details moved to the summary card above to avoid duplication */}

        {/* Rework Source Section - Show if REWORK batch */}
        {(row as any)?.flags === 'REWORK' && reworkData && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200" title="This batch was generated from a QA rework request.">
                REWORK BATCH
              </span>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-yellow-800 mb-3">Rework Source</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-yellow-700 uppercase font-medium">Original Lot</div>
                  <div className="text-yellow-900 font-semibold">{reworkData.original_lot}</div>
                </div>
                <div>
                  <div className="text-xs text-yellow-700 uppercase font-medium">Rework Qty</div>
                  <div className="text-yellow-900 font-semibold">{reworkData.rework_qty} units</div>
                </div>
              </div>
              <button className="mt-3 text-xs text-yellow-700 hover:text-yellow-900 underline font-medium">
                View Rework Record
              </button>
            </div>
          </div>
        )}

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

        {/* Professional ERP Cards Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Lot Traceability */}
          <TraceabilitySection batchId={batchId} />

          {/* Corrective Actions */}
          <div className="rounded-2xl border border-neutral-soft/40 bg-white shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="text-lg font-semibold text-neutral-dark mb-5 flex items-center">
              <Lightbulb className="h-5 w-5 mr-2 text-primary-medium"/>
              Corrective Actions (CAPA)
            </div>
            {visibleCapa.length > 0 && (
              <div className="bg-accent-warning/10 border border-accent-warning/30 text-accent-warning px-4 py-3 rounded-xl mb-4">
                <div className="text-sm font-medium">Quality team has been notified. Review required for corrective actions.</div>
              </div>
            )}
            {visibleCapa.length === 0 ? (
              <div className="text-neutral-medium text-sm">No corrective actions recorded.</div>
            ) : (
              <div className="space-y-4">
                {visibleCapa.map((v) => {
                  const over = (Number(v.scrap_percent ?? 0)) > (Number(v.tolerance ?? 0))
                  return (
                    <div key={v.id} className="bg-neutral-light/30 rounded-xl p-4 border border-neutral-soft/30">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="text-sm font-semibold text-neutral-dark">{v.product_sku || 'Product not specified'}</div>
                        <div className="text-xs text-neutral-medium">{new Date(v.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">Scrap Quantity</div>
                            <div className="text-sm text-neutral-dark">{v.scrap_qty ?? 'Not recorded'}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">Scrap Rate</div>
                            <div className={`text-sm font-medium ${over ? 'text-accent-danger' : 'text-neutral-dark'}`}>
                              {v.scrap_percent != null && !isNaN(Number(v.scrap_percent)) ? Number(v.scrap_percent).toFixed(2) + '%' : 'Not calculated'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">Tolerance Limit</div>
                            <div className="text-sm text-neutral-dark">{v.tolerance != null && !isNaN(Number(v.tolerance)) ? Number(v.tolerance).toFixed(2) + '%' : 'Not set'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quality Issues */}
          <div className="rounded-2xl border border-neutral-soft/40 bg-white shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="text-lg font-semibold text-neutral-dark mb-5 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-primary-medium"/>
              Quality Issues (Deviations)
            </div>
            {qualityDeviations.length === 0 ? (
              <div className="text-neutral-medium text-sm">No quality issues recorded.</div>
            ) : (
              <div className="space-y-4">
                {qualityDeviations.map((d: any) => {
                  const sevCls = String(d.severity || '').toLowerCase() === 'high'
                    ? 'bg-accent-danger/10 text-accent-danger border border-accent-danger/30'
                    : String(d.severity || '').toLowerCase() === 'medium'
                      ? 'bg-accent-warning/10 text-accent-warning border border-accent-warning/30'
                      : 'bg-neutral-light/50 text-neutral-medium border border-neutral-soft/50'
                  return (
                    <div key={d.id} className="bg-neutral-light/30 rounded-xl p-4 border border-neutral-soft/30">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="text-sm font-semibold text-neutral-dark">{d.issue_type || 'Quality Issue'}</div>
                        <div className="text-xs text-neutral-medium">{d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Date not recorded'}</div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex flex-wrap gap-2">
                          {d.status ? (
                            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-primary-light/20 text-primary-dark border border-primary-light/40">
                              Status: {d.status}
                            </span>
                          ) : null}
                          {d.severity ? (
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${sevCls}`}>
                              {d.severity} Priority
                            </span>
                          ) : null}
                          {d.disposition ? (
                            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-accent-success/20 text-accent-success border border-accent-success/40">
                              {d.disposition}
                            </span>
                          ) : null}
                        </div>
                        {d.action_required && (
                          <div>
                            <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">Required Action</div>
                            <div className="text-sm text-neutral-dark">{d.action_required}</div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">Product</div>
                            <div className="text-sm text-neutral-dark">{d.product_sku || 'Not specified'}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-1">Lot Number</div>
                            <div className="text-sm text-neutral-dark">{d.lot_number || 'Not specified'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Batch Compliance */}
          <div className="rounded-2xl border border-neutral-soft/40 bg-white shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="text-lg font-semibold text-neutral-dark mb-5 flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-primary-medium"/>
              Batch Compliance
            </div>
            <div className="space-y-4">
              <div className="bg-neutral-light/30 rounded-xl p-4 border border-neutral-soft/30">
                <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-2">Sanitation Requirements</div>
                <div className="text-sm font-medium text-neutral-dark">{(row as any)?.sanitation_required ? 'Sanitation required before production' : 'No sanitation requirements'}</div>
              </div>
              <div className="bg-neutral-light/30 rounded-xl p-4 border border-neutral-soft/30">
                <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-2">Quality Assurance</div>
                <div className="text-sm font-medium text-neutral-dark">{(((row as any)?.qa_required || productionLineByName.get(String((row as any)?.room || ''))?.needs_qa_signoff || (capaMap as any)?.[String(batchId)] || String((row as any)?.status || '') === 'Quality Hold') ? 'QA approval required' : 'No QA requirements')}</div>
              </div>
              {(((row as any)?.qa_required || productionLineByName.get(String((row as any)?.room || ''))?.needs_qa_signoff || (capaMap as any)?.[String(batchId)] || String((row as any)?.status || '') === 'Quality Hold')) && (
                <div className="bg-neutral-light/30 rounded-xl p-4 border border-neutral-soft/30">
                  <div className="text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-2">Approval Status</div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-medium ${((row as any)?.qa_approved ? 'bg-accent-success/20 text-accent-success border border-accent-success/40' : 'bg-accent-danger/20 text-accent-danger border border-accent-danger/40')}`}>
                      {(row as any)?.qa_approved ? 'Quality Approved' : 'Awaiting QA Approval'}
                    </span>
                    {!(row as any)?.qa_approved ? (
                      <button
                        className="px-4 py-2 rounded-lg bg-accent-success hover:bg-accent-success/90 text-white text-xs font-semibold transition-colors"
                        onClick={() => markQaApproved(String(batchId))}
                      >
                        Approve Quality
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lot Segregation Section - Separate from the four-card grid */}
        {qualityDeviations.some((d: any) => String(d.issue_type || '').toUpperCase() === 'COA_FAIL') && (
          <div className="rounded-2xl border border-red-200 bg-red-50 shadow-sm hover:shadow-md transition-shadow p-6 mt-6">
            <div className="text-lg font-semibold text-red-800 mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-600"/>
              Lot Segregation
            </div>
            <div className="text-sm font-medium text-red-800 mb-4">
              Lot is segregated. Segregated Qty: {segregationData?.segregated_qty || 0} units. Location: {segregationData?.segregated_location || 'QA Hold Area'}.
            </div>
            
            {/* Disposition Buttons - Show based on specified conditions */}
            {(row as any)?.status === 'QA_HOLD' && 
             (row as any)?.qa_required === true &&
             (row as any)?.qa_approved === false &&
             (segregationData?.segregated_qty || 0) > 0 &&
             !segregationData?.disposition && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">Disposition Required for Segregated Lot</div>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold transition-colors"
                    onClick={() => openDispositionModal(String(batchId), (row as any)?.lot_number || 'Unknown', 'REWORK')}
                  >
                    Rework
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                    onClick={() => openDispositionModal(String(batchId), (row as any)?.lot_number || 'Unknown', 'DOWNGRADE')}
                  >
                    Downgrade
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors"
                    onClick={() => openDispositionModal(String(batchId), (row as any)?.lot_number || 'Unknown', 'SCRAP')}
                  >
                    Scrap
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  type AllergenModalProps = {
    isOpen: boolean
    onClose: () => void
    productAllergens: string[]
    lineAllowedAllergens: string[]
    sanitationMinutes?: number | null
    qaRequired?: boolean
    onApprove: () => void
    onReschedule: () => void
  }
  const AllergenConflictModal: React.FC<AllergenModalProps> = ({ isOpen, onClose, productAllergens, lineAllowedAllergens, sanitationMinutes, qaRequired, onReschedule }) => {
    if (!isOpen) return null
    const mismatches = (productAllergens || []).filter(a => !(lineAllowedAllergens || []).includes(a))
    
    // Get active batch for QA approval check
    const activeBatch = allergenModalBatchId ? (items || []).find(r => String(r.id) === String(allergenModalBatchId)) : null
    const qaApproved = activeBatch?.qaApproved === true
    
    const onApprove = () => {
      if (!activeBatch?.id) return;

      if (!activeBatch.qaApproved) {
        pushToast({ type: 'error', message: 'Cannot complete sanitation: QA approval required.' });
        return;
      }

      markSanitationComplete(activeBatch.id);
      onClose();
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
        <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-dark">Allergen Conflict Detected</h3>
              <p className="text-sm text-neutral-medium">Product allergens are not fully allowed on this line. Review sanitation and QA requirements.</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-neutral-soft bg-neutral-light/40 p-4">
                <div className="text-xs text-neutral-medium uppercase mb-2">Product Allergens</div>
                <div className="flex flex-wrap gap-2">
                  {(productAllergens || []).map((a, i) => (
                    <span key={i} className={`px-2 py-1 rounded-full text-xs font-semibold ${mismatches.includes(a) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{a}</span>
                  ))}
                  {(!productAllergens || productAllergens.length === 0) && (
                    <span className="text-sm text-neutral-medium">None</span>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-soft bg-neutral-light/40 p-4">
                <div className="text-xs text-neutral-medium uppercase mb-2">Line Allowed Allergens</div>
                <div className="flex flex-wrap gap-2">
                  {(lineAllowedAllergens || []).map((a, i) => (
                    <span key={i} className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{a}</span>
                  ))}
                  {(!lineAllowedAllergens || lineAllowedAllergens.length === 0) && (
                    <span className="text-sm text-neutral-medium">None specified</span>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-soft bg-neutral-light/30 p-4">
              <div className="text-sm text-neutral-dark"><span className="font-semibold">Sanitation Window:</span> {sanitationMinutes != null ? `${sanitationMinutes} minutes` : 'N/A'}</div>
              <div className="text-sm text-neutral-dark mt-1"><span className="font-semibold">QA Requirement:</span> {qaRequired ? 'QA sign-off required before start' : 'No QA sign-off required'}</div>
            </div>
            {qaRequired && !qaApproved && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 mt-0.5">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-amber-900">QA Approval Required</div>
                    <div className="text-sm text-amber-800 mt-1">
                      You need to approve QA first before you can mark sanitation as complete. Please ensure quality requirements are met.
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button 
                className="px-5 py-2 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={onApprove}
                disabled={!qaApproved}
                title={!qaApproved ? 'QA approval required before completing sanitation' : ''}
              >
                Mark Sanitation + QA Complete
              </button>
              <button className="px-5 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-sm" onClick={onReschedule}>
                Reschedule Batch
              </button>
              <button className="px-4 py-2 rounded-lg border text-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-2 sm:p-4 lg:p-6">
        {/* Toasts */}
        <div className="fixed top-4 right-4 z-[1000] space-y-2">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-lg shadow-md text-sm ${t.type==='error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>{t.message}</div>
          ))}
        </div>

        {/* Start Error Modal (block starting batch if RPC reports required fields missing) */}
        {startErrorModal && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setStartErrorModal(null)}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-soft/40 bg-neutral-light/40">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-dark">Cannot Start Batch</h3>
                  <button className="text-neutral-medium hover:text-neutral-dark" onClick={() => setStartErrorModal(null)}>✕</button>
                </div>
              </div>
              <div className="p-6 space-y-3">
                <div className="text-sm text-neutral-medium">Batch ID</div>
                <div className="text-neutral-dark font-semibold">{startErrorModal.batchId}</div>
                <div className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {startErrorModal.message || 'A required field is missing. Please update the batch details.'}
                </div>
                <div className="text-xs text-neutral-medium">Update the missing/required fields (e.g., lot out) before starting this batch.</div>
              </div>
              <div className="px-6 py-4 border-t border-neutral-soft/40 bg-white flex items-center justify-end gap-3">
                <button className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark bg-white hover:border-neutral-medium" onClick={() => setStartErrorModal(null)}>Close</button>
                <button className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold" onClick={() => handleOpenEditFromStartError(startErrorModal.batchId)}>Update Required Fields</button>
              </div>
            </div>
          </div>
        )}

        {/* Allergen Conflict Modal (global, outside any other modal) */}
        {allergenModalBatchId && (() => {
          const row = (items || []).find(r => String(r.id) === String(allergenModalBatchId))
          const product = row ? productByName.get(String(row.product || '')) : undefined
          const line = row ? productionLineByName.get(String(row.room || '')) : undefined
          const productAllergens = (product?.allergen_profile || []) as string[]
          const lineAllowed = (line?.allowed_allergens || []) as string[]
          const minutes = sanitationDetailsMap[allergenModalBatchId]?.minutes ?? null
          const qaReq = qaRequiredMap[allergenModalBatchId]
          return (
            <AllergenConflictModal
              isOpen={true}
              onClose={() => setAllergenModalBatchId(null)}
              productAllergens={productAllergens}
              lineAllowedAllergens={lineAllowed}
              sanitationMinutes={minutes}
              qaRequired={qaReq}
              onApprove={() => {
                const id = String(allergenModalBatchId)
                setQaApprovedMap(prev => ({ ...prev, [id]: true }))
                setAllergenConflictMap(prev => ({ ...prev, [id]: false }))
                setAllergenModalBatchId(null)
              }}
              onReschedule={async () => {
                try {
                  const id = String(allergenModalBatchId)
                  const full = await fetchRowById(id)
                  setEditItem(full)
                } catch {}
                setAllergenModalBatchId(null)
              }}
            />
          )
        })()}

        {/* Merge Batches Preview Modal */}
        {mergeModalOpen && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMergeModalOpen(false)}></div>
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-soft/40 bg-neutral-light/40">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-dark">Merge Batches Preview</h3>
                  <button className="text-neutral-medium hover:text-neutral-dark" onClick={() => setMergeModalOpen(false)}>✕</button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-sm text-neutral-medium">Product (SKU)</div>
                <div className="text-neutral-dark font-semibold">{mergeTargets[0]?.product || '—'}</div>

                <div className="mt-2">
                  <div className="text-sm font-medium text-neutral-dark mb-2">Batches to merge</div>
                  <div className="border border-neutral-soft rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-light/40">
                        <tr>
                          <th className="px-3 py-2 text-left text-neutral-medium">Batch ID</th>
                          <th className="px-3 py-2 text-left text-neutral-medium">PO Source</th>
                          <th className="px-3 py-2 text-right text-neutral-medium">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mergeTargets.map(b => (
                          <tr key={b.id} className="border-t border-neutral-soft/40">
                            <td className="px-3 py-2 text-neutral-dark">{b.id}</td>
                            <td className="px-3 py-2 text-neutral-dark">{b.sourcePoId ? (poSourceMap[b.sourcePoId] || 'PO') : '—'}</td>
                            <td className="px-3 py-2 text-right text-neutral-dark">{b.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 text-sm">
                  <div className="text-neutral-medium">Final merged quantity</div>
                  <div className="text-neutral-dark font-semibold">{mergeTargets.reduce((s, b) => s + Number(b.qty || 0), 0)}</div>
                </div>

                <div className="mt-3 text-xs text-neutral-medium">
                  Material requirements impact will be recalculated for the merged batch based on the final quantity.
                </div>
              </div>
              <div className="px-6 py-4 border-t border-neutral-soft/40 bg-white flex items-center justify-end gap-3">
                <button className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark bg-white hover:border-neutral-medium" onClick={() => setMergeModalOpen(false)}>Cancel</button>
                <button className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold" onClick={handleConfirmMerge}>Confirm Merge</button>
              </div>
            </div>
          </div>
        )}

        {/* Disposition Confirmation Modal */}
        {dispositionModal.isOpen && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={closeDispositionModal}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-soft/40 bg-neutral-light/40">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-dark">Confirm Disposition Action</h3>
                  <button 
                    className="text-neutral-medium hover:text-neutral-dark" 
                    onClick={closeDispositionModal}
                    disabled={isApplyingDisposition}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-sm text-neutral-dark">
                  Apply <span className="font-semibold">{dispositionModal.action}</span> to lot <span className="font-semibold">{dispositionModal.lotNumber}</span>?
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-dark mb-2">
                    Notes
                  </label>
                  <textarea
                    value={dispositionNotes}
                    onChange={(e) => setDispositionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-soft rounded-lg text-sm resize-none"
                    rows={3}
                    placeholder="Enter disposition notes..."
                    disabled={isApplyingDisposition}
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    className="px-4 py-2 rounded-lg border text-sm" 
                    onClick={closeDispositionModal}
                    disabled={isApplyingDisposition}
                  >
                    Cancel
                  </button>
                  <button 
                    className={`px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      dispositionModal.action === 'REWORK' ? 'bg-yellow-500 hover:bg-yellow-600' :
                      dispositionModal.action === 'DOWNGRADE' ? 'bg-blue-500 hover:bg-blue-600' :
                      'bg-red-500 hover:bg-red-600'
                    }`}
                    onClick={applyDisposition}
                    disabled={isApplyingDisposition}
                  >
                    {isApplyingDisposition ? 'Applying...' : `Confirm ${dispositionModal.action}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-1">
                {activeSection === 'lines' ? 'Production' : 'Production Schedule'}
              </h1>
              
            </div>
            <div className="flex items-center gap-3">
              {activeSection === 'schedule' && (
              <button
                onClick={loadBatches}
                className="px-5 py-3 rounded-xl bg-neutral-light hover:bg-neutral-soft text-neutral-dark text-sm font-semibold transition-all shadow-sm hover:shadow-md"
              >
                {loading ? "Loading…" : "Reload"}
              </button>
              )}
              {activeSection === 'schedule' && highlightPoId && !isScheduleFromPoViewOnly ? (
                <button
                  onClick={async () => {
                    try {
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
                        pushToast({ type: 'success', message: 'Batch created from Copack PO' })
                      } else {
                        // For non-copack POs, do not trigger any creation here until the correct RPC is confirmed
                        pushToast({ type: 'warning', message: 'Auto-create is available for Copack POs only on this button.' })
                      }
                    } catch (e: any) {
                      pushToast({ type: 'error', message: e?.message || 'Failed to auto-create batch from PO' })
                    } finally {
                      setCreatingFromPo(false)
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                  {creatingFromPo ? 'Creating…' : 'Auto-create from PO'}
                </button>
              ) : null}
              {activeSection === 'schedule' && canManageProduction(currentUserRole) && (
                <button
                  onClick={() => setOpen(true)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all shadow-lg hover:shadow-xl flex items-center"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Schedule Production
                </button>
              )}
              {activeSection === 'lines' && (
                <>
                  <button
                    onClick={() => setLinesRefreshSignal((s)=> s + 1)}
                    className="px-5 py-3 rounded-xl bg-neutral-light hover:bg-neutral-soft text-neutral-dark text-sm font-semibold transition-all shadow-sm hover:shadow-md"
                  >
                    Reload
                  </button>
                  {canManageProduction(currentUserRole) && (
                    <button
                      onClick={() => setLinesOpenCreateSignal((s)=> s + 1)}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all shadow-lg hover:shadow-xl flex items-center"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add Line
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Primary Tabs: Schedule | Lines */}
          <div className="mt-6">
            <div role="tablist" aria-label="Production navigation" className="relative inline-flex items-center rounded-2xl bg-white shadow border border-neutral-soft/30 p-1">
              <span aria-hidden className={`absolute top-1 bottom-1 w-1/2 rounded-xl bg-gradient-to-r from-primary-light/20 to-primary-medium/10 shadow-sm transition-all duration-300 ease-out ${activeSection==='schedule' ? 'left-1' : 'left-1/2'}`} />
              <button role="tab" aria-selected={activeSection==='schedule'} type="button" onClick={() => setActiveSection('schedule')} className={`relative z-10 px-5 py-2 text-sm font-semibold rounded-xl transition-colors ${activeSection==='schedule' ? 'text-primary-dark' : 'text-neutral-medium hover:text-neutral-dark'}`}>Schedule</button>
              <button role="tab" aria-selected={activeSection==='lines'} type="button" onClick={() => setActiveSection('lines')} className={`relative z-10 px-5 py-2 text-sm font-semibold rounded-xl transition-colors ${activeSection==='lines' ? 'text-primary-dark' : 'text-neutral-medium hover:text-neutral-dark'}`}>Lines</button>
            </div>
          </div>

          {/* Room filter tabs (only on Schedule) */}
          {activeSection === 'schedule' && (
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
              {/* Batch type toggle: Original vs Rework */}
              <div className="mt-4 flex items-center justify-between">
                <div className="border-t border-neutral-soft grow" />
                <div className="ml-4 flex items-center gap-2">
                  <span className="text-xs text-neutral-medium">Batch Type:</span>
                  <button
                    type="button"
                    onClick={() => setBatchKind('original')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      batchKind === 'original'
                        ? 'bg-primary-medium text-white border-primary-medium'
                        : 'bg-neutral-light text-neutral-dark border-neutral-soft hover:bg-neutral-soft'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchKind('rework')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      batchKind === 'rework'
                        ? 'bg-primary-medium text-white border-primary-medium'
                        : 'bg-neutral-light text-neutral-dark border-neutral-soft hover:bg-neutral-soft'
                    }`}
                  >
                    Rework
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {activeSection === 'lines' ? (
          <div className="mt-2">
            <ProductionLines embedded refreshSignal={linesRefreshSignal} openCreateSignal={linesOpenCreateSignal} />
          </div>
        ) : (
        <>
        {/* PO Selection Panel */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-neutral-light/60 via-neutral-light/40 to-neutral-soft/30 border-b border-neutral-soft/40">
                <h3 className="text-lg font-semibold text-neutral-dark">Purchase Orders</h3>
                <p className="text-sm text-neutral-medium mt-1">Click to schedule production</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {poLoading ? (
                  <div className="p-6 text-center text-neutral-medium">Loading purchase orders...</div>
                ) : purchaseOrders.length === 0 ? (
                  <div className="p-6 text-center text-neutral-medium">No purchase orders available for scheduling</div>
                ) : (
                  <div className="divide-y divide-neutral-soft/40">
                    {purchaseOrders.map((po) => {
                      return (
                        <div
                          key={po.id}
                          onClick={() => handlePoClick(po)}
                          className="p-4 hover:bg-neutral-light/30 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-neutral-dark">
                              PO #{po.po_number || po.id}
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${(() => {
                              const low = String(po.status || '').toLowerCase().trim()
                              if (low === 'approved') return 'bg-green-100 text-green-800'
                              if (low === 'open') return 'bg-blue-100 text-blue-800'
                              if (low === 'in progress' || low === 'in_progress') return 'bg-amber-100 text-amber-800'
                              if (low === 'quality hold' || low === 'qa hold' || low === 'qa_hold') return 'bg-red-100 text-red-800'
                              if (low === 'ready to ship' || low === 'ready_to_ship') return 'bg-emerald-100 text-emerald-800'
                              if (low === 'completed') return 'bg-emerald-100 text-emerald-800'
                              return 'bg-yellow-100 text-yellow-800'
                            })()}`}>
                              {formatPoStatusLabel(po.status)}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-medium">{po.customer_name || po.customer_company || po.customer || '—'}</div>
                          <div className="text-sm font-medium text-neutral-dark truncate">{po.product_name || po.product || '—'}</div>
                          <div className="text-xs text-neutral-medium mt-1">
                            Qty: {Number(po.quantity || 0).toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-3">
        {/* Suggested Consolidation banners (Schedule tab only) */}
        {activeSection === 'schedule' && (() => {
          try {
            const scheduled = items.filter(it => String(it.status).toLowerCase() === 'scheduled')
            const bySku = new Map<string, ScheduleItem[]>()
            for (const it of scheduled) {
              const k = String(it.product || '')
              if (!bySku.has(k)) bySku.set(k, [])
              bySku.get(k)!.push(it)
            }
            const banners: Array<{ sku: string; targets: ScheduleItem[] }> = []
            const WIN = 48 * 60 * 60 * 1000
            for (const [sku, arr] of bySku) {
              if (arr.length < 2) continue
              const withTimes = arr.map(a => ({
                t: (() => { try { return new Date((a.startDate || a.createdAt || '') as any).getTime() } catch { return NaN } })(),
                row: a
              })).filter(x => Number.isFinite(x.t)).sort((a,b)=>a.t-b.t)
              let close = false
              for (let i=0;i<withTimes.length && !close;i++) {
                for (let j=i+1;j<withTimes.length && !close;j++) {
                  if (Math.abs(withTimes[j].t-withTimes[i].t) <= WIN) close = true
                }
              }
              if (close) banners.push({ sku, targets: withTimes.map(x=>x.row) })
            }
            if (banners.length === 0) return null
            return (
              <div className="mb-4 space-y-3">
                {banners.map(entry => (
                  <div key={entry.sku} className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                          <Lightbulb className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-amber-900">Suggested Consolidation</div>
                          <div className="text-sm text-amber-800">
                            You have multiple batches for <span className="font-semibold">{entry.sku}</span> scheduled close together. Consider merging them to reduce changeovers.
                          </div>
                        </div>
                      </div>
                      {canManageProduction(currentUserRole) && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 shadow-sm transition"
                          onClick={() => handleOpenMergeModal(entry.targets)}
                        >
                          Merge Batches
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          } catch { return null }
        })()}
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
              {canManageProduction(currentUserRole) ? 'Create a production schedule to get started.' : 'No production schedules available to view.'}
            </p>
            {canManageProduction(currentUserRole) && (
              <button
                onClick={() => setOpen(true)}
                className="px-6 py-3 rounded-xl bg-primary-medium hover:bg-primary-dark text-white font-semibold shadow-sm"
              >
                Schedule Production
              </button>
            )}
          </div>
        )}

        {/* Card List (matches PurchaseOrders styling) */}
        {filtered.length > 0 && (
          <div className="space-y-4">
            {/* hidden read of capaMap to satisfy TS/linters */}
            <span className="hidden" aria-hidden="true">{capaBadgeCount}</span>
            {filtered.map((row) => {
              const isHighlighted = highlightPoId && row.sourcePoId && String(row.sourcePoId) === highlightPoId
              return (
                <div
                  key={row.id}
                  onClick={() => { setHighlightPoId(null); setMenuRowId(null); setMenuPosition(null); }}
                  className={`rounded-2xl border border-neutral-soft/40 bg-gradient-to-br from-white to-neutral-light/30 p-5 shadow-sm hover:shadow-md transition-all ${isHighlighted ? 'ring-2 ring-teal-300' : ''}`}
                >
                  <div className="flex items-start justify-between pb-3 border-b border-neutral-soft/60">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-medium">Product</div>
                      <div className="text-sm font-semibold text-neutral-dark truncate">
                        {row.product}
                        {row.sourcePoId && poSourceMap[String(row.sourcePoId)] && (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 align-middle">
                            COPACK
                          </span>
                        )}
                        {row.sourcePoId && poSourceMap[String(row.sourcePoId)] === 'OPS' && (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 align-middle">
                            OPERATION
                          </span>
                        )}
                        {row.sourcePoId && poSourceMap[String(row.sourcePoId)] === 'CLIENT' && (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 align-middle">
                            CLIENT
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${statusChip(row.status)}`}>
                        {statusText(row.status)}
                      </span>
                      <button
                        ref={menuRef}
                        className="menu-button p-2 text-neutral-medium hover:text-primary-medium rounded-md transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (menuRowId === row.id) {
                            setMenuRowId(null);
                            setMenuPosition(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPosition({
                              top: rect.bottom + 4,
                              left: rect.right - 128
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

                  <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-medium">Formula</div>
                      <div className="text-sm font-semibold text-neutral-dark">{row.formula || '—'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-medium">Qty</div>
                      <div className="text-sm font-semibold text-neutral-dark">{row.qty}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-medium">Start Date</div>
                      <div className="text-sm font-semibold text-neutral-dark">{fmtDate(row.startDate)}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3 text-[11px] text-neutral-dark">
                    <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                      <span className="font-semibold">Lot</span>
                      <span className="opacity-80">{row.lot || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                      <span className="font-semibold">Completed</span>
                      <span className="opacity-80">{row.completedQty}</span>
                    </div>
                    {(capaEverMap[row.id] || capaMap[row.id]) && (
                      <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                        <span className="font-semibold">Scrap</span>
                        <span className="opacity-80">{capaScrapQtyMap[row.id] ?? 0}</span>
                      </div>
                    )}
                    {(capaEverMap[row.id] || capaMap[row.id]) && (
                      <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                        <span className="font-semibold">Finished Goods</span>
                        <span className="opacity-80">{Math.max(0, Number(row.completedQty || 0) - Number(capaScrapQtyMap[row.id] ?? 0))}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-neutral-light/40 border border-neutral-soft/60 rounded-md px-3 py-2">
                      <span className="font-semibold">Compliance</span>
                      <div className="flex items-center gap-2">
                        {row.sanitationRequired && (
                          <span className="text-[11px] text-amber-700 font-semibold whitespace-nowrap">
                            Sanitation ({(() => { const m = diffMinutes(row.sanitationStart, row.sanitationEnd); return m != null ? `${m} min` : '—' })()})
                          </span>
                        )}
                        {row.qaRequired && (
                          row.qaApproved ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border border-neutral-300 text-neutral-700 bg-white">QA OK</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-200 text-red-700 bg-red-50">QA Pending</span>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCoaFail(row) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300">
                          COA Fail
                        </span>
                      )}
                      {qaHoldMap[row.id] && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                          QA Hold
                        </span>
                      )}
                      {allergenConflictMap[row.id] && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                          Allergen Conflict
                        </span>
                      )}
                      {(capaEverMap[row.id] || capaMap[row.id]) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                          {capaMap[row.id] ? 'CAPA' : 'CAPA - Revoke'}
                          <span className="ml-1 h-2 w-2 rounded-full bg-yellow-400 inline-block"></span>
                        </span>
                      )}
                      {(row as any)?.flags === 'REWORK' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200" title="This batch was generated from a QA rework request.">
                          REWORK BATCH
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {(() => {
                        const st = String((row as any)?.status || '').toLowerCase()
                        const isInProgress = st === 'in progress' || st === 'in_progress'
                        const isCompleted = st === 'completed'
                        if (isInProgress || isCompleted) return null
                        return (
                          <button
                            className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                            disabled={!!(startDisabled[row.id] || shortagesCache[row.id] || prExistsMap[row.id])}
                            title={(qaRequiredMap[row.id] && !qaApprovedMap[row.id]) ? 'QA approval required (start will show notice).' : (allergenConflictMap[row.id] ? 'Allergen conflict will be shown.' : undefined)}
                            onClick={(e) => { e.stopPropagation(); onStartBatch(row.id); }}
                          >
                            Start
                          </button>
                        )
                      })()}
                      {shortagesCache[row.id] && (
                        <button
                          className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-semibold border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setShortageInfo({ batchId: row.id, shortages: shortagesCache[row.id] }); }}
                          title="View detected material shortages"
                        >
                          View Shortage
                        </button>
                      )}
                      {!shortagesCache[row.id] && prExistsMap[row.id] && (
                        <button
                          className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors"
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
                      {(() => {
                        const st = String((row as any)?.status || '').toLowerCase()
                        const isCompleted = st === 'completed'
                        if (isCompleted) return null
                        return (
                          <button
                            className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-semibold border bg-white text-neutral-dark border-neutral-soft/60 hover:bg-neutral-light/40 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onCancelBatch(row.id); }}
                          >
                            Cancel
                          </button>
                        )
                      })()}
                      {(() => {
                        const st = String((row as any)?.status || '').toLowerCase()
                        const isInProgress = st === 'in progress' || st === 'in_progress'
                        if (!isInProgress) return null
                        if (isCoaFail(row)) return null
                        return (
                          <button
                            className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-semibold border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setCompleteId(row.id); }}
                          >
                            Complete
                          </button>
                        )
                      })()}
                      <button
                        className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onGeneratePO(row.id); }}
                      >
                        Auto-PO
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
          </div>
        </div>
        </>
        )}

        {/* Fixed positioned dropdown menu */}
        {menuRowId && menuPosition && (
          <div 
            ref={menuPopupRef}
            className="fixed w-40 bg-white border border-neutral-soft rounded-lg shadow-lg z-50 text-xs"
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
            
            {/* Production Manager Status Controls */}
            {canManageProduction(currentUserRole) && (() => {
              const row = filtered.find(r => r.id === menuRowId);
              if (!row) return null;
              
              const availableStatuses = [];
              if (row.status === 'Scheduled') {
                availableStatuses.push('In Progress');
              } else if (row.status === 'In Progress') {
                availableStatuses.push('Production Complete');
              } else if (row.status === 'Production Complete') {
                availableStatuses.push('Completed', 'Quality Hold');
              }
              
              return availableStatuses.map(status => (
                <button
                  key={status}
                  className="w-full flex items-center px-3 py-2 hover:bg-blue-50 text-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (status === 'Quality Hold') {
                      handleQualityHold(menuRowId!);
                    } else {
                      changeProductionStatus(menuRowId!, status);
                    }
                    setMenuRowId(null);
                    setMenuPosition(null);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> {status}
                </button>
              ));
            })()}
            
            {/* Warehouse Shipping Controls */}
            {canManageWarehouse(currentUserRole) && (() => {
              const row = filtered.find(r => r.id === menuRowId);
              if (!row || row.status !== 'Ready to Ship') return null;
              
              return (
                <button
                  className="w-full flex items-center px-3 py-2 hover:bg-green-50 text-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShippingModal({
                      isOpen: true,
                      batchId: menuRowId!,
                      poId: row.sourcePoId || row.po || ''
                    });
                    setMenuRowId(null);
                    setMenuPosition(null);
                  }}
                >
                  <Upload className="h-3.5 w-3.5 mr-2" /> Ship Order
                </button>
              );
            })()}
            
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
                    onClick={() => { try { window.location.href = `/purchase-orders?batch_id=${encodeURIComponent(shortageInfo.batchId)}` } catch {} }}
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
                        <div className="flex flex-col items-start">
                          <span className={selectedProduct?.product_name ? 'text-neutral-dark font-medium' : 'text-neutral-medium'}>
                            {selectedProduct?.product_name || 'Select Product'}
                          </span>
                          {selectedProduct?.product_name && selectedFormulaId && (
                            <span className="text-xs text-neutral-medium">
                              Formula: {formulasMap.get(selectedFormulaId) || 'Unknown'}
                            </span>
                          )}
                        </div>
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
                                // Auto-select formula if product has one
                                setSelectedFormulaId(String((p as any)?.formula_id || ""))
                                setIsProductOpen(false)
                              }}
                            >
                              <div className="flex flex-col items-start">
                                <span className="text-neutral-dark font-medium">{p.product_name}</span>
                                {(() => {
                                  return (p as any)?.formula_id ? (
                                    <span className="text-xs text-neutral-medium">Formula: {(p as any)?.formula_name || '—'}</span>
                                  ) : null
                                })()}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-dark">Formula</label>
                      <div className="w-full px-4 py-3 border border-neutral-soft rounded-xl bg-neutral-light/30 text-neutral-dark">
                        {selectedFormulaId ? 
                          formulasMap.get(selectedFormulaId) || 'Formula not found' : 
                          'Auto-selected when product is chosen'
                        }
                      </div>
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
                      <label className="text-sm font-semibold text-neutral-dark">Finished Goods Lot Number <span className="text-red-500">*</span></label>
                      <input
                        placeholder="e.g., LOT-2024-001"
                        value={lot}
                        onChange={(e) => setLot(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-xl bg-white"
                        required
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
                        {productionLineNames.map((r) => (
                          <option key={r} value={r}>{r}</option>
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
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => !savingEdit && setEditItem(null)}></div>
            <div className="relative z-10 w-full max-w-5xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-dark">Edit Production Batch</h2>
                  <p className="text-sm text-neutral-medium mt-1">Modify batch details</p>
                </div>
                <button onClick={() => !savingEdit && setEditItem(null)} className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-8 space-y-6">
                  {/* Row: Scheduled Date */}
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Scheduled Date</label>
                      <input
                        type="date"
                        value={editItem.start_date || ""}
                        onChange={(e) => setEditItem({ ...editItem, start_date: e.target.value, end_date: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                      />
                    </div>
                  </div>

                  {/* Row: Customer / Product / Formula */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Customer</label>
                      <select
                        value={String(editItem.customer_id ?? '')}
                        onChange={(e) => setEditItem({ ...editItem, customer_id: e.target.value || null })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        <option value="">Select Customer</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.company_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Product</label>
                      <input
                        value={editItem.product_sku}
                        onChange={(e) => setEditItem({ ...editItem, product_sku: e.target.value })}
                        placeholder="Select Product"
                        className="w-full px-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md"
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Formula</label>
                      <select
                        value={String(editItem.formula_id ?? '')}
                        onChange={(e) => setEditItem({ ...editItem, formula_id: e.target.value || null })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        <option value="">Select Formula</option>
                        {formulas.map(f => (
                          <option key={f.id} value={f.id}>{f.formula_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Card: Material Requirements (display only for parity) */}
                  <div className="rounded-xl border border-neutral-soft bg-gradient-to-br from-neutral-light/40 to-neutral-light/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-neutral-dark">Material Requirements</div>
                      <button disabled className="px-3 py-1.5 text-xs rounded-md bg-neutral-light text-neutral-medium border border-neutral-soft cursor-not-allowed">Auto-Generate Purchase Orders for Shortages</button>
                    </div>
                    <div className="text-xs text-neutral-medium">Select a formula and enter a goal quantity</div>
                  </div>

                  {/* Row: Lot # / PO # */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Finished Goods Lot Number</label>
                      <input
                        value={editItem.lot_number || ""}
                        placeholder="e.g., LOT-2024-001"
                        onChange={(e) => setEditItem({ ...editItem, lot_number: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Purchase Order #</label>
                      <input
                        value={editItem.po_number || ""}
                        placeholder="e.g., PO-2024-001"
                        onChange={(e) => setEditItem({ ...editItem, po_number: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                      />
                    </div>
                  </div>

                  {/* Row: Production Room / Goal (Qty) / Completed */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Production Room</label>
                      <select
                        value={editItem.room || ''}
                        onChange={(e) => setEditItem({ ...editItem, room: e.target.value, assigned_line: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        {productionLineNames.map((r: string) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Goal (Qty)</label>
                      <input
                        type="number"
                        value={String(editItem.qty ?? "")}
                        placeholder="Target quantity"
                        onChange={(e) => setEditItem({ ...editItem, qty: Number(e.target.value || 0), required_capacity: Number(e.target.value || 0) })}
                        className="w-full px-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md"
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Completed</label>
                      <input
                        type="number"
                        value={String(editItem.completed_qty ?? 0)}
                        onChange={(e) => setEditItem({ ...editItem, completed_qty: Number(e.target.value || 0) })}
                        className="w-full px-4 py-4 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md"
                      />
                    </div>
                  </div>

                  {/* Row: Samples Received / Samples Sent */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Samples Received</label>
                      <select
                        value={editItem.samples_received ? "Yes" : "No"}
                        onChange={(e) => setEditItem({ ...editItem, samples_received: e.target.value === "Yes" })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        {yesNo.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Samples Sent</label>
                      <input
                        type="date"
                        value={editItem.samples_sent || ""}
                        onChange={(e) => setEditItem({ ...editItem, samples_sent: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                      />
                    </div>
                  </div>

                  {/* Row: Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="flex items-center text-sm font-semibold text-neutral-dark">Status</label>
                      <select
                        value={editItem.status}
                        onChange={(e) => setEditItem({ ...editItem, status: e.target.value })}
                        className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                      >
                        {statusList.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEditItem(null)}
                      className="px-4 py-2 rounded-lg border border-neutral-soft bg-white hover:bg-neutral-light text-neutral-dark disabled:opacity-60"
                      disabled={savingEdit}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      className="px-5 py-2.5 rounded-lg bg-primary-dark hover:bg-primary-medium text-white text-sm font-medium shadow-sm disabled:opacity-60"
                      disabled={savingEdit}
                    >
                      {savingEdit ? 'Saving...' : 'Save'}
                    </button>
                  </div>
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
                          className={(varianceHigh ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-medium hover:bg-primary-dark') + ' text-white px-5 py-2 rounded-xl'}
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

      {/* QA Hold Modal - Positioned at component root level */}
      {qaHoldModalBatch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setQaHoldModalBatch(null); setQaHoldComponents([]) }}></div>
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-neutral-soft/40 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-dark">QA Hold – Components Locked</h2>
                <p className="text-sm text-neutral-medium">
                  One or more required components are on QA Hold. This batch cannot start until QA releases the hold.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
                  Held Components
                </div>
                <div className="flex flex-wrap gap-2">
                  {qaHoldComponents.map((c) => (
                    <div
                      key={String(c.material_id)}
                      className="inline-flex flex-col md:flex-row md:items-center gap-1 md:gap-2 rounded-full bg-rose-50 px-3 py-1 border border-rose-100"
                    >
                      <span className="text-xs font-medium text-rose-700">
                        {c.material_name}
                        {c.sku ? ` (${c.sku})` : ''}
                      </span>
                      {c.qa_hold_reason && (
                        <span className="text-[10px] text-rose-500">
                          {c.qa_hold_reason}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-neutral-500">
                Please coordinate with QA to review and release any holds on these components. Once QA clears them, refresh this page and try starting the batch again.
              </p>
            </div>
            <div className="px-6 py-3 border-t border-neutral-soft/40 flex justify-end gap-2 bg-neutral-light/30">
              <button
                type="button"
                onClick={() => { setQaHoldModalBatch(null); setQaHoldComponents([]) }}
                className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800 shadow"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule from PO Modal */}
      {scheduleFromPoOpen && selectedPo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !creatingFromPo && setScheduleFromPoOpen(false)}></div>
          <div className="relative z-10 w-full max-w-2xl max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-neutral-light to-neutral-light/80 border-b border-neutral-soft/50">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-dark">Schedule from Purchase Order</h2>
                <p className="text-sm text-neutral-medium mt-1">Create production batches from PO #{selectedPo.po_number || selectedPo.id}</p>
              </div>
              <button 
                onClick={() => !creatingFromPo && setScheduleFromPoOpen(false)} 
                className="p-3 text-neutral-medium hover:text-neutral-dark hover:bg-white/60 rounded-xl transition-all duration-200 hover:shadow-sm"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto">
              {/* PO Information (Read-Only) */}
              <div className="rounded-xl border border-neutral-soft bg-neutral-light/20 p-6">
                <h3 className="text-lg font-semibold text-neutral-dark mb-4">Purchase Order Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-neutral-medium mb-1">PO Number</div>
                    <div className="font-semibold text-neutral-dark">{selectedPo.po_number || selectedPo.id}</div>
                  </div>
                  <div>
                    <div className="text-neutral-medium mb-1">Customer</div>
                    <div className="font-semibold text-neutral-dark">
                      {customers.find(c => c.id === selectedPo.customer_id)?.company_name || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-medium mb-1">Product</div>
                    <div className="font-semibold text-neutral-dark">{selectedPo.product_name}</div>
                  </div>
                  <div>
                    <div className="text-neutral-medium mb-1">Status</div>
                    <div className="font-semibold text-neutral-dark">{formatPoStatusLabel(selectedPo.status)}</div>
                  </div>
                </div>
              </div>

              {/* Quantity Information */}
              <div className="rounded-xl border border-neutral-soft bg-white p-6">
                <h3 className="text-lg font-semibold text-neutral-dark mb-4">Quantity Breakdown</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-neutral-medium mb-1">Total PO Quantity</div>
                    <div className="text-2xl font-bold text-neutral-dark">{Number(selectedPo.quantity || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-neutral-medium mb-1">Already Scheduled</div>
                    <div className="text-2xl font-bold text-blue-600">{alreadyScheduled.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-neutral-medium mb-1">Product Goal (Remaining)</div>
                    <div className="text-2xl font-bold text-primary-medium">{productGoal.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Batch Goal Input */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-dark mb-2">Scheduled Date</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={todayLocalISO}
                      disabled={isScheduleFromPoViewOnly}
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-dark mb-2">Production Room</label>
                    <select
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      disabled={isScheduleFromPoViewOnly}
                      className="w-full px-4 py-3 border border-neutral-soft rounded-lg bg-white focus:ring-2 focus:ring-primary-light focus:border-primary-light"
                    >
                      {productionLineNames.map((r: string) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-dark mb-2">Batch Goal</label>
                  <input
                    type="number"
                    value={batchGoal}
                    onChange={(e) => setBatchGoal(e.target.value)}
                    placeholder="Enter quantity for this batch"
                    min="1"
                    max={productGoal}
                    disabled={isScheduleFromPoViewOnly}
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                  />
                  <p className="text-xs text-neutral-medium mt-1">
                    Maximum: {productGoal.toLocaleString()} (remaining quantity)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-dark mb-2">Lot Number (Optional)</label>
                  <input
                    type="text"
                    value={lot}
                    onChange={(e) => setLot(e.target.value)}
                    placeholder="Enter lot number"
                    disabled={isScheduleFromPoViewOnly}
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                  />
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-neutral-soft/50 bg-white flex items-center justify-between">
              <div className="text-sm text-neutral-medium">
                {productGoal > 0 ? 'Modal will stay open for additional scheduling' : 'PO fully scheduled'}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScheduleFromPoOpen(false)}
                  disabled={creatingFromPo}
                  className="px-5 py-2.5 rounded-xl border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all disabled:opacity-50"
                >
                  Close
                </button>
                {isScheduleFromPoViewOnly ? (
                  <span className="px-4 py-2.5 rounded-xl bg-neutral-light/60 text-neutral-dark font-semibold border border-neutral-soft">
                    View Only
                  </span>
                ) : (
                  <button
                    onClick={createBatchFromPo}
                    disabled={creatingFromPo || !batchGoal || !scheduledDate || Number(batchGoal) <= 0 || Number(batchGoal) > productGoal}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {creatingFromPo ? 'Creating Batch...' : 'Create Batch'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Shipping Modal for Warehouse Staff */}
        {shippingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShippingModal(null)}></div>
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-soft/20 overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-dark">Ship Order</h3>
                  <p className="text-sm text-neutral-medium">Upload shipping document and mark as shipped</p>
                </div>
                <button className="p-2" onClick={() => setShippingModal(null)}><X className="h-5 w-5"/></button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-dark mb-2">Shipping Document</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setShippingFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-3 border border-neutral-soft rounded-lg focus:ring-2 focus:ring-primary-light focus:border-primary-light bg-white text-neutral-dark"
                  />
                  <p className="text-xs text-neutral-medium mt-1">
                    Upload scan of shipping document (PDF, JPG, PNG)
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    onClick={() => setShippingModal(null)}
                    disabled={uploading}
                    className="px-4 py-2 rounded-lg border border-neutral-soft text-neutral-dark hover:bg-neutral-light/60 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleShipOrder(shippingModal.batchId, shippingModal.poId)}
                    disabled={uploading || !shippingFile}
                    className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {uploading ? 'Shipping...' : 'Mark as Shipped'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default ProductionSchedule;
