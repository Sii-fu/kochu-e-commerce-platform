import { Link } from 'react-router'
import type { ProductWithImage } from '@/lib/supabase/queries'
import { ProductImage } from '@/components/common/ProductImage'
import { Price } from '@/components/common/Price'
import { StockBadge } from '@/components/common/StockBadge'

export function ProductCard({ product }: { product: ProductWithImage }) {
  const totalStock = product.variants.reduce(
    (sum, v) => sum + (v.is_active ? v.stock : 0),
    0,
  )

  return (
    <Link to={`/product/${product.slug}`} className="group block">
      <div className="bg-muted relative aspect-[3/4] overflow-hidden rounded-md">
        <ProductImage
          path={product.image_path}
          alt={product.image_alt ?? product.name}
          className="h-full w-full transition-transform duration-300 group-hover:scale-105"
        />
        {totalStock <= 5 && (
          <div className="absolute top-2 left-2">
            <StockBadge stock={totalStock} />
          </div>
        )}
      </div>
      <div className="mt-3 space-y-0.5">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          {product.category}
        </p>
        <h3 className="font-medium">{product.name}</h3>
        <Price minor={product.price_minor} compareAtMinor={product.compare_at_minor} />
      </div>
    </Link>
  )
}
