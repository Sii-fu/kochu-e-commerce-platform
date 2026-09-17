/**
 * A real defect, caught by hand in a browser rather than by this suite:
 * AddressBook, the account OrdersPage, and the account OrderDetailPage all
 * wrote `const userId = session!.user.id` at the top of the component.
 * `<RequireAuth>` already resolved a session before rendering its children,
 * but each of these pages mounts its OWN independent `useSession()` call --
 * a fresh `getSession()` round-trip -- so `session` starts out `null` on
 * *that* hook's first render regardless of what the guard already knows.
 * The non-null assertion crashed the whole route, every time, for every
 * real signed-in visitor. `shell.test.tsx` never caught it because it only
 * ever renders these routes signed out, where `<RequireAuth>` redirects
 * before the page body mounts at all.
 */
import { describe, expect, it, vi } from 'vitest'
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

function fakeSession(): Session {
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
    },
  } as Session
}

function emptyResultChain() {
  const chain: Record<string, unknown> = {}
  chain.eq = () => chain
  chain.order = () => chain
  chain.single = () => Promise.resolve({ data: { id: 'user-1', role: 'customer' }, error: null })
  chain.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
    resolve({ data: [], error: null })
  return chain
}

function mockTables() {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: fakeSession() },
    error: null,
  } as never)
  vi.mocked(supabase.from).mockReturnValue({
    select: () => emptyResultChain(),
  } as never)
}

describe('account pages that mount their own useSession()', () => {
  it('renders /account/addresses for a signed-in visitor instead of crashing to the route error boundary', async () => {
    mockTables()
    renderAt('/account/addresses')

    await waitFor(() => expect(screen.getByText(/no saved addresses/i)).toBeInTheDocument())
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
  })

  it('renders /account/orders for a signed-in visitor instead of crashing to the route error boundary', async () => {
    mockTables()
    renderAt('/account/orders')

    await waitFor(() => expect(screen.getByText(/no orders yet/i)).toBeInTheDocument())
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
  })
})
