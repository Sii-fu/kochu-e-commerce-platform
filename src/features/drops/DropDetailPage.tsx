import { useState } from 'react'
import { useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getDropBySlug, getDropProducts } from '@/lib/supabase/queries'
import { redeemDropKey } from '@/lib/supabase/rpc'
import { useSession } from '@/hooks/useSession'
import { ProductGrid } from '@/features/catalog/ProductGrid'
import { ProductImage } from '@/components/common/ProductImage'
import { Countdown } from '@/components/common/Countdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { ErrorState } from '@/components/common/ErrorState'
import { cn } from '@/lib/utils'

export function DropDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { session } = useSession()
  const queryClient = useQueryClient()
  const [accessKey, setAccessKey] = useState('')

  const {
    data: drop,
    isLoading: dropLoading,
    isError: dropError,
  } = useQuery({
    queryKey: ['drop', slug],
    queryFn: () => getDropBySlug(slug!),
    enabled: !!slug,
    retry: false,
  })

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['drop-products', drop?.id],
    queryFn: () => getDropProducts(drop!.id),
    enabled: !!drop?.id,
  })

  const redeemMutation = useMutation({
    mutationFn: () => redeemDropKey(drop!.id, accessKey),
    onSuccess: () => {
      toast.success("You're in. Early access unlocked.")
      setAccessKey('')
      queryClient.invalidateQueries({ queryKey: ['drop-products', drop?.id] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : ''
      toast.error(
        message.includes('INVALID_ACCESS_KEY')
          ? "That key doesn't match this drop."
          : 'Could not redeem that key. Try again.',
      )
    },
  })

  if (dropLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Skeleton className="aspect-[16/9] w-full rounded-md" />
      </div>
    )
  }

  if (dropError || !drop) return <NotFoundPage />

  const now = Date.now()
  const startsAt = new Date(drop.starts_at).getTime()
  const endsAt = drop.ends_at ? new Date(drop.ends_at).getTime() : null
  const isEnded = endsAt != null && endsAt < now
  const isLive = !isEnded && startsAt <= now
  const isUpcoming = !isEnded && !isLive

  return (
    <div>
      <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
        <ProductImage
          bucket="drops"
          path={drop.cover_image}
          alt={drop.title}
          className={cn('h-full w-full', isEnded && 'grayscale')}
          loading="eager"
        />
        {isUpcoming && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
            <Countdown
              target={drop.starts_at}
              className="text-white"
              onComplete={() =>
                queryClient.invalidateQueries({ queryKey: ['drop-products', drop.id] })
              }
            />
          </div>
        )}
        {isEnded && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
            <p className="text-sm text-white/90">This drop has ended</p>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold">{drop.title}</h1>
        {drop.description && (
          <p className="text-muted-foreground mt-2 max-w-prose text-sm">{drop.description}</p>
        )}

        {isUpcoming && drop.access_key && (
          <div className="bg-card mt-6 max-w-md rounded-md border p-4">
            <h2 className="text-sm font-medium">Have an early access key?</h2>
            {!session ? (
              <p className="text-muted-foreground mt-1 text-sm">
                Sign in first to redeem an access key.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (accessKey.trim()) redeemMutation.mutate()
                }}
                className="mt-2 flex gap-2"
              >
                <Input
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder="Access key"
                  className="h-9"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={redeemMutation.isPending || !accessKey.trim()}
                >
                  {redeemMutation.isPending ? 'Checking…' : 'Redeem'}
                </Button>
              </form>
            )}
          </div>
        )}

        <div className="mt-8">
          {productsLoading ? (
            <ProductGrid products={[]} loading />
          ) : !products || products.length === 0 ? (
            <ErrorState
              title={isEnded ? 'This drop has ended' : isLive ? 'Nothing here yet' : 'Not open yet'}
              description={
                isEnded
                  ? 'These pieces are no longer available.'
                  : isLive
                    ? 'Products for this drop are on their way.'
                    : 'Pieces from this drop are hidden until the window opens, or you redeem an early access key above.'
              }
            />
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </div>
    </div>
  )
}
