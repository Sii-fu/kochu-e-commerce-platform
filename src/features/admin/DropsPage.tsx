import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Upload, Zap } from 'lucide-react'
import { getAdminDrops } from '@/lib/supabase/admin/queries'
import { createDrop, updateDrop, updateDropCover, deleteDrop } from '@/lib/supabase/admin/mutations'
import { grantDropAccess } from '@/lib/supabase/rpc'
import { dropSchema, grantDropAccessSchema, type DropInput, type GrantDropAccessInput } from '@/lib/validation/admin'
import { toDatetimeLocal } from '@/lib/datetime'
import type { Tables } from '@/lib/supabase/types'
import { ProductImage } from '@/components/common/ProductImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
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

type Drop = Tables<'drops'>

function DropForm({
  drop,
  onSubmit,
  submitting,
}: {
  drop?: Drop
  onSubmit: (values: DropInput) => void
  submitting: boolean
}) {
  const form = useForm<DropInput>({
    resolver: zodResolver(dropSchema),
    defaultValues: {
      slug: drop?.slug ?? '',
      title: drop?.title ?? '',
      description: drop?.description ?? '',
      startsAt: toDatetimeLocal(drop?.starts_at ?? null),
      endsAt: toDatetimeLocal(drop?.ends_at ?? null),
      earlyAccessAt: toDatetimeLocal(drop?.early_access_at ?? null),
      accessKey: drop?.access_key ?? '',
      isPublished: drop?.is_published ?? false,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="earlyAccessAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Early access from (optional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starts</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ends (optional)</FormLabel>
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
          name="accessKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Self-service VIP key (optional)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Shared code customers redeem for early access" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isPublished"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3 space-y-0">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0">Published (visible on /drops)</FormLabel>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save drop'}
        </Button>
      </form>
    </Form>
  )
}

function GrantAccessForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (values: GrantDropAccessInput) => void
  submitting: boolean
}) {
  const form = useForm<GrantDropAccessInput>({
    resolver: zodResolver(grantDropAccessSchema),
    defaultValues: { emails: '' },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="emails"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emails</FormLabel>
              <FormControl>
                <Textarea rows={5} placeholder="One per line, or comma-separated" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Granting…' : 'Grant access'}
        </Button>
      </form>
    </Form>
  )
}

export function DropsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Drop | 'new' | null>(null)
  const [granting, setGranting] = useState<Drop | null>(null)

  const { data: drops, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-drops'],
    queryFn: getAdminDrops,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-drops'] })

  const createMutation = useMutation({
    mutationFn: createDrop,
    onSuccess: () => {
      toast.success('Drop created')
      setEditing(null)
      invalidate()
    },
    onError: () => toast.error('Could not save that drop.'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: DropInput) => updateDrop((editing as Drop).id, values),
    onSuccess: () => {
      toast.success('Drop updated')
      setEditing(null)
      invalidate()
    },
    onError: () => toast.error('Could not save that drop.'),
  })

  const coverMutation = useMutation({
    mutationFn: (args: { id: string; file: File }) => updateDropCover(args.id, args.file),
    onSuccess: () => {
      toast.success('Cover image updated')
      invalidate()
    },
    onError: () => toast.error('Could not upload that image.'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDrop,
    onSuccess: () => {
      toast.success('Drop deleted')
      invalidate()
    },
    onError: () => toast.error('Could not delete that drop.'),
  })

  const grantMutation = useMutation({
    mutationFn: (values: GrantDropAccessInput) =>
      grantDropAccess(
        (granting as Drop).id,
        values.emails
          .split(/[\n,]/)
          .map((e) => e.trim())
          .filter(Boolean),
      ),
    onSuccess: (count) => {
      toast.success(`Granted access to ${count} customer${count === 1 ? '' : 's'}`)
      setGranting(null)
    },
    onError: () => toast.error('Could not grant access. Check the email addresses.'),
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (isError) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Drops</h1>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" /> New drop
        </Button>
      </div>

      {!drops || drops.length === 0 ? (
        <EmptyState icon={<Zap />} title="No drops yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {drops.map((drop) => (
            <Card key={drop.id}>
              <CardContent className="space-y-2">
                <div className="group relative">
                  <ProductImage
                    bucket="drops"
                    path={drop.cover_image}
                    alt={drop.title}
                    className="aspect-video w-full rounded-md"
                  />
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-md bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white">
                    <Upload className="size-5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) coverMutation.mutate({ id: drop.id, file })
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{drop.title}</p>
                  {!drop.is_published && <span className="text-muted-foreground text-xs">Unpublished</span>}
                </div>
                <p className="text-muted-foreground text-xs">
                  Starts {new Date(drop.starts_at).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(drop)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setGranting(drop)}>
                    Grant access
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {drop.title}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Products in this drop are not deleted -- they just lose their drop tag and
                          become visible outside any drop window.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(drop.id)}>
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
            <DialogTitle>{editing === 'new' ? 'New drop' : 'Edit drop'}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <DropForm
              drop={editing === 'new' ? undefined : editing}
              submitting={createMutation.isPending || updateMutation.isPending}
              onSubmit={(values) =>
                editing === 'new' ? createMutation.mutate(values) : updateMutation.mutate(values)
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={granting !== null} onOpenChange={(open) => !open && setGranting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant early access to {granting?.title}</DialogTitle>
          </DialogHeader>
          <GrantAccessForm onSubmit={(v) => grantMutation.mutate(v)} submitting={grantMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
