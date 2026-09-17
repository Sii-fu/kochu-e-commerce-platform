import { cn } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'

type OrderStatus = Database['public']['Enums']['order_status']

// Routed through --success/--warning/--info/--destructive tokens -- never a
// raw bg-red-100. See CLAUDE.md's design tokens section.
const STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-warning text-warning-foreground',
  PROCESSING: 'bg-info text-info-foreground',
  SHIPPED: 'bg-info text-info-foreground',
  DELIVERED: 'bg-success text-success-foreground',
  CANCELLED: 'bg-destructive text-destructive-foreground',
}

const LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  )
}
