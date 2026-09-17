import { createBrowserRouter } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { RouteError } from '@/components/common/RouteError'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { StubPage } from '@/components/common/StubPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { SignInPage } from '@/features/auth/SignInPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { AccountLayout } from '@/features/account/AccountLayout'
import { AccountOverviewPage } from '@/features/account/AccountOverviewPage'
import { AddressBook } from '@/features/account/AddressBook'
import { ProfileForm } from '@/features/account/ProfileForm'
import { HomePage } from '@/features/home/HomePage'
import { ShopPage } from '@/features/catalog/ShopPage'
import { ProductPage } from '@/features/catalog/ProductPage'
import { CollectionsPage } from '@/features/catalog/CollectionsPage'
import { CollectionDetailPage } from '@/features/catalog/CollectionDetailPage'
import { DropsPage } from '@/features/drops/DropsPage'
import { DropDetailPage } from '@/features/drops/DropDetailPage'
import { EarlyAccessPage } from '@/features/drops/EarlyAccessPage'
import { ArticlesPage } from '@/features/articles/ArticlesPage'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { OrderConfirmationPage } from '@/features/checkout/OrderConfirmationPage'
import { OrdersPage } from '@/features/account/OrdersPage'
import { OrderDetailPage } from '@/features/account/OrderDetailPage'

// Each `stub` is replaced by a real module as its phase lands. The routes
// exist from Phase 2 so navigation, guards and deep links are verifiable
// before the screens behind them are built.
const stub = (title: string, phase: number) => ({
  element: <StubPage title={title} phase={phase} />,
})

export const routes = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },

      // Catalog
      { path: 'shop', element: <ShopPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'collections', element: <CollectionsPage /> },
      { path: 'collections/:slug', element: <CollectionDetailPage /> },

      // Drops
      { path: 'drops', element: <DropsPage /> },
      { path: 'drops/:slug', element: <DropDetailPage /> },
      { path: 'early-access', element: <EarlyAccessPage /> },

      // Editorial
      { path: 'articles', element: <ArticlesPage /> },
      // react-markdown pulls in a large parser tree most visitors never
      // touch -- split out the same way /admin is.
      { path: 'articles/:slug', lazy: () => import('@/features/articles/ArticleReader') },

      // Checkout. The cart is a drawer, not a route.
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'order/:id', element: <OrderConfirmationPage /> },

      // Account. Guarded by <RequireAuth> as a layout route: a signed-out
      // visitor is bounced to /sign-in?next=/account/... and returned here
      // after login.
      {
        path: 'account',
        element: <RequireAuth />,
        children: [
          {
            element: <AccountLayout />,
            children: [
              { index: true, element: <AccountOverviewPage /> },
              { path: 'orders', element: <OrdersPage /> },
              { path: 'orders/:id', element: <OrderDetailPage /> },
              { path: 'addresses', element: <AddressBook /> },
              { path: 'profile', element: <ProfileForm /> },
            ],
          },
        ],
      },

      // Auth
      { path: 'sign-in', element: <SignInPage /> },
      { path: 'sign-up', element: <SignUpPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },

      // Static. These three 404'd in the old app while being linked in the footer.
      { path: 'contact', ...stub('Contact', 7) },
      { path: 'faq', ...stub('FAQ', 7) },
      { path: 'shipping', ...stub('Shipping & returns', 7) },

      // The entire admin tree is a separate chunk, so a storefront visitor
      // never downloads it. <RequireAdmin> lives inside the lazy module
      // itself (src/features/admin/route.tsx) since it has no nested routes
      // here to guard as a layout route.
      { path: 'admin/*', lazy: () => import('@/features/admin/route') },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
