import { useState } from 'react'
import { ProductImage } from '@/components/common/ProductImage'
import { cn } from '@/lib/utils'

type GalleryImage = { path: string; alt: string | null }

export function Gallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return (
      <div className="bg-muted aspect-square rounded-md">
        <ProductImage path={null} alt={productName} className="h-full w-full" />
      </div>
    )
  }

  return (
    <div>
      <div className="bg-muted aspect-square overflow-hidden rounded-md">
        <ProductImage
          path={images[active].path}
          alt={images[active].alt ?? productName}
          className="h-full w-full"
          loading="eager"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.path}
              onClick={() => setActive(i)}
              className={cn(
                'bg-muted tap-target aspect-square w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                i === active ? 'border-primary' : 'border-transparent',
              )}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
            >
              <ProductImage path={img.path} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
