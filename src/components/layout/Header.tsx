import { Link, NavLink } from 'react-router'
import { Menu, Search, ShieldCheck, ShoppingBag, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart, selectItemCount } from '@/store/cart'
import { useUi } from '@/store/ui'
import { useProfile } from '@/hooks/useProfile'
import { cn } from '@/lib/utils'
import { MobileNav } from './MobileNav'
import { NAV_LINKS } from './nav-links'

export function Header() {
  // Zustand's persist hydrates synchronously, so this is already correct on
  // first paint -- the old navbar always flashed "Cart (0)".
  const itemCount = useCart(selectItemCount)
  const setNavOpen = useUi((s) => s.setNavOpen)
  const setCartOpen = useUi((s) => s.setCartOpen)
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  // profiles.role, checked in the DB -- never an env allowlist or an email
  // comparison. A customer simply never sees this link; the real gate is
  // <RequireAdmin> plus is_admin() inside every admin RPC regardless.
  const { profile } = useProfile()
  const isAdmin = profile?.role === 'admin'

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="tap-target md:hidden"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>

        <Link
          to="/"
          className="font-display mr-auto text-lg font-semibold tracking-[0.2em] uppercase md:mr-8"
        >
          Kochu
        </Link>

        <nav className="hidden items-center gap-6 md:flex md:mr-auto">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'hover:text-primary text-sm transition-colors',
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="tap-target"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <Search className="size-5" />
        </Button>

        {isAdmin && (
          <Button variant="ghost" size="icon" className="tap-target hidden md:inline-flex" asChild>
            <Link to="/admin" aria-label="Admin dashboard">
              <ShieldCheck className="size-5" />
            </Link>
          </Button>
        )}

        <Button variant="ghost" size="icon" className="tap-target" asChild>
          <Link to="/account" aria-label="Account">
            <User className="size-5" />
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="tap-target relative"
          onClick={() => setCartOpen(true)}
          aria-label={`Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
        >
          <ShoppingBag className="size-5" />
          {itemCount > 0 && (
            <span className="bg-accent text-accent-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums">
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </Button>
      </div>

      <MobileNav />
    </header>
  )
}
