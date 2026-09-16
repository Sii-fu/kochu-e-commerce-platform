import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * A display snapshot of a cart line -- enough to render the drawer instantly
 * with zero network.
 *
 * It is display-only. `create_order()` ignores every price here and re-derives
 * the total from the database, so a tampered localStorage buys nothing.
 * `useCartValidation()` reconciles the snapshot against the catalog when the
 * drawer opens and flags drift inline.
 */
export type CartLine = {
  variantId: string
  productId: string
  slug: string
  name: string
  variantLabel: string
  imagePath: string | null
  unitPriceMinor: number
  quantity: number
}

type CartState = {
  lines: CartLine[]
  add: (line: CartLine) => void
  setQuantity: (variantId: string, quantity: number) => void
  remove: (variantId: string) => void
  clear: () => void
}

const MAX_PER_LINE = 99

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      add: (line) =>
        set((state) => {
          const existing = state.lines.find((l) => l.variantId === line.variantId)
          if (!existing) return { lines: [...state.lines, line] }
          return {
            lines: state.lines.map((l) =>
              l.variantId === line.variantId
                ? { ...l, quantity: Math.min(l.quantity + line.quantity, MAX_PER_LINE) }
                : l,
            ),
          }
        }),

      setQuantity: (variantId, quantity) =>
        set((state) => ({
          lines:
            quantity < 1
              ? state.lines.filter((l) => l.variantId !== variantId)
              : state.lines.map((l) =>
                  l.variantId === variantId
                    ? { ...l, quantity: Math.min(quantity, MAX_PER_LINE) }
                    : l,
                ),
        })),

      remove: (variantId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) })),

      clear: () => set({ lines: [] }),
    }),
    { name: 'kochu-cart-v2' },
  ),
)

/** Snapshot subtotal, for the drawer and the free-shipping meter only. */
export const selectSubtotalMinor = (state: CartState) =>
  state.lines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0)

export const selectItemCount = (state: CartState) =>
  state.lines.reduce((sum, l) => sum + l.quantity, 0)
