import { RULES_CONFIG } from '../config/rules-config'
import { Flag } from '../domain/enums'
import { InventoryItem } from '../domain/models'
import { EvaluationContext, InventoryRule } from './types'

const addFlag = (item: InventoryItem, flag: Flag) => {
  const flags = new Set(item.flags || [])
  flags.add(flag)
  item.flags = Array.from(flags)
}

export const inventoryRules: InventoryRule[] = [
  {
    id: 'inventory.lowStock',
    when: (item: InventoryItem) => {
      const rp = item.reorderPoint ?? 0
      const threshold = Math.max(rp, Math.ceil((item.onHand + item.allocated) * RULES_CONFIG.LOW_STOCK_THRESHOLD_PCT))
      return item.onHand <= threshold
    },
    then: (item) => addFlag(item, Flag.LowStock),
  },
  {
    id: 'inventory.moqBreach',
    when: (item: InventoryItem) => {
      if (!item.moq) return false
      return (item.onHand + (item.allocated || 0)) < item.moq
    },
    then: (item) => addFlag(item, Flag.MOQBreached),
  },
  {
    id: 'inventory.expiryRisk',
    when: (item: InventoryItem, ctx: EvaluationContext) => {
      if (!item.expiryDate) return false
      const days = Math.ceil((new Date(item.expiryDate).getTime() - ctx.now.getTime()) / (1000 * 60 * 60 * 24))
      return days <= RULES_CONFIG.EXPIRY_DAYS_WARNING
    },
    then: (item) => addFlag(item, Flag.ExpiryRisk),
  },
  {
    id: 'inventory.allergenRisk',
    when: (item: InventoryItem) => Array.isArray(item.allergens) && item.allergens.length > 0,
    then: (item) => addFlag(item, Flag.AllergenRisk),
  },
  {
    id: 'inventory.qaHold',
    when: (item: InventoryItem) => !!item.qaHold,
    then: (item) => addFlag(item, Flag.QAHold),
  },
]
