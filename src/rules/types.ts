import { RulesConfig } from '../config/rules-config'
import { InventoryItem, ProductionOrder, PurchaseOrder } from '../domain/models'

export type EvaluationContext = {
  now: Date
  config: RulesConfig
  // Optional indexes lookups; can be extended later
  inventoryBySku?: Record<string, InventoryItem>
}

export type Condition<T> = (entity: T, ctx: EvaluationContext) => boolean
export type Action<T> = (entity: T, ctx: EvaluationContext) => void | T

export interface Rule<T> {
  id: string
  when: Condition<T>
  then: Action<T> | Action<T>[]
}

export type InventoryRule = Rule<InventoryItem>
export type PORule = Rule<PurchaseOrder>
export type ProductionRule = Rule<ProductionOrder>
