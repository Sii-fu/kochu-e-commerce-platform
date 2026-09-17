import { Skeleton } from '@/components/ui/skeleton'
import { StubPage } from '@/components/common/StubPage'
import { RequireAdmin } from '@/features/auth/RequireAdmin'

/**
 * Entry point for the whole /admin tree, reached only through the route-level
 * `lazy()` in routes.tsx. Nothing here is in the storefront bundle.
 *
 * <RequireAdmin> is a UX convenience -- the real boundary is `is_admin()`
 * re-checked inside every admin RPC. Phase 6 fills in the actual panel.
 */
export function Component() {
  return (
    <RequireAdmin>
      <StubPage title="Admin" phase={6} />
    </RequireAdmin>
  )
}

// Shown while this chunk downloads, so a slow connection sees a skeleton
// instead of a blank page during the gap.
export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-12 sm:px-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
