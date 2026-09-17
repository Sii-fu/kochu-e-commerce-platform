import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { getShopProducts } from '@/lib/supabase/queries'
import { useShopFilters } from './useShopFilters'
import { useDebounce } from '@/hooks/useDebounce'
import { ProductGrid } from './ProductGrid'
import { FilterSidebar } from './FilterSidebar'
import { SortSelect } from './SortSelect'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ErrorState } from '@/components/common/ErrorState'

const PAGE_SIZE = 12

export function ShopPage() {
  const { filters, setFilters, clearAll, activeCount } = useShopFilters()
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '')
  const debouncedSearch = useDebounce(searchDraft, 350)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // The URL is the source of truth; this only pushes the debounced value up
  // to it, and re-syncs the draft if the URL changes from elsewhere (Clear
  // all, back/forward navigation).
  useEffect(() => {
    if (debouncedSearch !== (filters.search ?? '')) {
      setFilters({ q: debouncedSearch || undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fire on the debounced value changing, not on every filters.search identity change
  }, [debouncedSearch])
  useEffect(() => {
    setSearchDraft(filters.search ?? '')
  }, [filters.search])

  const query = useInfiniteQuery({
    queryKey: ['shop-products', filters],
    queryFn: ({ pageParam }) =>
      getShopProducts({ ...filters, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.products.length, 0)
      return loaded < lastPage.total ? allPages.length : undefined
    },
  })

  const products = query.data?.pages.flatMap((p) => p.products) ?? []
  const total = query.data?.pages[0]?.total ?? 0

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage()
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depending on the whole `query` object (a fresh reference every render) would tear down and recreate the observer on every render; the three fields read inside are exactly what's listed
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage])

  const filterProps = {
    category: filters.category,
    minPriceMinor: filters.minPriceMinor,
    maxPriceMinor: filters.maxPriceMinor,
    inStockOnly: filters.inStockOnly,
    activeCount,
    onChange: setFilters,
    onClear: clearAll,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Shop</h1>
          {!query.isLoading && (
            <p className="text-muted-foreground mt-1 text-sm">{total} pieces</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search products…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="w-40 sm:w-56"
          />
          <SortSelect value={filters.sort} onChange={(sort) => setFilters({ sort })} />
          <Button
            variant="outline"
            size="icon"
            className="tap-target relative lg:hidden"
            onClick={() => setMobileFiltersOpen(true)}
            aria-label="Filters"
          >
            <SlidersHorizontal className="size-4" />
            {activeCount > 0 && (
              <Badge className="bg-accent text-accent-foreground absolute -top-1.5 -right-1.5 size-4 justify-center rounded-full p-0 text-[10px]">
                {activeCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_1fr]">
        <FilterSidebar {...filterProps} className="hidden lg:block" />

        <div>
          {query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : (
            <>
              <ProductGrid products={products} loading={query.isLoading} />
              <div ref={loadMoreRef} className="h-1" />
              {query.isFetchingNextPage && (
                <p className="text-muted-foreground py-6 text-center text-sm">Loading more…</p>
              )}
            </>
          )}
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FilterSidebar {...filterProps} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
