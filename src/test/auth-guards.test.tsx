/**
 * The Phase 3 gate: a signed-out visitor bounces from /account/* and /admin/*
 * to /sign-in?next=<where they were going>, and a signed-in non-admin still
 * bounces from /admin/*.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { routes } from '@/routes'
import { supabase } from '@/lib/supabase/client'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function fakeSession(overrides: Partial<Session['user']> = {}): Session {
  return {
    access_token: 'fake',
    refresh_token: 'fake',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '',
      email: 'shopper@kochu.test',
      ...overrides,
    },
  } as Session
}

afterEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: null },
    error: null,
  } as never)
})

describe('RequireAuth', () => {
  it('sends a signed-out visitor to sign-in with the right next=', async () => {
    renderAt('/account/addresses')

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument(),
    )
    // The next param drives where sign-in returns to -- assert the sign-up
    // cross-link carries it forward, since that's externally observable.
    const signUpLink = screen.getByRole('link', { name: /create an account/i })
    expect(signUpLink.getAttribute('href')).toContain(
      encodeURIComponent('/account/addresses'),
    )
  })

  it('renders the account shell for a signed-in visitor', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: fakeSession() },
      error: null,
    } as never)

    renderAt('/account')

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /my account/i })).toBeInTheDocument(),
    )
    // AccountOverviewPage mounts its own independent useSession() call (a
    // fresh getSession() round-trip), separate from the one RequireAuth
    // already resolved -- so this needs its own wait, not just the heading's.
    await waitFor(() =>
      expect(screen.getByText('shopper@kochu.test')).toBeInTheDocument(),
    )
  })
})

describe('RequireAdmin', () => {
  it('sends a signed-out visitor to sign-in, not to the admin panel', async () => {
    renderAt('/admin')

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument(),
    )
  })

  it('sends a signed-in non-admin to sign-in too -- role is checked, not just auth', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: fakeSession() },
      error: null,
    } as never)
    // profiles.select().eq().single() resolves to a customer role.
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 'user-1', role: 'customer', email: 'shopper@kochu.test' },
              error: null,
            }),
        }),
      }),
    } as never)

    renderAt('/admin')

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument(),
    )
  })
})
