import { RULES_CONFIG } from '../config/rules-config'
import { Flag, Status } from '../domain/enums'
import { PurchaseOrder } from '../domain/models'
import { PORule } from './types'

const addFlag = (po: PurchaseOrder, flag: Flag) => {
  const flags = new Set(po.flags || [])
  flags.add(flag)
  po.flags = Array.from(flags)
}

export const poRules: PORule[] = [
  {
    id: 'po.costVariance',
    when: (po: PurchaseOrder) => {
      return po.lines.some(l => typeof l.cost === 'number') && po.lines.some(l => l.cost !== undefined)
    },
    then: (po: PurchaseOrder) => {
      // If stdCost present per SKU via external lookup, this rule could be enhanced.
      // Placeholder: flag if any line cost deviates > threshold from the first line cost.
      if (po.lines.length < 2) return
      const base = po.lines[0].cost
      const variance = po.lines.some(l => Math.abs(l.cost - base) / Math.max(1, base) > RULES_CONFIG.COST_VARIANCE_PCT)
      if (variance) addFlag(po, Flag.CostVariance)
    }
  },
  {
    id: 'po.transition.approveToAllocatedOrBackordered',
    when: (po: PurchaseOrder) => po.status === Status.Approved,
    then: (po: PurchaseOrder) => {
      // Placeholder logic; real allocation requires inventory lookup.
      // If any line qty is zero, treat as backordered.
      const anyZero = po.lines.some(l => l.qty <= 0)
      po.status = anyZero ? Status.Backordered : Status.Allocated
    }
  }
]
