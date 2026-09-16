import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type ProductImageProps = {
  /** Storage object path, e.g. `products/<id>/main.webp`. */
  path?: string | null
  alt: string
  className?: string
  /** Bucket the path lives in. Catalog buckets are all public-read. */
  bucket?: 'products' | 'collections' | 'articles' | 'drops'
  loading?: 'lazy' | 'eager'
}

/**
 * Renders a storage image with a branded fallback.
 *
 * The old app pointed 7 different files at a `/placeholder.png` that did not
 * exist, so every missing image was a broken-image icon. There is no magic
 * path here: a missing or failed image renders the wordmark instead.
 */
export function ProductImage({
  path,
  alt,
  className,
  bucket = 'products',
  loading = 'lazy',
}: ProductImageProps) {
  const [failed, setFailed] = useState(false)

  const src = path
    ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
    : null

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          'bg-muted text-muted-foreground flex items-center justify-center select-none',
          className,
        )}
      >
        <span className="font-display text-xs tracking-[0.3em] uppercase opacity-60">
          Kochu
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  )
}
