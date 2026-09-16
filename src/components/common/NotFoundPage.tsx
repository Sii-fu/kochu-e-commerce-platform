import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
      <p className="font-display text-accent text-5xl font-semibold tabular-nums">404</p>
      <h1 className="font-display text-xl font-medium">This page does not exist</h1>
      <p className="text-muted-foreground max-w-prose text-sm">
        The link may be out of date, or the piece may have sold out and been retired.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/shop">Browse the shop</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  )
}
