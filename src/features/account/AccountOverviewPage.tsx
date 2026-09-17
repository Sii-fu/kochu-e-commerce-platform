import { Link } from 'react-router'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent } from '@/components/ui/card'

export function AccountOverviewPage() {
  const { session } = useSession()

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">Signed in as</p>
          <p className="font-medium">{session?.user.email}</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/account/orders" className="block">
          <Card className="hover:border-primary transition-colors">
            <CardContent>
              <p className="font-medium">Orders</p>
              <p className="text-muted-foreground text-sm">Track and review past purchases</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/account/addresses" className="block">
          <Card className="hover:border-primary transition-colors">
            <CardContent>
              <p className="font-medium">Addresses</p>
              <p className="text-muted-foreground text-sm">Manage saved delivery addresses</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
