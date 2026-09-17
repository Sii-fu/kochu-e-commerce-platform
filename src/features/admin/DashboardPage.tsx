import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import { AlertTriangle, Banknote, ShoppingCart, Users } from 'lucide-react'
import { adminDashboardStats } from '@/lib/supabase/rpc'
import { formatBDT } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof Banknote
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
          <Icon className="text-muted-foreground size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// Theme-aware, since recharts' default tooltip is an inline white box that
// breaks in dark mode.
function RevenueTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">
        {new Date(label as string).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}
      </p>
      <p className="mt-0.5 font-medium">{formatBDT(payload[0].value as number)}</p>
      <p className="text-muted-foreground">{payload[0].payload.orders} orders</p>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: () => adminDashboardStats(30),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || !data) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Revenue (30d)" value={formatBDT(data.revenue_period_minor)} icon={Banknote} />
        <StatTile label="Orders (30d)" value={data.orders_period} icon={ShoppingCart} />
        <StatTile
          label="Awaiting verification"
          value={data.awaiting_verification}
          icon={AlertTriangle}
        />
        <StatTile label="Customers" value={data.customers} icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Revenue, last 30 days</CardTitle>
        </CardHeader>
        <CardContent className="h-64 px-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.revenue_series} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} className="stroke-border" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickFormatter={(d: string) =>
                  new Date(d).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })
                }
                className="fill-muted-foreground text-xs"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatBDT(v)}
                className="fill-muted-foreground text-xs"
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue_minor"
                className="stroke-chart-1"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {data.low_stock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Low stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.low_stock.map((item) => (
              <Link
                key={item.variant_id}
                to={`/admin/products/${item.product_id}`}
                className="hover:bg-muted flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  {item.product_name} — {item.variant_label}
                </span>
                <span className="text-warning-foreground bg-warning rounded-full px-2 py-0.5 text-xs font-medium">
                  {item.stock} left
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
