import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getDrops } from '@/lib/supabase/queries'
import { ProductImage } from '@/components/common/ProductImage'
import { Countdown } from '@/components/common/Countdown'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'

export function DropsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['drops'],
    queryFn: getDrops,
  })

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ErrorState onRetry={() => refetch()} />
      </div>
    )
  }

  const hasAny = data && (data.live.length > 0 || data.upcoming.length > 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold">Drops</h1>

      {isLoading ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Skeleton className="aspect-[16/10] w-full rounded-md" />
          <Skeleton className="aspect-[16/10] w-full rounded-md" />
        </div>
      ) : !hasAny ? (
        <EmptyState className="mt-8" title="No drops right now" description="Check back soon." />
      ) : (
        <div className="mt-6 space-y-10">
          {data.live.length > 0 && (
            <section>
              <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                Live now
              </h2>
              <div className="mt-3 grid gap-6 sm:grid-cols-2">
                {data.live.map((drop) => (
                  <Link key={drop.id} to={`/drops/${drop.slug}`} className="group block">
                    <div className="bg-muted relative aspect-[16/10] overflow-hidden rounded-md">
                      <ProductImage
                        bucket="drops"
                        path={drop.cover_image}
                        alt={drop.title}
                        className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <h3 className="font-display mt-3 font-medium">{drop.title}</h3>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.upcoming.length > 0 && (
            <section>
              <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                Upcoming
              </h2>
              <div className="mt-3 grid gap-6 sm:grid-cols-2">
                {data.upcoming.map((drop) => (
                  <Link key={drop.id} to={`/drops/${drop.slug}`} className="group block">
                    <div className="bg-muted relative aspect-[16/10] overflow-hidden rounded-md">
                      <ProductImage
                        bucket="drops"
                        path={drop.cover_image}
                        alt={drop.title}
                        className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <Countdown target={drop.starts_at} className="text-white" />
                      </div>
                    </div>
                    <h3 className="font-display mt-3 font-medium">{drop.title}</h3>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
