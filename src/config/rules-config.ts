export const RULES_CONFIG = {
  LOW_STOCK_THRESHOLD_PCT: 0.15, // 15%
  EXPIRY_DAYS_WARNING: 30,
  COST_VARIANCE_PCT: 0.1, // 10%
  CAPACITY_LIMITS: {
    'Main Room': 500,
    'Room A': 250,
    'Room B': 250,
  } as Record<string, number>,
}

export type RulesConfig = typeof RULES_CONFIG

export const PO_RULES = {
  RUSH_WINDOW_DAYS: 3,
  MESSAGES: {
    required:
      'Please complete all required fields: Customer, Ship Date, Location, and at least one valid line (SKU + Qty > 0).',

    creditHold:
      'Customer is on credit hold or has overdue balance. PO will be set to On Hold.',

    discontinued:
      'Selected SKU is discontinued. Please choose a substitute product before submitting.',

    rush:
      'This is a Rush Order based on the ship date. This will require approval.',
  },
};
