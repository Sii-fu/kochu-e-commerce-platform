import { ProductImage } from '@/components/common/ProductImage'
import { Price } from '@/components/common/Price'
import { formatBDT } from '@/lib/money'

export type SummaryLine = {
  key: string
  name: string
  variantLabel: string
  imagePath: string | null
  quantity: number
  unitPriceMinor: number
}

type OrderSummaryCardProps = {
  lines: SummaryLine[]
  subtotalMinor: number
  discountMinor: number
  discountCode?: string | null
  shippingMinor: number | null
  totalMinor: number | null
}

/**
 * The read-only order summary shown on both checkout and the confirmation
 * page. Every total shown here is a preview -- `create_order()` is what
 * actually re-derives these numbers from the database, so this component
 * never does anything with them beyond display.
 */
export function OrderSummaryCard({
  lines,
  subtotalMinor,
  discountMinor,
  discountCode,
  shippingMinor,
  totalMinor,
}: OrderSummaryCardProps) {
  return (
    <div className="rounded-md border p-4">
      <div className="space-y-3">
        {lines.map((line) => (
          <div key={line.key} className="flex gap-3">
            <div className="relative shrink-0">
              <ProductImage path={line.imagePath} alt={line.name} className="size-14 rounded-md" />
              <span className="bg-foreground text-background absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full text-[10px] font-medium">
                {line.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{line.name}</p>
              <p className="text-muted-foreground text-xs">{line.variantLabel}</p>
            </div>
            <Price minor={line.unitPriceMinor * line.quantity} className="text-sm" />
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1.5 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatBDT(subtotalMinor)}</span>
        </div>
        {discountMinor > 0 && (
          <div className="text-accent-foreground flex justify-between">
            <span>Discount{discountCode ? ` (${discountCode})` : ''}</span>
            <span>-{formatBDT(discountMinor)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shipping</span>
          <span>{shippingMinor == null ? '—' : shippingMinor === 0 ? 'Free' : formatBDT(shippingMinor)}</span>
        </div>
        <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
          <span>Total</span>
          <span>{totalMinor == null ? '—' : formatBDT(totalMinor)}</span>
        </div>
      </div>
    </div>
  )
}
