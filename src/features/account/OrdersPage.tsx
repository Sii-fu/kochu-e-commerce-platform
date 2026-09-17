import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { getUserOrders } from '@/lib/supabase/queries'
import { formatBDT } from '@/lib/money'
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'

export function OrdersPage() {
  // Not `session!.user.id` -- this mounts its own independent useSession()
  // call, separate from the one <RequireAuth> already resolved, so `session`
  // starts out null here even for an already-signed-in visitor.
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ['user-orders', userId],
    queryFn: () => getUserOrders(userId as string),
    enabled: !!userId,
  })

  if (sessionLoading || isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        icon={<Package />}
        title="No orders yet"
        description="Your past orders will show up here."
        action={
          <Link to="/shop" className="text-primary text-sm font-medium hover:underline">
            Start shopping
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <Link key={order.id} to={`/account/orders/${order.id}`} className="block">
          <Card className="hover:border-primary transition-colors">
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{order.order_number}</p>
                <p className="text-muted-foreground text-sm">
                  {new Date(order.placed_at).toLocaleDateString('en-BD', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{formatBDT(order.total_minor)}</span>
                <OrderStatusBadge status={order.status} />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
