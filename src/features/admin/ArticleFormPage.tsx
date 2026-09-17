import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Upload } from 'lucide-react'
import { getAdminArticleById, getAdminCollections } from '@/lib/supabase/admin/queries'
import {
  createArticle,
  updateArticle,
  updateArticleFeaturedImage,
} from '@/lib/supabase/admin/mutations'
import { articleSchema, type ArticleInput } from '@/lib/validation/admin'
import { ProductImage } from '@/components/common/ProductImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'

const NONE = '__none__'

export function ArticleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: article,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-article', id],
    queryFn: () => getAdminArticleById(id as string),
    enabled: !isNew,
  })

  const { data: collections } = useQuery({ queryKey: ['admin-collections'], queryFn: getAdminCollections })

  const form = useForm<ArticleInput>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      slug: '',
      title: '',
      abstract: '',
      content: '',
      collectionId: '',
      isPublished: false,
    },
  })

  useEffect(() => {
    if (!article) return
    form.reset({
      slug: article.slug,
      title: article.title,
      abstract: article.abstract,
      content: article.content,
      collectionId: article.collection_id ?? '',
      isPublished: article.is_published,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article])

  const save = useMutation({
    mutationFn: (values: ArticleInput) =>
      isNew ? createArticle(values) : updateArticle(id as string, values, article?.published_at ?? null),
    onSuccess: (newId) => {
      toast.success(isNew ? 'Article created' : 'Article saved')
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] })
      if (isNew && newId) {
        navigate(`/admin/articles/${newId}`, { replace: true })
      } else {
        queryClient.invalidateQueries({ queryKey: ['admin-article', id] })
      }
    },
    onError: () => toast.error('Could not save that article.'),
  })

  const uploadImage = useMutation({
    mutationFn: (file: File) => updateArticleFeaturedImage(id as string, file),
    onSuccess: () => {
      toast.success('Featured image updated')
      queryClient.invalidateQueries({ queryKey: ['admin-article', id] })
    },
    onError: () => toast.error('Could not upload that image.'),
  })

  if (!isNew && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!isNew && isError) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        to="/admin/articles"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Articles
      </Link>

      <h1 className="font-display text-xl font-semibold">{isNew ? 'New article' : article?.title}</h1>

      {!isNew && article && (
        <div className="group relative w-full max-w-sm">
          <ProductImage
            bucket="articles"
            path={article.featured_image}
            alt={article.title}
            className="aspect-video w-full rounded-md border"
          />
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-md bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white">
            <Upload className="size-5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadImage.mutate(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <FormField
            control={form.control}
            name="abstract"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Abstract</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content (Markdown)</FormLabel>
                <FormControl>
                  <Textarea rows={16} className="font-mono text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="collectionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Related collection (optional)</FormLabel>
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? '' : v)}>
                  <FormControl>
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {collections?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <FormLabel className="!mt-0">Published</FormLabel>
              </FormItem>
            )}
          />

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : isNew ? 'Create article' : 'Save changes'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
