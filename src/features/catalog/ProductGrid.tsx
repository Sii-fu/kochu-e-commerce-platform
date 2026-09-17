import type { ProductWithImage } from '@/lib/supabase/queries'
import { ProductCard } from './ProductCard'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'

type ProductGridProps = {
  products: ProductWithImage[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

/**
 * Purely presentational -- headings and filters are composed by the page,
 * never baked into the grid. The old ShopGrid was reused inside a collection
 * page and dragged its own "KOCHU Shop" heading and category filter along
 * with it, producing a second heading directly under the collection's own.
 */
export function ProductGrid({
  products,
  loading,
  emptyTitle = 'No products found',
  emptyDescription = 'Try a different filter or check back soon.',
}: ProductGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[3/4] w-full rounded-md" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} className="py-20" />
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
