import { useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { getOrderByToken } from '@/lib/supabase/rpc'
import { getStoreSettings } from '@/lib/supabase/queries'
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderSummaryCard, type SummaryLine } from './OrderSummaryCard'
import { MfsPaymentPanel } from './MfsPaymentPanel'
import { formatShippingAddress } from './shippingAddress'

const POLL_INTERVAL_MS = 8000

/**
 * The only page an anonymous guest can use to track an order -- reached via
 * the id + secret guest_token pair `create_order()` returns, never a live
 * Realtime subscription. `orders_select_own_or_admin` (0007_rls.sql) gives
 * anon zero rows on this table by design, and Realtime enforces that same
 * RLS, so a guest session cannot subscribe to its own order either. Polling
 * while a payment is outstanding is the honest substitute; the signed-in
 * .../account/orders/:id page is the one that gets a live subscription.
 */
export function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const query = useQuery({
    queryKey: ['order-by-token', id, token],
    queryFn: () => getOrderByToken(id!, token!),
    enabled: !!id && !!token,
    retry: false,
    refetchInterval: (q) => {
      const data = q.state.data
      if (!data) return false
      const awaitingPayment =
        data.order.payment_method !== 'COD' && data.order.status === 'PENDING_PAYMENT'
      return awaitingPayment ? POLL_INTERVAL_MS : false
    },
  })

  const { data: settings } = useQuery({
    queryKey: ['store-settings'],
    queryFn: getStoreSettings,
  })

  if (!id || !token) {
    return (
      <ErrorState
        title="This order link is incomplete"
        description="Use the link from your confirmation page or SMS -- it needs both the order id and its token."
        className="mx-auto max-w-md"
      />
    )
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="We couldn't find that order"
        description="Double check the link, or get in touch if you think this is a mistake."
        onRetry={() => query.refetch()}
        className="mx-auto max-w-md"
      />
    )
  }

  const { order, items, payment } = query.data

  const merchantNumber =
    order.payment_method === 'BKASH'
      ? (settings?.bkash_number ?? null)
      : order.payment_method === 'NAGAD'
        ? (settings?.nagad_number ?? null)
        : null

  const needsPayment =
    order.payment_method !== 'COD' &&
    order.status === 'PENDING_PAYMENT' &&
    order.payment_status !== 'AWAITING_VERIFICATION'

  const summaryLines: SummaryLine[] = items.map((item) => ({
    key: item.id,
    name: item.product_name,
    variantLabel: item.variant_label,
    imagePath: item.image_path,
    quantity: item.quantity,
    unitPriceMinor: item.unit_price_minor,
  }))

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <CheckCircle2 className="text-success mx-auto size-10" aria-hidden />
        <h1 className="font-display mt-3 text-xl font-semibold">Order placed</h1>
        <p className="text-muted-foreground mt-1 text-sm">Order {order.order_number}</p>
        <OrderStatusBadge status={order.status} className="mt-3" />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {needsPayment && settings && (
            <>
              {payment?.status === 'REJECTED' && (
                <p className="bg-warning/15 text-warning-foreground rounded-md p-3 text-sm">
                  Your last payment submission couldn't be verified. Please double-check the
                  details and submit again.
                </p>
              )}
              <MfsPaymentPanel
                orderId={order.id}
                token={token}
                provider={order.payment_method as 'BKASH' | 'NAGAD'}
                amountMinor={order.total_minor}
                merchantNumber={merchantNumber}
                onSubmitted={() => query.refetch()}
              />
            </>
          )}

          {!needsPayment && order.payment_method !== 'COD' && payment?.status === 'SUBMITTED' && (
            <div className="rounded-md border p-4 text-sm">
              <p className="font-medium">Verifying your payment</p>
              <p className="text-muted-foreground mt-1">
                We'll update this page once it's confirmed -- usually within a few hours.
              </p>
            </div>
          )}

          <div>
            <h2 className="text-sm font-medium">Delivery details</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {order.customer_name} · {order.phone}
            </p>
            <p className="text-muted-foreground text-sm">
              {formatShippingAddress(order.shipping_address)}
            </p>
          </div>
        </div>

        <OrderSummaryCard
          lines={summaryLines}
          subtotalMinor={order.subtotal_minor}
          discountMinor={order.discount_minor}
          discountCode={order.discount_code}
          shippingMinor={order.shipping_minor}
          totalMinor={order.total_minor}
        />
      </div>
    </div>
  )
}
