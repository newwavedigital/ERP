import { PO_RULES } from '../config/rules-config'

export function validatePODraft(po: any, customer: any, productsIndex: Record<string, any>) {
  const errors: string[] = []
  const warnings: string[] = []
  const flags = { rush: false, creditHold: false, hasDiscontinued: false }

  // Required fields
  if (!po.customer_id || !po.ship_date || !po.location || !String(po.location).trim()) {
    errors.push(PO_RULES.MESSAGES.required)
  }

  // At least one line
  if (!po.lines || po.lines.length === 0) {
    errors.push('PO must have at least one line.')
  }

  // Line validation (SKU + qty)
  const badLines = (po.lines || []).filter((l: any) => !l.sku && !l.product_name || !l.qty || l.qty <= 0)
  if (badLines.length > 0) {
    errors.push('All lines must have SKU and quantity > 0.')
  }

  // Discontinued logic
  const disco = (po.lines || []).some((l: any) => {
    const key = l.sku || l.product_name
    const prod = productsIndex?.[key]
    const d = (l as any).is_discontinued ?? prod?.is_discontinued ?? false
    const sub = (l as any).substitute_sku ?? prod?.substitute_sku ?? null
    return d && !sub
  })
  if (disco) {
    flags.hasDiscontinued = true
    errors.push(PO_RULES.MESSAGES.discontinued)
  }

  // Credit hold & overdue logic
  const creditHold = customer?.credit_hold === true || Number(customer?.overdue_balance || 0) > 0
  if (creditHold) {
    flags.creditHold = true
    warnings.push(PO_RULES.MESSAGES.creditHold)
  }

  // Rush logic
  try {
    const today = new Date()
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const shipD = new Date(po.ship_date)
    const s0 = new Date(shipD.getFullYear(), shipD.getMonth(), shipD.getDate()).getTime()
    const days = Math.round((s0 - t0) / (1000 * 60 * 60 * 24))
    if (days <= PO_RULES.RUSH_WINDOW_DAYS) {
      flags.rush = true
      warnings.push(PO_RULES.MESSAGES.rush)
    }
  } catch {}

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    flags,
  }
}
