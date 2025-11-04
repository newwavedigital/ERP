import { Flag, InventoryBucket, POType, Status } from './enums'

export interface InventoryItem {
  id: string
  sku: string
  name: string
  bucket: InventoryBucket
  onHand: number
  allocated: number
  reorderPoint?: number
  moq?: number
  expiryDate?: string
  allergens?: string[]
  qaHold?: boolean
  stdCost?: number
  lastCost?: number
  flags?: Flag[]
}

export interface PurchaseOrderLine {
  sku: string
  qty: number
  cost: number
}

export interface PurchaseOrder {
  id: string
  type: POType
  status: Status
  supplier: string
  customer?: string
  lines: PurchaseOrderLine[]
  submittedAt?: string
  approvedAt?: string
  flags?: Flag[]
}

export interface ProductionOrder {
  id: string
  productSku: string
  qty: number
  room: string
  startDate: string
  endDate?: string
  status: Status
  requiredCapacity?: number
  assignedLine?: string
  flags?: Flag[]
}
