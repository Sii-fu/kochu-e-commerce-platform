import { Link, useNavigate } from 'react-router'
import { Minus, Plus, ShoppingBag, TriangleAlert, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/common/ProductImage'
import { Price } from '@/components/common/Price'
import { EmptyState } from '@/components/common/EmptyState'
import { formatBDT } from '@/lib/money'
import { useCart, selectSubtotalMinor } from '@/store/cart'
import { useUi } from '@/store/ui'
import { useCartValidation, type CartIssue } from './useCartValidation'

function issueMessage(issue: CartIssue): string {
  switch (issue.type) {
    case 'unavailable':
      return 'No longer available'
    case 'out-of-stock':
      return 'Now sold out'
    case 'low-stock':
      return `Only ${issue.available} left`
    case 'price-changed':
      return `Price updated to ${formatBDT(issue.newUnitPriceMinor)}`
  }
}

/**
 * The cart is a drawer openable from anywhere, not a page -- the old app's
 * `/cart` route re-fetched the catalog to resolve line items, which is
 * exactly the stale-cart bug this store's display snapshot exists to avoid.
 * `useCartValidation()` re-checks that snapshot against the live catalog
 * every time the drawer opens and flags drift inline instead of failing
 * silently at checkout.
 */
export function CartDrawer() {
  const cartOpen = useUi((s) => s.cartOpen)
  const setCartOpen = useUi((s) => s.setCartOpen)
  const lines = useCart((s) => s.lines)
  const subtotalMinor = useCart(selectSubtotalMinor)
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)
  const navigate = useNavigate()
  const { issues, hasBlockingIssues } = useCartValidation()

  function goToCheckout() {
    setCartOpen(false)
    navigate('/checkout')
  }

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your bag {lines.length > 0 && `(${lines.length})`}</SheetTitle>
        </SheetHeader>

        {lines.length === 0 ? (
          <EmptyState
            className="flex-1"
            icon={<ShoppingBag />}
            title="Your bag is empty"
            description="Find something you'll want to wear."
            action={
              <Button asChild onClick={() => setCartOpen(false)}>
                <Link to="/shop">Shop now</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-4">
              {lines.map((line) => {
                const issue = issues.get(line.variantId)
                return (
                  <div key={line.variantId} className="flex gap-3">
                    <ProductImage
                      path={line.imagePath}
                      alt={line.name}
                      className="size-20 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/product/${line.slug}`}
                            onClick={() => setCartOpen(false)}
                            className="hover:text-primary truncate text-sm font-medium"
                          >
                            {line.name}
                          </Link>
                          <p className="text-muted-foreground text-xs">{line.variantLabel}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(line.variantId)}
                          aria-label={`Remove ${line.name} from bag`}
                          className="tap-target text-muted-foreground hover:text-foreground -m-2 shrink-0 p-2"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="tap-target size-7"
                            onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-6 text-center text-sm tabular-nums">
                            {line.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="tap-target size-7"
                            onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                        <Price minor={line.unitPriceMinor * line.quantity} className="text-sm" />
                      </div>

                      {issue && (
                        <p className="text-accent-foreground mt-2 flex items-center gap-1 text-xs">
                          <TriangleAlert className="size-3" />
                          {issueMessage(issue)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <SheetFooter className="border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatBDT(subtotalMinor)}</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Shipping and any discount are calculated at checkout.
              </p>
              {hasBlockingIssues && (
                <p className="text-destructive text-xs">
                  Remove the unavailable item{lines.length > 1 ? 's' : ''} above to check out.
                </p>
              )}
              <Button
                size="lg"
                className="tap-target w-full"
                onClick={goToCheckout}
                disabled={hasBlockingIssues}
              >
                Checkout
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
