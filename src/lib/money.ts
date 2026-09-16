/**
 * Money is integer poisha everywhere. 1 BDT = 100 poisha.
 *
 * Nothing in this file is used to compute an order total -- `create_order()`
 * re-derives every amount from the database. These helpers exist only to turn
 * a minor-unit integer into something a person can read, and to turn a form
 * field back into one at the admin edge.
 */

// narrowSymbol is what produces `৳`. Plain 'symbol' renders the ISO code
// ("BDT 4,200") under en-BD, and bn-BD would switch the digits to Bengali
// numerals, which is not what the storefront wants.
const opts = {
  style: 'currency',
  currency: 'BDT',
  currencyDisplay: 'narrowSymbol',
} as const

const BDT = new Intl.NumberFormat('en-BD', {
  ...opts,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const BDT_WITH_PAISA = new Intl.NumberFormat('en-BD', {
  ...opts,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format poisha for display: `formatBDT(420000)` -> `৳4,200`.
 *
 * Whole taka by default, because catalog prices are whole taka and `৳4,200.00`
 * is noise. Sub-taka amounts (only ever a percentage discount) keep both
 * decimals rather than rounding away money that was actually charged.
 */
export function formatBDT(minor: number): string {
  const hasPaisa = minor % 100 !== 0
  return (hasPaisa ? BDT_WITH_PAISA : BDT).format(minor / 100)
}

/** Taka as typed by an admin -> poisha. `toMinor('4200.50')` -> `420050`. */
export function toMinor(taka: number | string): number {
  const n = typeof taka === 'string' ? Number(taka.trim()) : taka
  if (!Number.isFinite(n)) throw new Error(`Not a number: ${taka}`)
  return Math.round(n * 100)
}

/** Poisha -> taka, for prefilling a number input. Never for arithmetic. */
export function fromMinor(minor: number): number {
  return minor / 100
}
