import { create } from 'zustand'

/**
 * Transient client state only -- what is open right now. Nothing here is
 * persisted and nothing here is server data.
 */
type UiState = {
  cartOpen: boolean
  navOpen: boolean
  searchOpen: boolean
  setCartOpen: (open: boolean) => void
  setNavOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  cartOpen: false,
  navOpen: false,
  searchOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setNavOpen: (navOpen) => set({ navOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}))
