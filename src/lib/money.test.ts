import { describe, expect, it } from 'vitest'
import { formatBDT, fromMinor, toMinor } from './money'

describe('formatBDT', () => {
  it('renders the taka sign, not the ISO code', () => {
    // `currencyDisplay: 'symbol'` gives "BDT 4,200" under en-BD. The narrow
    // symbol is the whole reason that option is set.
    expect(formatBDT(420000)).toBe('৳4,200')
  })

  it('drops decimals for whole taka', () => {
    expect(formatBDT(100000)).toBe('৳1,000')
    expect(formatBDT(0)).toBe('৳0')
  })

  it('keeps paisa when an amount actually has them', () => {
    // A percentage discount is the only thing that produces these.
    expect(formatBDT(420050)).toBe('৳4,200.50')
  })

  it('groups thousands', () => {
    expect(formatBDT(123456700)).toBe('৳1,234,567')
  })
})

describe('toMinor', () => {
  it('converts taka to poisha', () => {
    expect(toMinor(4200)).toBe(420000)
    expect(toMinor('4200.50')).toBe(420050)
  })

  it('rounds rather than truncating float error', () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE 754.
    expect(toMinor(19.99)).toBe(1999)
  })

  it('rejects junk', () => {
    expect(() => toMinor('abc')).toThrow()
  })
})

describe('round trip', () => {
  it('survives minor -> taka -> minor', () => {
    for (const minor of [0, 1, 99, 100, 420050, 123456789]) {
      expect(toMinor(fromMinor(minor))).toBe(minor)
    }
  })
})
