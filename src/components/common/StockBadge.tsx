import { cn } from '@/lib/utils'

type StockBadgeProps = {
  stock: number
  className?: string
}

const LOW_STOCK_THRESHOLD = 5

/** Routes through --accent/--destructive tokens; never a raw bg-red-100. */
export function StockBadge({ stock, className }: StockBadgeProps) {
  if (stock <= 0) {
    return (
      <span
        className={cn(
          'bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium',
          className,
        )}
      >
        Sold out
      </span>
    )
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
    return (
      <span
        className={cn(
          'bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-medium',
          className,
        )}
      >
        Only {stock} left
      </span>
    )
  }

  return null
}
