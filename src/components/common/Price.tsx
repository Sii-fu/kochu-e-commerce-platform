import { formatBDT } from '@/lib/money'
import { cn } from '@/lib/utils'

type PriceProps = {
  minor: number
  /** Original price, struck through when higher than `minor`. */
  compareAtMinor?: number | null
  className?: string
}

/**
 * The only place a price becomes a string. Never do arithmetic on the output.
 */
export function Price({ minor, compareAtMinor, className }: PriceProps) {
  const onSale = compareAtMinor != null && compareAtMinor > minor

  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className={cn(onSale && 'text-accent font-semibold')}>{formatBDT(minor)}</span>
      {onSale && (
        <s className="text-muted-foreground text-sm font-normal">{formatBDT(compareAtMinor)}</s>
      )}
    </span>
  )
}
