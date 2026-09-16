import { Link } from 'react-router'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { useUi } from '@/store/ui'
import { NAV_LINKS } from './nav-links'

const ACCOUNT_LINKS = [
  { to: '/account/orders', label: 'My orders' },
  { to: '/account', label: 'Account' },
]

/**
 * The old header hid its nav behind `md:flex` with no alternative, so on a
 * phone only the logo, Cart and Sign In rendered. Mobile is most of the
 * traffic for a Dhaka storefront.
 */
export function MobileNav() {
  const navOpen = useUi((s) => s.navOpen)
  const setNavOpen = useUi((s) => s.setNavOpen)

  return (
    <Sheet open={navOpen} onOpenChange={setNavOpen}>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="font-display tracking-[0.2em] uppercase">
            Kochu
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col px-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setNavOpen(false)}
              className="hover:text-primary flex min-h-11 items-center text-base transition-colors"
            >
              {link.label}
            </Link>
          ))}

          <Separator className="my-3" />

          {ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setNavOpen(false)}
              className="text-muted-foreground hover:text-primary flex min-h-11 items-center text-sm transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
