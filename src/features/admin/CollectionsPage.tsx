import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Layers, Plus, Upload } from 'lucide-react'
import { getAdminCollections } from '@/lib/supabase/admin/queries'
import {
  createCollection,
  updateCollection,
  updateCollectionCover,
  deleteCollection,
} from '@/lib/supabase/admin/mutations'
import { collectionSchema, type CollectionInput } from '@/lib/validation/admin'
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

type Collection = Tables<'collections'>

function CollectionForm({
  collection,
  onSubmit,
  submitting,
}: {
  collection?: Collection
  onSubmit: (values: CollectionInput) => void
  submitting: boolean
}) {
  const form = useForm<CollectionInput>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      slug: collection?.slug ?? '',
      title: collection?.title ?? '',
      description: collection?.description ?? '',
      season: collection?.season ?? '',
      sortOrder: collection?.sort_order ?? 0,
      isActive: collection?.is_active ?? true,
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="season"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Season (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="SS26" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sort order</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
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
              <FormLabel className="!mt-0">Visible on the storefront</FormLabel>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save collection'}
        </Button>
      </form>
    </Form>
  )
}

export function CollectionsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Collection | 'new' | null>(null)

  const { data: collections, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: getAdminCollections,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-collections'] })

  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      toast.success('Collection created')
      setEditing(null)
      invalidate()
    },
    onError: () => toast.error('Could not save that collection.'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: CollectionInput) => updateCollection((editing as Collection).id, values),
    onSuccess: () => {
      toast.success('Collection updated')
      setEditing(null)
      invalidate()
    },
    onError: () => toast.error('Could not save that collection.'),
  })

  const coverMutation = useMutation({
    mutationFn: (args: { id: string; file: File }) => updateCollectionCover(args.id, args.file),
    onSuccess: () => {
      toast.success('Cover image updated')
      invalidate()
    },
    onError: () => toast.error('Could not upload that image.'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => {
      toast.success('Collection deleted')
      invalidate()
    },
    onError: () => toast.error('Could not delete that collection.'),
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (isError) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Collections</h1>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" /> New collection
        </Button>
      </div>

      {!collections || collections.length === 0 ? (
        <EmptyState icon={<Layers />} title="No collections yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Card key={collection.id}>
              <CardContent className="space-y-2">
                <div className="group relative">
                  <ProductImage
                    bucket="collections"
                    path={collection.cover_image}
                    alt={collection.title}
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
                        if (file) coverMutation.mutate({ id: collection.id, file })
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{collection.title}</p>
                  {!collection.is_active && (
                    <span className="text-muted-foreground text-xs">Hidden</span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">{collection.slug}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(collection)}>
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
                        <AlertDialogTitle>Delete {collection.title}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Products in this collection are not deleted -- they just lose their
                          collection tag.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(collection.id)}>
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
            <DialogTitle>{editing === 'new' ? 'New collection' : 'Edit collection'}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <CollectionForm
              collection={editing === 'new' ? undefined : editing}
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
