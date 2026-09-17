import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getVariantsForCart } from '@/lib/supabase/queries'
import { useCart } from '@/store/cart'

export type CartIssue =
  | { type: 'unavailable' }
  | { type: 'out-of-stock' }
  | { type: 'low-stock'; available: number }
  | { type: 'price-changed'; newUnitPriceMinor: number }

/**
 * Revalidates the cart's display snapshot against the live catalog. The cart
 * store only exists so the drawer renders instantly with zero network --
 * `create_order()` re-prices everything anyway -- but a customer should see
 * "Price updated" or "Only 2 left" before they get to checkout, not a
 * rejected order after filling in delivery details. Meant to be called once
 * per drawer-open / checkout-mount, not polled.
 */
export function useCartValidation() {
  const lines = useCart((s) => s.lines)
  const variantIds = useMemo(() => lines.map((l) => l.variantId).sort(), [lines])

  const query = useQuery({
    queryKey: ['cart-validation', variantIds],
    queryFn: () => getVariantsForCart(variantIds),
    enabled: variantIds.length > 0,
    staleTime: 0,
  })

  const issues = useMemo(() => {
    const map = new Map<string, CartIssue>()
    if (!query.data) return map

    const live = new Map(query.data.map((v) => [v.id, v]))
    for (const line of lines) {
      const variant = live.get(line.variantId)

      if (!variant || !variant.is_active || variant.products?.status !== 'ACTIVE') {
        map.set(line.variantId, { type: 'unavailable' })
        continue
      }
      if (variant.stock <= 0) {
        map.set(line.variantId, { type: 'out-of-stock' })
        continue
      }

      const liveUnitPriceMinor = variant.products.price_minor + variant.price_delta_minor
      if (liveUnitPriceMinor !== line.unitPriceMinor) {
        map.set(line.variantId, { type: 'price-changed', newUnitPriceMinor: liveUnitPriceMinor })
        continue
      }
      if (variant.stock < line.quantity) {
        map.set(line.variantId, { type: 'low-stock', available: variant.stock })
      }
    }
    return map
  }, [lines, query.data])

  const hasBlockingIssues = useMemo(
    () => [...issues.values()].some((i) => i.type === 'unavailable' || i.type === 'out-of-stock'),
    [issues],
  )

  return { issues, isLoading: query.isLoading, hasBlockingIssues }
}
