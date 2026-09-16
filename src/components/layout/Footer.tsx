import { Link } from 'react-router'

// Every one of these resolves. The old footer pointed at /contact, /faq and
// /shipping, all three of which 404'd.
const SECTIONS = [
  {
    title: 'Shop',
    links: [
      { to: '/shop', label: 'All products' },
      { to: '/collections', label: 'Collections' },
      { to: '/drops', label: 'Drops' },
      { to: '/early-access', label: 'Early access' },
    ],
  },
  {
    title: 'Help',
    links: [
      { to: '/contact', label: 'Contact' },
      { to: '/faq', label: 'FAQ' },
      { to: '/shipping', label: 'Shipping & returns' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/account/orders', label: 'Track an order' },
      { to: '/account', label: 'My account' },
      { to: '/articles', label: 'Journal' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-card mt-16 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold tracking-[0.2em] uppercase">
            Kochu
          </p>
          <p className="text-muted-foreground mt-3 text-sm">
            Considered clothing, made in Dhaka.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-medium">{section.title}</h2>
            <ul className="mt-3 space-y-1">
              {section.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground hover:text-primary flex min-h-9 items-center text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t">
        <p className="text-muted-foreground mx-auto max-w-7xl px-4 py-6 text-xs sm:px-6">
          © {new Date().getFullYear()} KOCHU. All prices in Bangladeshi taka.
        </p>
      </div>
    </footer>
  )
}
