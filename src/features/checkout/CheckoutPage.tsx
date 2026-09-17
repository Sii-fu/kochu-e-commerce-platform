import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LogIn, Loader2, ShoppingBag, TriangleAlert, User as UserIcon } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useProfile } from '@/hooks/useProfile'
import { useCart, selectSubtotalMinor } from '@/store/cart'
import { useCartValidation } from '@/features/cart/useCartValidation'
import { getAddresses } from '@/lib/supabase/queries'
import { createOrder, shippingFor, validateDiscount } from '@/lib/supabase/rpc'
import { checkoutErrorMessage } from '@/lib/errors'
import { deliverySchema, type DeliveryInput } from '@/lib/validation/checkout'
import { OrderSummaryCard, type SummaryLine } from './OrderSummaryCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'

const PAYMENT_METHODS = [
  { value: 'COD', label: 'Cash on delivery', description: 'Pay when your order arrives.' },
  { value: 'BKASH', label: 'bKash', description: "Send payment, then submit the TrxID." },
  { value: 'NAGAD', label: 'Nagad', description: "Send payment, then submit the TrxID." },
] as const

/**
 * Guest-first: the choice between checking out as a guest or signing in is
 * offered up front, before any typing -- never a sign-in wall sprung on a
 * customer after they've already filled in delivery details.
 */
