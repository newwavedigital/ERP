import { useMemo } from 'react'

export interface POLineLike {
  product_name: string
  quantity?: number
}

export function useSubstituteChecker(poLines: POLineLike[] = [], productsIndex: Record<string, any> = {}) {
  const result = useMemo(() => {
    const discontinuedItems = (poLines || []).filter(l => {
      const p = productsIndex?.[l.product_name]
      return !!p?.is_discontinued
    })

    const hasSubs = discontinuedItems.some(l => {
      const p = productsIndex?.[l.product_name]
      return !!p?.substitute_sku
    })

    const needsBlock = discontinuedItems.some(l => {
      const p = productsIndex?.[l.product_name]
      return !p?.substitute_sku
    })

    return {
      discontinuedItems,
      canApprove: discontinuedItems.length === 0 || (discontinuedItems.length > 0 && hasSubs && !needsBlock),
      firstIssueMessage: discontinuedItems.length > 0 ? 'Selected SKU is discontinued. Choose a substitute before submitting.' : '',
      hasSubstitutes: hasSubs,
    }
  }, [poLines, productsIndex])

  return result
}
