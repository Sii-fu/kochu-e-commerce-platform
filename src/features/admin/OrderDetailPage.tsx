import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { getAdminOrderById } from '@/lib/supabase/admin/queries'
import { adminUpdateOrderStatus } from '@/lib/supabase/rpc'
import { adminErrorMessage } from '@/lib/errors'
import { formatBDT } from '@/lib/money'
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge'
import { OrderSummaryCard, type SummaryLine } from '@/features/checkout/OrderSummaryCard'
import { formatShippingAddress } from '@/features/checkout/shippingAddress'
import { ReceiptLink } from './ReceiptLink'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Database } from '@/lib/supabase/types'

type OrderStatus = Database['public']['Enums']['order_status']

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

const STATUS_COPY: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Move back to pending payment.',
  PROCESSING: 'Marks the order as being prepared for shipment.',
  SHIPPED: 'Add a tracking code and courier below, then confirm.',
  DELIVERED: 'Marks the order as delivered.',
  CANCELLED: 'Restores stock for every item (once only) and refunds a paid order’s payment status.',
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => getAdminOrderById(id as string),
    enabled: !!id,
  })

  const [transitioningTo, setTransitioningTo] = useState<OrderStatus | null>(null)
  const [note, setNote] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [courier, setCourier] = useState('')

  const updateStatus = useMutation({
    mutationFn: (next: OrderStatus) =>
      adminUpdateOrderStatus({
        orderId: id as string,
        next,
        note: note || undefined,
        trackingCode: trackingCode || undefined,
        courier: courier || undefined,
      }),
    onSuccess: () => {
      toast.success('Order updated')
      setTransitioningTo(null)
      setNote('')
      setTrackingCode('')
      setCourier('')
      queryClient.invalidateQueries({ queryKey: ['admin-order', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
    },
    onError: (error) => toast.error(adminErrorMessage(error)),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || !order) return <ErrorState onRetry={() => refetch()} />

  const summaryLines: SummaryLine[] = order.order_items.map((item) => ({
    key: item.id,
    name: item.product_name,
    variantLabel: item.variant_label,
    imagePath: item.image_path,
    quantity: item.quantity,
    unitPriceMinor: item.unit_price_minor,
  }))

  const availableNext = NEXT_STATUSES[order.status]

  return (
    <div className="space-y-6">
      <Link
        to="/admin/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">{order.order_number}</h1>
          <p className="text-muted-foreground text-sm">
            Placed{' '}
            {new Date(order.placed_at).toLocaleString('en-BD', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{order.payment_method}</Badge>
          <Badge variant="outline">{order.payment_status}</Badge>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {availableNext.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableNext.map((next) => (
            <Button
              key={next}
              size="sm"
              variant={next === 'CANCELLED' ? 'outline' : 'default'}
              onClick={() => setTransitioningTo(next)}
            >
              Mark as {next.toLowerCase()}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-medium">Delivery details</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {order.customer_name} · {order.phone}
            </p>
            <p className="text-muted-foreground text-sm">
              {order.guest_email ?? (order.user_id ? 'Registered customer' : 'Guest checkout')}
            </p>
            <p className="text-muted-foreground text-sm">
              {formatShippingAddress(order.shipping_address)}
            </p>
          </div>

          {(order.tracking_code || order.courier) && (
            <div>
              <h2 className="text-sm font-medium">Shipment</h2>
              {order.courier && <p className="text-muted-foreground text-sm">Courier: {order.courier}</p>}
              {order.tracking_code && (
                <p className="text-muted-foreground text-sm">Tracking: {order.tracking_code}</p>
              )}
            </div>
          )}

          {order.admin_note && (
            <div>
              <h2 className="text-sm font-medium">Admin note</h2>
              <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">{order.admin_note}</p>
            </div>
          )}

          {order.mfs_transactions.length > 0 && (
            <div>
              <h2 className="text-sm font-medium">Payment history</h2>
              <div className="mt-2 space-y-2">
                {order.mfs_transactions.map((tx) => (
                  <div key={tx.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{tx.trx_id}</span>
                      <Badge
                        variant={
                          tx.status === 'VERIFIED'
                            ? 'default'
                            : tx.status === 'REJECTED'
                              ? 'destructive'
                              : 'outline'
                        }
                      >
                        {tx.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      {tx.sender_msisdn} · {formatBDT(tx.amount_minor)} ·{' '}
                      {new Date(tx.created_at).toLocaleDateString('en-BD')}
                    </p>
                    {tx.review_note && (
                      <p className="text-muted-foreground mt-1 italic">"{tx.review_note}"</p>
                    )}
                    <div className="mt-1">
                      <ReceiptLink path={tx.receipt_path} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      <AlertDialog open={transitioningTo !== null} onOpenChange={(open) => !open && setTransitioningTo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {order.order_number} as {transitioningTo?.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {transitioningTo && STATUS_COPY[transitioningTo]}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {transitioningTo === 'SHIPPED' && (
            <div className="space-y-3">
              <Input
                placeholder="Tracking code"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
              <Input placeholder="Courier" value={courier} onChange={(e) => setCourier(e.target.value)} />
            </div>
          )}

          <Textarea
            placeholder="Internal note (optional, never shown to the customer)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateStatus.isPending}
              onClick={() => transitioningTo && updateStatus.mutate(transitioningTo)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
