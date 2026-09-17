import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Star } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { getAddresses } from '@/lib/supabase/queries'
import { createAddress, deleteAddress, updateAddress } from '@/lib/supabase/mutations'
import type { AddressInput } from '@/lib/validation/auth'
import type { Tables } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { EmptyState } from '@/components/common/EmptyState'
import { AddressForm } from './AddressForm'

export function AddressBook() {
  // Not `session!.user.id` -- this component mounts its own independent
  // useSession() call (a fresh getSession() round-trip), separate from the
  // one <RequireAuth> already resolved, so `session` starts out null here
  // even for an already-signed-in visitor. Asserting it non-null crashed the
  // whole route on first render, every time.
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Tables<'addresses'> | 'new' | null>(null)

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses', userId],
    queryFn: () => getAddresses(userId as string),
    enabled: !!userId,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['addresses', userId] })

  const createMutation = useMutation({
    mutationFn: (input: AddressInput) => createAddress(userId as string, input),
    onSuccess: () => {
      toast.success('Address added')
      setEditing(null)
      invalidate()
    },
    onError: () => toast.error('Could not save that address. Try again.'),
  })

  const updateMutation = useMutation({
    mutationFn: (input: AddressInput) =>
      updateAddress((editing as Tables<'addresses'>).id, userId as string, input),
    onSuccess: () => {
      toast.success('Address updated')
      setEditing(null)
      invalidate()
    },
    onError: () => toast.error('Could not save that address. Try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      toast.success('Address removed')
      invalidate()
    },
    onError: () => toast.error('Could not remove that address. Try again.'),
  })

  if (sessionLoading || isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-medium">Saved addresses</h2>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" /> Add address
        </Button>
      </div>

      {!addresses || addresses.length === 0 ? (
        <EmptyState
          className="py-10"
          title="No saved addresses"
          description="Add one to speed up checkout next time."
        />
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardContent className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{address.label || address.recipient}</p>
                  {address.is_default && (
                    <span className="text-accent-foreground bg-accent inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                      <Star className="size-3" /> Default
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{address.recipient}</p>
                <p className="text-muted-foreground">{address.phone}</p>
                <p className="text-muted-foreground">
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ''}, {address.city}
                  {address.district ? `, ${address.district}` : ''}
                  {address.postal_code ? ` ${address.postal_code}` : ''}
                </p>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(address)}>
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this address?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This cannot be undone. Past orders keep their own delivery details
                          regardless.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(address.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add address' : 'Edit address'}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <AddressForm
              address={editing === 'new' ? undefined : editing}
              submitting={createMutation.isPending || updateMutation.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={(values) =>
                editing === 'new' ? createMutation.mutate(values) : updateMutation.mutate(values)
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
