import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getCollectionBySlug, getShopProducts } from '@/lib/supabase/queries'
import { ProductGrid } from './ProductGrid'
import { ProductImage } from '@/components/common/ProductImage'
import { Skeleton } from '@/components/ui/skeleton'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { ErrorState } from '@/components/common/ErrorState'

const PAGE_SIZE = 24

export function CollectionDetailPage() {
  const { slug } = useParams<{ slug: string }>()

  const {
    data: collection,
    isLoading: collectionLoading,
    isError: collectionError,
  } = useQuery({
    queryKey: ['collection', slug],
    queryFn: () => getCollectionBySlug(slug!),
    enabled: !!slug,
    retry: false,
  })

  const { data, isLoading: productsLoading } = useQuery({
    queryKey: ['collection-products', slug],
    queryFn: () =>
      getShopProducts({ collectionSlug: slug!, sort: 'newest', page: 0, pageSize: PAGE_SIZE }),
    enabled: !!slug,
  })

  if (collectionLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    )
  }

  if (collectionError) return <NotFoundPage />
  if (!collection) return <ErrorState />

  return (
    <div>
      {collection.cover_image && (
        <div className="bg-muted h-48 w-full overflow-hidden sm:h-64">
          <ProductImage
            bucket="collections"
            path={collection.cover_image}
            alt={collection.title}
            className="h-full w-full"
            loading="eager"
          />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {collection.season && (
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {collection.season}
          </p>
        )}
        <h1 className="font-display mt-1 text-2xl font-semibold">{collection.title}</h1>
        {collection.description && (
          <p className="text-muted-foreground mt-2 max-w-prose text-sm">
            {collection.description}
          </p>
        )}

        <div className="mt-8">
          <ProductGrid products={data?.products ?? []} loading={productsLoading} />
        </div>
      </div>
    </div>
  )
}
