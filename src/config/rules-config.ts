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
