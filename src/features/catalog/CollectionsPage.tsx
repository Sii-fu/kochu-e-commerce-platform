import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getCollections } from '@/lib/supabase/queries'
import { ProductImage } from '@/components/common/ProductImage'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'

export function CollectionsPage() {
  const { data: collections, isLoading, isError, refetch } = useQuery({
    queryKey: ['collections'],
    queryFn: getCollections,
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold">Collections</h1>

      {isError ? (
        <ErrorState onRetry={() => refetch()} className="mt-8" />
      ) : isLoading ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-md" />
          ))}
        </div>
      ) : !collections || collections.length === 0 ? (
        <EmptyState className="mt-8" title="No collections yet" />
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link key={c.id} to={`/collections/${c.slug}`} className="group block">
              <div className="bg-muted aspect-[4/5] overflow-hidden rounded-md">
                <ProductImage
                  bucket="collections"
                  path={c.cover_image}
                  alt={c.title}
                  className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="mt-3">
                {c.season && (
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    {c.season}
                  </p>
                )}
                <h2 className="font-display font-medium">{c.title}</h2>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
