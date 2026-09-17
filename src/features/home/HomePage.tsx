import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getDrops, getFeaturedProducts } from '@/lib/supabase/queries'
import { ProductGrid } from '@/features/catalog/ProductGrid'
import { ProductImage } from '@/components/common/ProductImage'
import { Countdown } from '@/components/common/Countdown'
import { Button } from '@/components/ui/button'

export function HomePage() {
  const { data: featured, isLoading: featuredLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => getFeaturedProducts(4),
  })

  const { data: drops } = useQuery({
    queryKey: ['drops'],
    queryFn: getDrops,
  })

  const highlightDrop = drops?.live[0] ?? drops?.upcoming[0]

  return (
    <div>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="text-xs tracking-[0.3em] uppercase opacity-80">Dhaka, Bangladesh</p>
          <h1 className="font-display mt-4 text-4xl font-semibold sm:text-5xl">
            Considered clothing
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm opacity-90 sm:text-base">
            Small runs, honest fabrics, made close to home.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="tap-target mt-8"
          >
            <Link to="/shop">Shop the collection</Link>
          </Button>
        </div>
      </section>

      {highlightDrop && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <Link
            to={`/drops/${highlightDrop.slug}`}
            className="group bg-muted relative block aspect-[16/9] overflow-hidden rounded-md sm:aspect-[21/9]"
          >
            <ProductImage
              bucket="drops"
              path={highlightDrop.cover_image}
              alt={highlightDrop.title}
              className="h-full w-full transition-transform duration-300 group-hover:scale-105"
              loading="eager"
            />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-6 sm:p-8">
              <p className="text-xs tracking-[0.2em] text-white/80 uppercase">
                {drops?.live.includes(highlightDrop) ? 'Live now' : 'Coming soon'}
              </p>
              <h2 className="font-display mt-1 text-2xl font-semibold text-white sm:text-3xl">
                {highlightDrop.title}
              </h2>
              {!drops?.live.includes(highlightDrop) && (
                <Countdown target={highlightDrop.starts_at} className="mt-3 text-white" />
              )}
            </div>
          </Link>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Featured</h2>
          <Link to="/shop" className="text-primary text-sm underline underline-offset-4">
            View all
          </Link>
        </div>
        <div className="mt-6">
          <ProductGrid
            products={featured ?? []}
            loading={featuredLoading}
            emptyTitle="Nothing featured right now"
            emptyDescription="Check the full shop for everything in stock."
          />
        </div>
      </section>

      <section className="bg-card border-t">
        <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6">
          <h2 className="font-display text-xl font-semibold">Read the journal</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            Notes on materials, process, and the people who make each piece.
          </p>
          <Button asChild variant="outline" className="tap-target mt-6">
            <Link to="/articles">Visit the journal</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