function CheckoutAuthChoice({ onGuest }: { onGuest: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      <h1 className="font-display text-xl font-semibold">Checkout</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Sign in to check out faster next time, or continue as a guest -- both let you track your
        order.
      </p>

      <div className="mt-8 grid gap-3">
        <Card>
          <CardContent className="flex items-center gap-4 text-left">
            <UserIcon className="text-muted-foreground size-6 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Continue as guest</p>
              <p className="text-muted-foreground text-sm">Fastest way to check out.</p>
            </div>
            <Button onClick={onGuest}>Continue</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 text-left">
            <LogIn className="text-muted-foreground size-6 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Sign in</p>
              <p className="text-muted-foreground text-sm">Use a saved address, faster next time.</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/sign-in?next=/checkout">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const { session, loading: sessionLoading } = useSession()
  const { profile } = useProfile()
  const lines = useCart((s) => s.lines)
  const subtotalMinor = useCart(selectSubtotalMinor)
  const clearCart = useCart((s) => s.clear)
  const { issues, hasBlockingIssues } = useCartValidation()

  const [authChoice, setAuthChoice] = useState<'guest' | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new' | null>(null)
  const [discountInput, setDiscountInput] = useState('')
  const [discount, setDiscount] = useState<{ code: string; discountMinor: number } | null>(null)
  const [discountError, setDiscountError] = useState<string | null>(null)

  // Generated once per checkout attempt, not per render -- this is what
  // makes a double-clicked "Place order" resolve to one order instead of two.
  const idempotencyKey = useRef(crypto.randomUUID())

  const userId = session?.user.id

  const { data: addresses } = useQuery({
    queryKey: ['addresses', userId],
    queryFn: () => getAddresses(userId!),
    enabled: !!userId,
  })

  useEffect(() => {
    if (!addresses || selectedAddressId !== null) return
    setSelectedAddressId(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? 'new')
  }, [addresses, selectedAddressId])

  const form = useForm<DeliveryInput>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      customerName: '',
      phone: '',
      email: '',
      line1: '',
      line2: '',
      city: '',
      district: '',
      postalCode: '',
      paymentMethod: 'COD',
    },
  })

  // Prefill from the signed-in profile once it loads.
  useEffect(() => {
    if (!profile) return
    if (profile.full_name) form.setValue('customerName', profile.full_name)
    if (profile.phone) form.setValue('phone', profile.phone)
    if (profile.email) form.setValue('email', profile.email)
  }, [profile, form])

  // Prefill from whichever saved address is selected.
  useEffect(() => {
    if (!addresses || !selectedAddressId || selectedAddressId === 'new') return
    const address = addresses.find((a) => a.id === selectedAddressId)
    if (!address) return
    form.setValue('customerName', address.recipient)
    form.setValue('phone', address.phone)
    form.setValue('line1', address.line1)
    form.setValue('line2', address.line2 ?? '')
    form.setValue('city', address.city)
    form.setValue('district', address.district ?? '')
    form.setValue('postalCode', address.postal_code ?? '')
  }, [selectedAddressId, addresses, form])

  const discountedSubtotal = Math.max(0, subtotalMinor - (discount?.discountMinor ?? 0))

  const { data: shippingMinor } = useQuery({
    queryKey: ['shipping-preview', discountedSubtotal],
    queryFn: () => shippingFor(discountedSubtotal),
    enabled: lines.length > 0,
  })

  const totalMinor = shippingMinor == null ? null : discountedSubtotal + shippingMinor

  const summaryLines: SummaryLine[] = useMemo(
    () =>
      lines.map((l) => ({
        key: l.variantId,
        name: l.name,
        variantLabel: l.variantLabel,
        imagePath: l.imagePath,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
      })),
    [lines],
  )

  const applyDiscount = useMutation({
    mutationFn: () => validateDiscount(discountInput, subtotalMinor),
    onSuccess: (result) => {
      if (!result.valid) {
        setDiscount(null)
        setDiscountError(result.message ?? 'That code is not valid.')
        return
      }
      setDiscountError(null)
      setDiscount({ code: result.code!, discountMinor: result.discount_minor ?? 0 })
      toast.success('Discount applied')
    },
    onError: () => {
      setDiscount(null)
      setDiscountError('Could not check that code. Try again.')
    },
  })

  const placeOrder = useMutation({
    mutationFn: (values: DeliveryInput) =>
      createOrder({
        idempotency_key: idempotencyKey.current,
        payment_method: values.paymentMethod,
        customer_name: values.customerName,
        phone: values.phone,
        email: values.email || undefined,
        shipping_address: {
          line1: values.line1,
          line2: values.line2 || null,
          city: values.city,
          district: values.district || null,
          postal_code: values.postalCode || null,
        },
        discount_code: discount?.code,
        items: lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
      }),
    onSuccess: (result) => {
      clearCart()
      toast.success('Order placed')
      navigate(`/order/${result.order_id}?token=${result.guest_token}`)
    },
    onError: (error) => toast.error(checkoutErrorMessage(error)),
  })

  if (lines.length === 0) {
    return (
      <EmptyState
        className="mx-auto max-w-md"
        icon={<ShoppingBag />}
        title="Your bag is empty"
        description="Add something to your bag before checking out."
        action={
          <Button asChild>
            <Link to="/shop">Shop now</Link>
          </Button>
        }
      />
    )
  }

  if (!sessionLoading && !session && authChoice === null) {
    return <CheckoutAuthChoice onGuest={() => setAuthChoice('guest')} />
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-xl font-semibold">Checkout</h1>

      {hasBlockingIssues && (
        <div className="bg-destructive/10 text-destructive mt-4 flex items-center gap-2 rounded-md p-3 text-sm">
          <TriangleAlert className="size-4 shrink-0" />
          Some items in your bag are no longer available. Open your bag to remove them before
          checking out.
        </div>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_360px]">
        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit((values) => placeOrder.mutate(values))}
          >
            {!!addresses?.length && (
              <div>
                <h2 className="text-sm font-medium">Delivery address</h2>
                <RadioGroup
                  value={selectedAddressId ?? undefined}
                  onValueChange={(value) => setSelectedAddressId(value)}
                  className="mt-2"
                >
                  {addresses.map((address) => (
                    <label
                      key={address.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
                    >
                      <RadioGroupItem value={address.id} className="mt-0.5" />
                      <span>
                        <span className="font-medium">{address.label || address.recipient}</span>
                        <span className="text-muted-foreground block">
                          {address.line1}, {address.city}
                        </span>
                      </span>
                    </label>
                  ))}
                  <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm">
                    <RadioGroupItem value="new" />
                    Use a new address
                  </label>
                </RadioGroup>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-sm font-medium">Delivery details</h2>

              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" autoComplete="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="line1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input autoComplete="address-line1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="line2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apartment, suite, etc. (optional)</FormLabel>
                    <FormControl>
                      <Input autoComplete="address-line2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input autoComplete="address-level2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal code (optional)</FormLabel>
                      <FormControl>
                        <Input autoComplete="postal-code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="discount-code">Discount code</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="discount-code"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="Enter a code"
                  className="max-w-48"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!discountInput.trim() || applyDiscount.isPending}
                  onClick={() => applyDiscount.mutate()}
                >
                  Apply
                </Button>
              </div>
              {discountError && <p className="text-destructive mt-1 text-sm">{discountError}</p>}
              {discount && (
                <p className="text-accent-foreground mt-1 text-sm">
                  {discount.code} applied
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment method</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="mt-2">
                      {PAYMENT_METHODS.map((method) => (
                        <label
                          key={method.value}
                          className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
                        >
                          <RadioGroupItem value={method.value} className="mt-0.5" />
                          <span>
                            <span className="font-medium">{method.label}</span>
                            <span className="text-muted-foreground block">
                              {method.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              size="lg"
              className="tap-target w-full"
              disabled={hasBlockingIssues || placeOrder.isPending}
            >
              {placeOrder.isPending && <Loader2 className="size-4 animate-spin" />}
              {placeOrder.isPending ? 'Placing order…' : 'Place order'}
            </Button>
          </form>
        </Form>

        <div>
          <OrderSummaryCard
            lines={summaryLines}
            subtotalMinor={subtotalMinor}
            discountMinor={discount?.discountMinor ?? 0}
            discountCode={discount?.code}
            shippingMinor={shippingMinor ?? null}
            totalMinor={totalMinor}
          />
          {[...issues.values()].length > 0 && (
            <p className="text-muted-foreground mt-3 text-xs">
              Some items changed since you added them to your bag -- check your bag before placing
              the order.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
