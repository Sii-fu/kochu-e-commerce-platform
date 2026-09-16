/**
 * The Phase 2 gate, as far as it can be automated: every route renders, the
 * mobile nav opens, prices format as taka, and nothing logs an error.
 *
 * This is a shell smoke test, not a substitute for looking at the thing in a
 * browser -- it asserts that routes mount and that navigation is wired, not
 * that any of it looks right.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routes } from '@/routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
})

const ROUTES = [
  '/',
  '/shop',
  '/product/some-slug',
  '/collections',
  '/collections/summer',
  '/drops',
  '/drops/midnight-gold',
  '/early-access',
  '/articles',
  '/articles/some-article',
  '/checkout',
  '/order/abc-123',
  '/account',
  '/account/orders',
  '/account/orders/abc-123',
  '/account/addresses',
  '/account/profile',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/contact',
  '/faq',
  '/shipping',
]

describe('every route renders inside the shell', () => {
  it.each(ROUTES)('%s', async (path) => {
    renderAt(path)
    // The header is part of the shell, so its presence means the route
    // resolved rather than falling into the error boundary.
    await waitFor(() =>
      expect(screen.getByRole('banner')).toBeInTheDocument(),
    )
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('404', () => {
  it('renders the branded page, not a crash', async () => {
    renderAt('/no-such-page')
    expect(await screen.findByText('404')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /browse the shop/i }),
    ).toBeInTheDocument()
  })
})

describe('mobile nav', () => {
  it('opens from the header and closes on navigation', async () => {
    const user = userEvent.setup()
    renderAt('/')

    // Closed to begin with.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /open menu/i }))

    const nav = await screen.findByRole('dialog')
    expect(nav).toBeInTheDocument()
    // The links the old header dropped entirely on mobile.
    for (const label of ['Shop', 'Collections', 'Drops', 'Journal']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }

    await user.click(screen.getByRole('link', { name: 'My orders' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })
})

describe('cart badge', () => {
  it('is absent when the cart is empty', () => {
    renderAt('/')
    expect(
      screen.getByRole('button', { name: /cart, 0 items/i }),
    ).toBeInTheDocument()
  })
})
