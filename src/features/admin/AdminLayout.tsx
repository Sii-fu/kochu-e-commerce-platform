import { Link, NavLink, Outlet } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Package,
  Settings,
  Ticket,
  Users,
  Layers,
  ShoppingCart,
  Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/mfs-queue', label: 'Payment queue', icon: Banknote },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/collections', label: 'Collections', icon: Layers },
  { to: '/admin/drops', label: 'Drops', icon: Zap },
  { to: '/admin/articles', label: 'Articles', icon: Newspaper },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/discounts', label: 'Discounts', icon: Ticket },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </>
  )
}

/**
 * The whole /admin tree's chrome. `<RequireAdmin>` in route.tsx is the only
 * thing standing between a customer and this component -- the real boundary
 * is `is_admin()` re-checked inside every admin RPC and RLS policy
 * regardless of what renders here.
 */
export function AdminLayout() {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-56 shrink-0 flex-col border-r px-3 py-6 md:flex">
        <Link to="/admin" className="font-display px-3 text-lg font-semibold tracking-[0.2em] uppercase">
          Kochu
        </Link>
        <p className="text-muted-foreground px-3 text-xs">Admin</p>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          <NavItems />
        </nav>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => supabase.auth.signOut()}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-2 md:hidden">
          <NavItems />
        </div>
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
