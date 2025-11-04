import { EvaluationContext, Rule } from './types'

export function evaluateRules<T extends { flags?: string[] }>(
  entity: T,
  rules: Rule<T>[],
  ctx: EvaluationContext
): { entity: T; fired: string[] } {
  const fired: string[] = []
  let working = { ...entity }

  for (const rule of rules) {
    try {
      if (rule.when(working, ctx)) {
        const actions = Array.isArray(rule.then) ? rule.then : [rule.then]
        for (const act of actions) {
          const result = act(working, ctx)
          if (result) working = result
        }
        fired.push(rule.id)
      }
    } catch (e) {
      // fail-safe: keep going even if a rule throws
      // eslint-disable-next-line no-console
      console.warn(`Rule execution error for ${rule.id}:`, e)
    }
  }

  return { entity: working, fired }
}
