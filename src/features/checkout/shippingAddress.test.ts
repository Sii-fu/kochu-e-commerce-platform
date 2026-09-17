import { describe, expect, it } from 'vitest'
import { formatShippingAddress } from './shippingAddress'

describe('formatShippingAddress', () => {
  it('joins the present fields, in order', () => {
    expect(
      formatShippingAddress({
        line1: 'House 12, Road 5',
        line2: 'Flat 3B',
        city: 'Dhaka',
        district: 'Dhaka',
        postal_code: '1212',
      }),
    ).toBe('House 12, Road 5, Flat 3B, Dhaka, Dhaka, 1212')
  })

  it('skips absent optional fields rather than rendering "null"', () => {
    expect(formatShippingAddress({ line1: 'House 12', city: 'Dhaka' })).toBe('House 12, Dhaka')
  })

  it('never throws on a malformed snapshot -- the column has no schema beyond "is an object"', () => {
    expect(formatShippingAddress(null)).toBe('')
    expect(formatShippingAddress('not an object')).toBe('')
    expect(formatShippingAddress([1, 2, 3])).toBe('')
  })
})
