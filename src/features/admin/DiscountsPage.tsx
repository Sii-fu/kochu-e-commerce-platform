import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Ticket } from 'lucide-react'
import { getAdminDiscountCodes } from '@/lib/supabase/admin/queries'
import {
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
} from '@/lib/supabase/admin/mutations'
import { discountCodeSchema, type DiscountCodeInput } from '@/lib/validation/admin'
import { toDatetimeLocal } from '@/lib/datetime'
import { formatBDT, fromMinor } from '@/lib/money'
import type { Tables } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

type DiscountCode = Tables<'discount_codes'>

function DiscountCodeForm({
  code,
  onSubmit,
  submitting,
}: {
  code?: DiscountCode
  onSubmit: (values: DiscountCodeInput) => void
  submitting: boolean
}) {
  const form = useForm<DiscountCodeInput>({
    resolver: zodResolver(discountCodeSchema),
    defaultValues: {
      code: code?.code ?? '',
      description: code?.description ?? '',
      type: code?.type ?? 'PERCENT',
      value: code ? (code.type === 'FIXED' ? fromMinor(code.value) : code.value) : 10,
      minOrderTaka: code ? fromMinor(code.min_order_minor) : 0,
      maxUses: code?.max_uses ?? undefined,
      startsAt: toDatetimeLocal(code?.starts_at),
      expiresAt: toDatetimeLocal(code?.expires_at),
      isActive: code?.is_active ?? true,
    },
  })

  const type = form.watch('type')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input {...field} className="uppercase" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percent off</SelectItem>
                    <SelectItem value="FIXED">Fixed amount off</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{type === 'PERCENT' ? 'Percent off (1-100)' : 'Amount off (৳)'}</FormLabel>
                <FormControl>
                  <Input type="number" step={type === 'PERCENT' ? 1 : 0.01} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minOrderTaka"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum order (৳)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="maxUses"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max uses (optional, blank = unlimited)</FormLabel>
              <FormControl>
                <Input type="number" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starts (optional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expires (optional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3 space-y-0">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0">Active</FormLabel>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save code'}
        </Button>
      </form>
    </Form>
  )
}

export function DiscountsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<DiscountCode | 'new' | null>(null)

  const { data: codes, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-discount-codes'],
    queryFn: getAdminDiscountCodes,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-discount-codes'] })

  const createMutation = useMutation({
    mutationFn: createDiscountCode,
    onSuccess: () => {
      toast.success('Discount code created')
      setEditing(null)
      invalidate()
    },
    onError: (error: unknown) =>
      toast.error(
        error instanceof Error && error.message.includes('duplicate')
          ? 'That code already exists.'
          : 'Could not save that code.',
      ),
  })

  const updateMutation = useMutation({
    mutationFn: (values: DiscountCodeInput) => updateDiscountCode((editing as DiscountCode).id, values),
    onSuccess: () => {
      toast.success('Discount code updated')
      setEditing(null)
      invalidate()
    },
    onError: () => toast.error('Could not save that code.'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDiscountCode,
    onSuccess: () => {
      toast.success('Discount code deleted')
      invalidate()
    },
    onError: () => toast.error('Could not delete that code.'),
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (isError) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Discount codes</h1>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" /> New code
        </Button>
      </div>

      {!codes || codes.length === 0 ? (
        <EmptyState icon={<Ticket />} title="No discount codes yet" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-mono font-medium">{code.code}</TableCell>
                  <TableCell>
                    {code.type === 'PERCENT' ? `${code.value}%` : formatBDT(code.value)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {code.used_count}
                    {code.max_uses ? ` / ${code.max_uses}` : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant={code.is_active ? 'default' : 'outline'}>
                      {code.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(code)}>
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
                          <AlertDialogTitle>Delete {code.code}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Orders that already used this code keep their discount -- deleting only
                            stops it being applied again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(code.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'New discount code' : 'Edit discount code'}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <DiscountCodeForm
              code={editing === 'new' ? undefined : editing}
              submitting={createMutation.isPending || updateMutation.isPending}
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
