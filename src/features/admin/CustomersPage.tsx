import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { getAdminCustomers } from '@/lib/supabase/admin/queries'
import { updateCustomerRole } from '@/lib/supabase/admin/mutations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function CustomersPage() {
  const { session } = useSession()
  const queryClient = useQueryClient()

  const { data: customers, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: getAdminCustomers,
  })

  const toggleRole = useMutation({
    mutationFn: (args: { userId: string; role: 'admin' | 'customer' }) =>
      updateCustomerRole(args.userId, args.role),
    onSuccess: (_, args) => {
      toast.success(args.role === 'admin' ? 'Promoted to admin' : 'Removed admin access')
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
    },
    onError: () => toast.error('Could not update that account.'),
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (isError) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">Customers</h1>

      {!customers || customers.length === 0 ? (
        <EmptyState icon={<Users />} title="No accounts yet" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => {
                const isSelf = customer.id === session?.user.id
                return (
                  <TableRow key={customer.id}>
                    <TableCell>{customer.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{customer.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{customer.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={customer.role === 'admin' ? 'default' : 'outline'}>
                        {customer.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(customer.created_at).toLocaleDateString('en-BD')}
                    </TableCell>
                    <TableCell>
                      {!isSelf && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              {customer.role === 'admin' ? 'Remove admin' : 'Make admin'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {customer.role === 'admin'
                                  ? `Remove admin access from ${customer.full_name || customer.email}?`
                                  : `Promote ${customer.full_name || customer.email} to admin?`}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {customer.role === 'admin'
                                  ? 'They will lose access to this panel immediately.'
                                  : 'They will gain full access to this admin panel, including orders, products, and payments.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  toggleRole.mutate({
                                    userId: customer.id,
                                    role: customer.role === 'admin' ? 'customer' : 'admin',
                                  })
                                }
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
