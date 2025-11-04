import { RULES_CONFIG } from '../config/rules-config'
import { Flag, Status } from '../domain/enums'
import { ProductionOrder } from '../domain/models'
import { ProductionRule } from './types'

const addFlag = (po: ProductionOrder, flag: Flag) => {
  const flags = new Set(po.flags || [])
  flags.add(flag)
  po.flags = Array.from(flags)
}

export const productionRules: ProductionRule[] = [
  {
    id: 'production.capacityOverload',
    when: (prod: ProductionOrder) => {
      const room = prod.assignedLine || prod.room
      const limit = RULES_CONFIG.CAPACITY_LIMITS[room] ?? Infinity
      const required = prod.requiredCapacity ?? prod.qty
      return required > limit
    },
    then: (prod) => addFlag(prod, Flag.CapacityOverload)
  },
  {
    id: 'production.statusNormalization',
    when: (prod: ProductionOrder) => !prod.status,
    then: (prod) => { prod.status = Status.Scheduled }
  }
]
