import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/hooks/useSession'
import { useProfile } from '@/hooks/useProfile'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Gate for /admin/*. `role` is read from `profiles` -- checked in the
 * database, never an env allowlist or a client-side email comparison, and
 * `profiles.role` is pinned against self-promotion by a DB trigger. This
 * component is a UX convenience, not the security boundary: every admin RPC
 * re-checks `is_admin()` server-side regardless of what this renders.
 *
 * A signed-out visitor and a signed-in non-admin both land on /sign-in with
 * the same `?next=`, so a customer probing /admin learns nothing about
 * whether the block is "not signed in" vs "not an admin".
 *
 * Accepts an optional `children` for use as a direct wrapper (the lazy-loaded
 * /admin/* module has no nested routes of its own); falls back to <Outlet>
 * when used as a layout route.
 */
export function RequireAdmin({ children }: { children?: ReactNode }) {
  const { session, loading: sessionLoading } = useSession()
  const { profile, isLoading: profileLoading } = useProfile()
  const location = useLocation()

  if (sessionLoading || profileLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!session || profile?.role !== 'admin') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/sign-in?next=${next}`} replace />
  }

  return children ?? <Outlet />
}
