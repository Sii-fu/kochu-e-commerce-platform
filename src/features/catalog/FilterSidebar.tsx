import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDistinctCategories } from '@/lib/supabase/queries'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type FilterSidebarProps = {
  category?: string
  minPriceMinor?: number
  maxPriceMinor?: number
  inStockOnly: boolean
  activeCount: number
  onChange: (patch: {
    category?: string
    min?: string
    max?: string
    inStock?: boolean
  }) => void
  onClear: () => void
  className?: string
}

export function FilterSidebar({
  category,
  minPriceMinor,
  maxPriceMinor,
  inStockOnly,
  activeCount,
  onChange,
  onClear,
  className,
}: FilterSidebarProps) {
  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getDistinctCategories,
    staleTime: 5 * 60_000,
  })

  // Local draft for the price inputs so every keystroke doesn't trigger a
  // navigation; committed to the URL on blur/Enter.
  const [minDraft, setMinDraft] = useState(
    minPriceMinor != null ? String(minPriceMinor / 100) : '',
  )
  const [maxDraft, setMaxDraft] = useState(
    maxPriceMinor != null ? String(maxPriceMinor / 100) : '',
  )

  // The URL can change out from under these local drafts -- "Clear all",
  // browser back/forward, or a pasted link with different values -- so they
  // have to re-sync whenever the props do, not just on mount.
  useEffect(() => {
    setMinDraft(minPriceMinor != null ? String(minPriceMinor / 100) : '')
  }, [minPriceMinor])
  useEffect(() => {
    setMaxDraft(maxPriceMinor != null ? String(maxPriceMinor / 100) : '')
  }, [maxPriceMinor])

  const commitPrice = () => onChange({ min: minDraft, max: maxDraft })

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-medium tracking-wide uppercase">Filters</h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-auto p-0 text-xs">
            Clear all
          </Button>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium">Category</h3>
        <div className="mt-2 space-y-1.5">
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </>
          ) : (
            (categories ?? []).map((c) => (
              <button
                key={c}
                onClick={() => onChange({ category: category === c ? undefined : c })}
                className={cn(
                  'block text-left text-sm transition-colors',
                  category === c
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {c}
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Price (৳)</h3>
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => e.key === 'Enter' && commitPrice()}
            className="h-9"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => e.key === 'Enter' && commitPrice()}
            className="h-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="in-stock-only"
          checked={inStockOnly}
          onCheckedChange={(checked) => onChange({ inStock: checked === true })}
        />
        <Label htmlFor="in-stock-only" className="cursor-pointer text-sm font-normal">
          In stock only
        </Label>
      </div>
    </div>
  )
}
