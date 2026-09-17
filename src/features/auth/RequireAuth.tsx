import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/hooks/useSession'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Gate for /account/*. Bounces a signed-out visitor to /sign-in?next=<here>,
 * and sign-in is responsible for actually returning them to `next` afterward.
 *
 * Used as a layout route (renders its matched children via <Outlet>) when
 * given no `children` prop, or as a direct wrapper around a single element
 * otherwise -- routes.tsx uses the former, the lazy-loaded /admin/* module
 * needs the latter since it has no nested routes of its own.
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { session, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/sign-in?next=${next}`} replace />
  }

  return children ?? <Outlet />
}
