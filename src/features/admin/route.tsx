import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { RequireAdmin } from '@/features/auth/RequireAdmin'
import { AdminLayout } from './AdminLayout'

/**
 * Every screen is its own `React.lazy` chunk, not just a statically-imported
 * module inside this one -- otherwise a visitor bounced straight back out by
 * `<RequireAdmin>` (a customer probing /admin, or this very redirect test)
 * would still have to fetch and evaluate every admin screen's dependencies
 * first, recharts included, since static `import` at the top of this file
 * resolves transitively before `Component` is even callable. Splitting here
 * means the redirect path only needs `<RequireAdmin>` + `<AdminLayout>`.
 */
const DashboardPage = lazy(() => import('./DashboardPage').then((m) => ({ default: m.DashboardPage })))
const OrdersListPage = lazy(() => import('./OrdersListPage').then((m) => ({ default: m.OrdersListPage })))
const OrderDetailPage = lazy(() => import('./OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })))
const MfsQueuePage = lazy(() => import('./MfsQueuePage').then((m) => ({ default: m.MfsQueuePage })))
const ProductsListPage = lazy(() =>
  import('./ProductsListPage').then((m) => ({ default: m.ProductsListPage })),
)
const ProductFormPage = lazy(() => import('./ProductFormPage').then((m) => ({ default: m.ProductFormPage })))
const CollectionsPage = lazy(() => import('./CollectionsPage').then((m) => ({ default: m.CollectionsPage })))
const DropsPage = lazy(() => import('./DropsPage').then((m) => ({ default: m.DropsPage })))
const ArticlesListPage = lazy(() =>
  import('./ArticlesListPage').then((m) => ({ default: m.ArticlesListPage })),
)
const ArticleFormPage = lazy(() => import('./ArticleFormPage').then((m) => ({ default: m.ArticleFormPage })))
const CustomersPage = lazy(() => import('./CustomersPage').then((m) => ({ default: m.CustomersPage })))
const DiscountsPage = lazy(() => import('./DiscountsPage').then((m) => ({ default: m.DiscountsPage })))
const SettingsPage = lazy(() => import('./SettingsPage').then((m) => ({ default: m.SettingsPage })))

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

/**
 * Entry point for the whole /admin tree, reached only through the route-level
 * `lazy()` in routes.tsx -- nothing here is in the storefront bundle.
 *
 * routes.tsx registers a single splat (`admin/*`) rather than a static
 * `children` array, because react-router's `lazy()` cannot itself return
 * `path`/`children` (the router needs the route tree before code-splitting
 * resolves). A descendant <Routes> is the sanctioned way to hand off routing
 * to a lazily-loaded subtree.
 *
 * <RequireAdmin> is a UX convenience -- the real boundary is `is_admin()`
 * re-checked inside every admin RPC and RLS policy regardless of what
 * renders here.
 */
export function Component() {
  return (
    <RequireAdmin>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="orders" element={<OrdersListPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="mfs-queue" element={<MfsQueuePage />} />
            <Route path="products" element={<ProductsListPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id" element={<ProductFormPage />} />
            <Route path="collections" element={<CollectionsPage />} />
            <Route path="drops" element={<DropsPage />} />
            <Route path="articles" element={<ArticlesListPage />} />
            <Route path="articles/new" element={<ArticleFormPage />} />
            <Route path="articles/:id" element={<ArticleFormPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="discounts" element={<DiscountsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
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
