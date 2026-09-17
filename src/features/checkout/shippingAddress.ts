import type { Json } from '@/lib/supabase/types'

/**
 * `orders.shipping_address` is a jsonb snapshot, not a live FK to `addresses`
 * -- it has to keep rendering correctly even after the source address row is
 * edited or deleted. Defensive by necessity: the column has no schema beyond
 * "is an object".
 */
export function formatShippingAddress(address: Json): string {
  if (typeof address !== 'object' || address === null || Array.isArray(address)) return ''

  const a = address as Record<string, Json>
  const parts = [a.line1, a.line2, a.city, a.district, a.postal_code]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)

  return parts.join(', ')
}
