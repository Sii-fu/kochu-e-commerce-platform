import { cn } from '@/lib/utils'

type Variant = {
  id: string
  label: string
  stock: number
  is_active: boolean
}

type VariantPickerProps = {
  variants: Variant[]
  selectedId: string | null
  onSelect: (variantId: string) => void
}

/** Sold-out and inactive variants are shown, not hidden, but disabled and
 * struck through -- a customer should see the size exists, just not right now. */
export function VariantPicker({ variants, selectedId, onSelect }: VariantPickerProps) {
  return (
    <div>
      <h2 className="text-sm font-medium">Size</h2>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
        {variants.map((variant) => {
          const disabled = !variant.is_active || variant.stock <= 0
          const selected = variant.id === selectedId

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSelect(variant.id)}
              className={cn(
                'tap-target min-w-14 rounded-md border px-4 text-sm font-medium transition-colors',
                disabled &&
                  'text-muted-foreground border-border/60 cursor-not-allowed line-through',
                !disabled && selected && 'border-primary bg-primary text-primary-foreground',
                !disabled &&
                  !selected &&
                  'border-border hover:border-primary',
              )}
            >
              {variant.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
