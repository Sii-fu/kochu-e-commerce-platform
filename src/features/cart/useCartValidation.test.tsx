/**
 * The cart store is a display snapshot only -- create_order() re-prices and
 * re-checks stock from the database regardless. This hook is what tells a
 * customer "Price updated" or "Only 2 left" before they reach checkout,
 * instead of a rejected order after they've filled in delivery details.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import { useCartValidation } from './useCartValidation'

function mockVariants(rows: unknown[]) {
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }),
  } as never)
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const line = {
  variantId: 'v1',
  productId: 'p1',
  slug: 'kochu-tee',
  name: 'Kochu Tee',
  variantLabel: 'M',
  imagePath: null,
  unitPriceMinor: 150000,
  quantity: 2,
}

afterEach(() => {
  useCart.setState({ lines: [] })
  vi.clearAllMocks()
})

describe('useCartValidation', () => {
  it('flags nothing when the live variant matches the cart snapshot exactly', async () => {
    useCart.setState({ lines: [line] })
    mockVariants([
      { id: 'v1', stock: 10, is_active: true, price_delta_minor: 0, products: { price_minor: 150000, status: 'ACTIVE' } },
    ])

    const { result } = renderHook(() => useCartValidation(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.issues.size).toBe(0)
    expect(result.current.hasBlockingIssues).toBe(false)
  })

  it('blocks checkout when a variant is deactivated or a product is no longer ACTIVE', async () => {
    useCart.setState({ lines: [line] })
    mockVariants([
      { id: 'v1', stock: 10, is_active: false, price_delta_minor: 0, products: { price_minor: 150000, status: 'ACTIVE' } },
    ])

    const { result } = renderHook(() => useCartValidation(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.issues.get('v1')).toEqual({ type: 'unavailable' })
    expect(result.current.hasBlockingIssues).toBe(true)
  })

  it('blocks checkout when stock has dropped to zero', async () => {
    useCart.setState({ lines: [line] })
    mockVariants([
      { id: 'v1', stock: 0, is_active: true, price_delta_minor: 0, products: { price_minor: 150000, status: 'ACTIVE' } },
    ])

    const { result } = renderHook(() => useCartValidation(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.issues.get('v1')).toEqual({ type: 'out-of-stock' })
    expect(result.current.hasBlockingIssues).toBe(true)
  })

  it('flags a price change without blocking checkout', async () => {
    useCart.setState({ lines: [line] })
    mockVariants([
      { id: 'v1', stock: 10, is_active: true, price_delta_minor: 0, products: { price_minor: 180000, status: 'ACTIVE' } },
    ])

    const { result } = renderHook(() => useCartValidation(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.issues.get('v1')).toEqual({ type: 'price-changed', newUnitPriceMinor: 180000 })
    expect(result.current.hasBlockingIssues).toBe(false)
  })

  it('flags low stock (fewer left than the cart wants) without blocking checkout', async () => {
    useCart.setState({ lines: [line] })
    mockVariants([
      { id: 'v1', stock: 1, is_active: true, price_delta_minor: 0, products: { price_minor: 150000, status: 'ACTIVE' } },
    ])

    const { result } = renderHook(() => useCartValidation(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.issues.get('v1')).toEqual({ type: 'low-stock', available: 1 })
    expect(result.current.hasBlockingIssues).toBe(false)
  })

  it('treats a variant missing from the response entirely as unavailable', async () => {
    useCart.setState({ lines: [line] })
    mockVariants([])

    const { result } = renderHook(() => useCartValidation(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.issues.get('v1')).toEqual({ type: 'unavailable' })
  })
})
