export enum POType {
  Brand = 'Brand',
  Copacking = 'Copacking',
}

export enum InventoryBucket {
  RawIngredients = 'RawIngredients',
  PackagingComponents = 'PackagingComponents',
  FinishedGoods = 'FinishedGoods',
  WIP = 'WIP',
}

export enum Status {
  Draft = 'Draft',
  Submitted = 'Submitted',
  Approved = 'Approved',
  Allocated = 'Allocated',
  Backordered = 'Backordered',
  InProduction = 'InProduction',
  ReadyToShip = 'ReadyToShip',
  Closed = 'Closed',
  Canceled = 'Canceled',
  OnHold = 'OnHold',
  Scheduled = 'Scheduled',
}

export enum Flag {
  LowStock = 'LowStock',
  MOQBreached = 'MOQBreached',
  ExpiryRisk = 'ExpiryRisk',
  AllergenRisk = 'AllergenRisk',
  QAHold = 'QAHold',
  CostVariance = 'CostVariance',
  CapacityOverload = 'CapacityOverload',
}
