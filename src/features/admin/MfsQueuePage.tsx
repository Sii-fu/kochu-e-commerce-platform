import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Inbox } from 'lucide-react'
import { getMfsQueue } from '@/lib/supabase/admin/queries'
import { verifyMfsTransaction } from '@/lib/supabase/rpc'
import { adminErrorMessage } from '@/lib/errors'
import { ReceiptLink } from './ReceiptLink'
import { formatBDT } from '@/lib/money'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'

type Reviewing = { id: string; approve: boolean; orderNumber: string }

/**
 * The highest-value screen in the admin panel (CLAUDE.md): manual MFS is a
 * trust workflow, not a payment gateway. `unique (provider, trx_id)` blocks
 * receipt reuse, but a fabricated TrxID is only ever caught by a human
 * checking the merchant app against what's shown here.
 */
export function MfsQueuePage() {
  const queryClient = useQueryClient()
  const {
    data: queue,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['mfs-queue'], queryFn: getMfsQueue })

  const [reviewing, setReviewing] = useState<Reviewing | null>(null)
  const [note, setNote] = useState('')

  const review = useMutation({
    mutationFn: (args: { id: string; approve: boolean; note?: string }) =>
      verifyMfsTransaction(args.id, args.approve, args.note),
    onSuccess: (_, args) => {
      toast.success(args.approve ? 'Payment approved' : 'Payment rejected')
      setReviewing(null)
      setNote('')
      queryClient.invalidateQueries({ queryKey: ['mfs-queue'] })
    },
    onError: (error) => toast.error(adminErrorMessage(error)),
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Payment verification queue</h1>
        <p className="text-muted-foreground text-sm">
          Check each TrxID against the merchant app before approving. Reviewer identity is logged
          on every decision.
        </p>
      </div>

      {!queue || queue.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="Queue is empty"
          description="No bKash/Nagad payments are waiting for verification right now."
        />
      ) : (
        <div className="space-y-3">
          {queue.map((tx) => (
            <Card key={tx.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`/admin/orders/${tx.orders.id}`}
                      className="font-medium hover:underline"
                    >
                      {tx.orders.order_number}
                    </Link>
                    <p className="text-muted-foreground text-sm">
                      {tx.orders.customer_name} · {tx.orders.guest_email ?? 'guest'}
                    </p>
                  </div>
                  <Badge variant="outline">{tx.provider}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground text-xs">Transaction ID</p>
                    <p className="font-mono">{tx.trx_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Sent from</p>
                    <p>{tx.sender_msisdn}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Amount submitted</p>
                    <p>{formatBDT(tx.amount_minor)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Order total</p>
                    <p className={tx.amount_minor !== tx.orders.total_minor ? 'text-destructive font-medium' : ''}>
                      {formatBDT(tx.orders.total_minor)}
                    </p>
                  </div>
                </div>

                <ReceiptLink path={tx.receipt_path} />

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() =>
                      setReviewing({ id: tx.id, approve: true, orderNumber: tx.orders.order_number })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setReviewing({ id: tx.id, approve: false, orderNumber: tx.orders.order_number })
                    }
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={reviewing !== null} onOpenChange={(open) => !open && setReviewing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewing?.approve ? 'Approve this payment?' : 'Reject this payment?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewing?.approve
                ? `${reviewing.orderNumber} moves to Processing and is marked Paid.`
                : `${reviewing?.orderNumber} goes back to Pending payment so the customer can submit a corrected TrxID.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {reviewing && !reviewing.approve && (
            <Textarea
              placeholder="Reason (admin-only, not shown to the customer)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={review.isPending}
              onClick={() =>
                reviewing &&
                review.mutate({ id: reviewing.id, approve: reviewing.approve, note: note || undefined })
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
