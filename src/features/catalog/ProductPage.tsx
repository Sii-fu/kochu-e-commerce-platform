import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Minus, Plus, ShoppingBag } from 'lucide-react'
import { getProductBySlug, getRelatedProducts } from '@/lib/supabase/queries'
import { useCart } from '@/store/cart'
import { useUi } from '@/store/ui'
import { Gallery } from './Gallery'
import { VariantPicker } from './VariantPicker'
import { ProductGrid } from './ProductGrid'
import { Price } from '@/components/common/Price'
import { StockBadge } from '@/components/common/StockBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { NotFoundPage } from '@/components/common/NotFoundPage'

const MAX_QUANTITY_PER_LINE = 99

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const addToCart = useCart((s) => s.add)
  const setCartOpen = useUi((s) => s.setCartOpen)

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProductBySlug(slug!),
    enabled: !!slug,
    // A 404 from PostgREST (.single() on no rows) is not worth retrying.
    retry: false,
  })

  const { data: related } = useQuery({
    queryKey: ['related-products', product?.collection_id, product?.id],
    queryFn: () => getRelatedProducts(product!.collection_id!, product!.id),
    enabled: !!product?.collection_id,
  })

  const selectedVariant = useMemo(
    () => product?.product_variants.find((v) => v.id === selectedVariantId) ?? null,
    [product, selectedVariantId],
  )

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-md" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    // getProductBySlug's .single() throws PGRST116 when nothing matches --
    // that's a real 404 (or a product hidden by RLS, which reads the same to
    // an anonymous visitor, deliberately), not a transient failure.
    return <NotFoundPage />
  }

  if (!product) return <ErrorState onRetry={() => refetch()} />

  const totalStock = product.product_variants.reduce(
    (sum, v) => sum + (v.is_active ? v.stock : 0),
    0,
  )

  function handleAddToCart() {
    if (!product) return
    if (!selectedVariant) {
      toast.error('Choose a size first')
      return
    }
    if (selectedVariant.stock < quantity) {
      toast.error(`Only ${selectedVariant.stock} left in this size`)
      return
    }

    addToCart({
      variantId: selectedVariant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantLabel: selectedVariant.label,
      imagePath: product.product_images[0]?.path ?? null,
      unitPriceMinor: product.price_minor + selectedVariant.price_delta_minor,
      quantity,
    })
    toast.success('Added to cart')
    setCartOpen(true)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-10 md:grid-cols-2">
        <Gallery images={product.product_images} productName={product.name} />

        <div>
          {product.collections && (
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              {product.collections.title}
            </p>
          )}
          <h1 className="font-display mt-1 text-2xl font-semibold">{product.name}</h1>

          <div className="mt-3 flex items-center gap-3">
            <Price
              minor={product.price_minor + (selectedVariant?.price_delta_minor ?? 0)}
              compareAtMinor={product.compare_at_minor}
              className="text-lg"
            />
            <StockBadge stock={selectedVariant ? selectedVariant.stock : totalStock} />
          </div>

          {product.description && (
            <p className="text-muted-foreground mt-4 text-sm">{product.description}</p>
          )}

          <div className="mt-6">
            <VariantPicker
              variants={product.product_variants}
              selectedId={selectedVariantId}
              onSelect={setSelectedVariantId}
            />
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-medium">Quantity</h2>
            <div className="mt-2 flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="tap-target"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-8 text-center tabular-nums">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="tap-target"
                onClick={() =>
                  setQuantity((q) =>
                    Math.min(
                      MAX_QUANTITY_PER_LINE,
                      selectedVariant?.stock ?? MAX_QUANTITY_PER_LINE,
                      q + 1,
                    ),
                  )
                }
                disabled={selectedVariant != null && quantity >= selectedVariant.stock}
                aria-label="Increase quantity"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <Button
            size="lg"
            className="tap-target mt-6 w-full"
            onClick={handleAddToCart}
            disabled={totalStock <= 0}
          >
            <ShoppingBag className="size-4" />
            {totalStock <= 0 ? 'Sold out' : 'Add to cart'}
          </Button>

          {product.details && (
            <div className="mt-8 border-t pt-6">
              <h2 className="text-sm font-medium">Details & care</h2>
              <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">
                {product.details}
              </p>
            </div>
          )}
        </div>
      </div>

      {related && related.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-lg font-medium">You may also like</h2>
          <div className="mt-4">
            <ProductGrid products={related} />
          </div>
        </div>
      )}
    </div>
  )
}
