import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useSession } from '@/hooks/useSession'
import { getUserOrderById, getStoreSettings } from '@/lib/supabase/queries'
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { OrderSummaryCard, type SummaryLine } from '@/features/checkout/OrderSummaryCard'
import { MfsPaymentPanel } from '@/features/checkout/MfsPaymentPanel'
import { formatShippingAddress } from '@/features/checkout/shippingAddress'

/**
 * Unlike the guest confirmation page (which can only poll -- anon has no
 * read access to `orders` at all), a signed-in owner's RLS grant
 * (`orders_select_own_or_admin`, 0007_rls.sql) covers Realtime too, so this
 * page subscribes to Postgres Changes and updates the moment an admin
 * approves an MFS payment or advances the order's status.
 */
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  // Not `session!.user.id` -- this mounts its own independent useSession()
  // call, separate from the one <RequireAuth> already resolved, so `session`
  // starts out null here even for an already-signed-in visitor.
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['user-order', userId, id],
    queryFn: () => getUserOrderById(userId as string, id as string),
    enabled: !!id && !!userId,
  })

  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ['user-order', userId, id] }),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, userId, queryClient])

  const { data: settings } = useQuery({
    queryKey: ['store-settings'],
    queryFn: getStoreSettings,
  })

  if (sessionLoading || query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />
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
    <div className="space-y-6">
      <Link
        to="/account/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> My orders
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-medium">{order.order_number}</h2>
          <p className="text-muted-foreground text-sm">
            Placed{' '}
            {new Date(order.placed_at).toLocaleDateString('en-BD', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {(order.tracking_code || order.courier) && (
        <div className="rounded-md border p-4 text-sm">
          <p className="font-medium">Shipment</p>
          {order.courier && <p className="text-muted-foreground">Courier: {order.courier}</p>}
          {order.tracking_code && (
            <p className="text-muted-foreground">Tracking code: {order.tracking_code}</p>
          )}
        </div>
      )}

      {needsPayment && settings && (
        <>
          {payment?.status === 'REJECTED' && (
            <p className="bg-warning/15 text-warning-foreground rounded-md p-3 text-sm">
              Your last payment submission couldn't be verified. Please double-check the details
              and submit again.
            </p>
          )}
          <MfsPaymentPanel
            orderId={order.id}
            token={order.guest_token}
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

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div>
          <h3 className="text-sm font-medium">Delivery details</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {order.customer_name} · {order.phone}
          </p>
          <p className="text-muted-foreground text-sm">
            {formatShippingAddress(order.shipping_address)}
          </p>
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
