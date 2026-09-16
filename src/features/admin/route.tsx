import { StubPage } from '@/components/common/StubPage'

/**
 * Entry point for the whole /admin tree, reached only through the route-level
 * `lazy()` in routes.tsx. Nothing here is in the storefront bundle.
 *
 * Phase 3 wraps this in <RequireAdmin>; Phase 6 fills it in.
 */
export function Component() {
  return <StubPage title="Admin" phase={6} />
}
