import { useSearchParams } from 'react-router'
import { useCallback, useMemo } from 'react'
import { toMinor } from '@/lib/money'

export type SortOption = 'newest' | 'price-asc' | 'price-desc'

/**
 * URL is the source of truth for shop filters, not component state. Reading
 * from `useSearchParams` (not a `useState` synced to the URL as an effect)
 * means a reload or a shared link reconstructs the exact same view with no
 * extra plumbing, and the back button works because every filter change is a
 * real navigation entry.
 *
 * Price is stored in the URL as whole taka (`min=1000`), not poisha, because
 * a URL a customer might read or share should say ৳1,000, not 100000.
 *
 * Scroll depth is deliberately NOT part of this: the shop page uses infinite
 * scroll, tracked as react-query pageParam state, not a URL page number. The
 * gate this hook exists for is "the filters survive a reload or a shared
 * link", not "the exact scroll position does".
 */
export function useShopFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => {
    const minTaka = searchParams.get('min')
    const maxTaka = searchParams.get('max')

    return {
      category: searchParams.get('category') ?? undefined,
      collectionSlug: searchParams.get('collection') ?? undefined,
      minPriceMinor: minTaka ? toMinor(minTaka) : undefined,
      maxPriceMinor: maxTaka ? toMinor(maxTaka) : undefined,
      inStockOnly: searchParams.get('inStock') === '1',
      sort: (searchParams.get('sort') as SortOption | null) ?? 'newest',
      search: searchParams.get('q') ?? undefined,
    }
  }, [searchParams])

  const setFilters = useCallback(
    (patch: Record<string, string | number | boolean | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === '' || value === false) {
              next.delete(key)
            } else {
              next.set(key, String(value))
            }
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearAll = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams])

  const activeCount = [
    filters.category,
    filters.collectionSlug,
    filters.minPriceMinor,
    filters.maxPriceMinor,
    filters.inStockOnly || undefined,
    filters.search,
  ].filter((v) => v !== undefined).length

  return { filters, setFilters, clearAll, activeCount }
}
