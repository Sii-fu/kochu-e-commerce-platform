import { createBrowserRouter } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { RouteError } from '@/components/common/RouteError'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { StubPage } from '@/components/common/StubPage'

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

      // Account
      { path: 'account', ...stub('Account', 3) },
      { path: 'account/orders', ...stub('My orders', 3) },
      { path: 'account/orders/:id', ...stub('Order', 3) },
      { path: 'account/addresses', ...stub('Addresses', 3) },
      { path: 'account/profile', ...stub('Profile', 3) },

      // Auth
      { path: 'sign-in', ...stub('Sign in', 3) },
      { path: 'sign-up', ...stub('Create account', 3) },
      { path: 'forgot-password', ...stub('Reset your password', 3) },
      { path: 'reset-password', ...stub('Choose a new password', 3) },

      // Static. These three 404'd in the old app while being linked in the footer.
      { path: 'contact', ...stub('Contact', 7) },
      { path: 'faq', ...stub('FAQ', 7) },
      { path: 'shipping', ...stub('Shipping & returns', 7) },

      // The entire admin tree is a separate chunk, so a storefront visitor
      // never downloads it. Phase 3 puts <RequireAdmin> in front.
      { path: 'admin/*', lazy: () => import('@/features/admin/route') },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
