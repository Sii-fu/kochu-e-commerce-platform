import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { createSupabaseMock } from './mocks/supabase'

afterEach(cleanup)

// Every test gets a signed-out, network-free Supabase client by default.
// Tests that need a signed-in session or specific query results override
// individual methods with vi.mocked(supabase.<x>).mockResolvedValueOnce(...).
vi.mock('@/lib/supabase/client', () => ({
  supabase: createSupabaseMock(),
}))

// jsdom implements neither of these, and Radix's dismissable layers and
// scroll-locking use both. Without them every dialog/sheet test throws.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// jsdom has no layout, so it throws "Not implemented" here. <ScrollRestoration>
// calls it on every navigation, which would otherwise drown the console.error
// assertions in the route tests.
window.scrollTo = vi.fn()

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Used by ShopPage's infinite-scroll trigger.
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver

// jsdom supplies AbortController, but `Request` is Node's (undici), and undici
// brand-checks the signal against its OWN AbortSignal. react-router builds a
// Request on every client-side navigation, so any test that navigates dies on
// the mismatch with "Expected signal to be an instance of AbortSignal".
//
// Construct the real undici Request without the signal, then hang jsdom's
// signal off the instance. The Request stays genuine; only the brand check is
// sidestepped. Test-only -- browsers have one consistent implementation.
const RealRequest = globalThis.Request
globalThis.Request = new Proxy(RealRequest, {
  construct(target, [input, init]: [RequestInfo, RequestInit | undefined]) {
    const { signal, ...rest } = init ?? {}
    const request = new target(input, rest)
    if (signal) {
      Object.defineProperty(request, 'signal', { value: signal, configurable: true })
    }
    return request
  },
})

// Radix sets these on portalled content.
Element.prototype.scrollIntoView ??= vi.fn()
Element.prototype.hasPointerCapture ??= vi.fn(() => false)
Element.prototype.setPointerCapture ??= vi.fn()
Element.prototype.releasePointerCapture ??= vi.fn()
