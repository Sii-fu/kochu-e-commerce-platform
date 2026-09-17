import { vi } from 'vitest'

/**
 * A no-op stand-in for the Supabase client, used by every test via the
 * `vi.mock('@/lib/supabase/client', ...)` call in setup.ts.
 *
 * Without this, every render of <Header> (i.e. every route test, since it's
 * part of the shell) calls the real `supabase.auth.getSession()`, which
 * makes a genuine network request to whatever VITE_SUPABASE_URL points at.
 * That makes the suite depend on a running local Supabase stack and produces
 * act() warnings when the real response lands after the test has finished
 * asserting. Tests should be hermetic.
 */
export function createSupabaseMock() {
  const authStateCallbacks = new Set<(event: string, session: null) => void>()

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn((callback: (event: string, session: null) => void) => {
        authStateCallbacks.add(callback)
        return {
          data: {
            subscription: {
              unsubscribe: () => authStateCallbacks.delete(callback),
            },
          },
        }
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(),
    storage: { from: vi.fn() },
  }
}
