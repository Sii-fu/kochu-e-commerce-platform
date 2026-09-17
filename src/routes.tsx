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
      { index: true, ...stub('Home', 4) },

      // Catalog
      { path: 'shop', ...stub('Shop', 4) },
      { path: 'product/:slug', ...stub('Product', 4) },
      { path: 'collections', ...stub('Collections', 4) },
      { path: 'collections/:slug', ...stub('Collection', 4) },

      // Drops
      { path: 'drops', ...stub('Drops', 4) },
      { path: 'drops/:slug', ...stub('Drop', 4) },
      { path: 'early-access', ...stub('Early access', 4) },

      // Editorial
      { path: 'articles', ...stub('Journal', 4) },
      { path: 'articles/:slug', ...stub('Article', 4) },

      // Checkout. The cart is a drawer, not a route.
      { path: 'checkout', ...stub('Checkout', 5) },
      { path: 'order/:id', ...stub('Order confirmation', 5) },

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
              { path: 'orders', ...stub('My orders', 5) },
              { path: 'orders/:id', ...stub('Order', 5) },
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
