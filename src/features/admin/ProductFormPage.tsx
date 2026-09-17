import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Trash2, Upload } from 'lucide-react'
import { getAdminProductById, getAdminCollections, getAdminDrops } from '@/lib/supabase/admin/queries'
import {
  createProduct,
  updateProduct,
  addProductImage,
  removeProductImage,
  reorderProductImages,
} from '@/lib/supabase/admin/mutations'
import { getDistinctCategories } from '@/lib/supabase/queries'
import { fromMinor } from '@/lib/money'
import { productSchema, type ProductInput } from '@/lib/validation/admin'
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

const emptyVariant = { label: '', sku: '', priceDeltaTaka: 0, stock: 0, isActive: true }

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => getAdminProductById(id as string),
    enabled: !isNew,
  })

  const { data: collections } = useQuery({ queryKey: ['admin-collections'], queryFn: getAdminCollections })
  const { data: drops } = useQuery({ queryKey: ['admin-drops'], queryFn: getAdminDrops })
  const { data: categories } = useQuery({ queryKey: ['product-categories'], queryFn: getDistinctCategories })

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      slug: '',
      name: '',
      description: '',
      details: '',
      category: '',
      collectionId: '',
      dropId: '',
      priceTaka: 0,
      compareAtTaka: undefined,
      status: 'DRAFT',
      isFeatured: false,
      // Every product needs at least one variant, even single-size items --
      // CLAUDE.md. "One Size" is a real, valid label, not a placeholder.
      variants: [{ ...emptyVariant, label: 'One Size' }],
    },
  })

  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'variants' })

  useEffect(() => {
    if (!product) return
    form.reset({
      slug: product.slug,
      name: product.name,
      description: product.description ?? '',
      details: product.details ?? '',
      category: product.category,
      collectionId: product.collection_id ?? '',
      dropId: product.drop_id ?? '',
      priceTaka: fromMinor(product.price_minor),
      compareAtTaka: product.compare_at_minor ? fromMinor(product.compare_at_minor) : undefined,
      status: product.status,
      isFeatured: product.is_featured,
      variants: product.product_variants.map((v) => ({
        id: v.id,
        label: v.label,
        sku: v.sku ?? '',
        priceDeltaTaka: fromMinor(v.price_delta_minor),
        stock: v.stock,
        isActive: v.is_active,
      })),
    })
    // Only re-sync when a different product finishes loading -- not on
    // every keystroke, which `form` in the dep array would otherwise cause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])

  const save = useMutation({
    mutationFn: (values: ProductInput) => (isNew ? createProduct(values) : updateProduct(id as string, values)),
    onSuccess: (newId) => {
      toast.success(isNew ? 'Product created' : 'Product saved')
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      if (isNew && newId) {
        navigate(`/admin/products/${newId}`, { replace: true })
      } else {
        queryClient.invalidateQueries({ queryKey: ['admin-product', id] })
      }
    },
    onError: () => toast.error('Could not save that product. Check the fields and try again.'),
  })

  const uploadImage = useMutation({
    mutationFn: (file: File) => addProductImage(id as string, file, product?.product_images.length ?? 0),
    onSuccess: () => {
      toast.success('Image added')
      queryClient.invalidateQueries({ queryKey: ['admin-product', id] })
    },
    onError: () => toast.error('Could not upload that image.'),
  })

  const deleteImage = useMutation({
    mutationFn: (args: { imageId: string; path: string }) => removeProductImage(args.imageId, args.path),
    onSuccess: () => {
      toast.success('Image removed')
      queryClient.invalidateQueries({ queryKey: ['admin-product', id] })
    },
    onError: () => toast.error('Could not remove that image.'),
  })

  const reorderImages = useMutation({
    mutationFn: reorderProductImages,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-product', id] }),
  })

  function moveImage(index: number, direction: -1 | 1) {
    if (!product) return
    const images = [...product.product_images]
    const target = index + direction
    if (target < 0 || target >= images.length) return
    ;[images[index], images[target]] = [images[target], images[index]]
    reorderImages.mutate(images.map((img, i) => ({ id: img.id, sort_order: i })))
  }

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
        to="/admin/products"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Products
      </Link>

      <h1 className="font-display text-xl font-semibold">
        {isNew ? 'New product' : product?.name}
      </h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
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

          <FormField
            control={form.control}
            name="details"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Details & care (optional)</FormLabel>
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input list="category-options" {...field} />
                  </FormControl>
                  <datalist id="category-options">
                    {categories?.map((c) => <option key={c} value={c} />)}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priceTaka"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (৳)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="compareAtTaka"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Compare-at price (optional)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="collectionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
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
              name="dropId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Drop</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {drops?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 space-y-0">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="!mt-0">Feature on the homepage</FormLabel>
              </FormItem>
            )}
          />

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Variants</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ...emptyVariant })}
              >
                <Plus className="size-4" /> Add variant
              </Button>
            </div>
            {form.formState.errors.variants?.root && (
              <p className="text-destructive mt-1 text-sm">
                {form.formState.errors.variants.root.message}
              </p>
            )}
            <div className="mt-2 space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                  <div className="min-w-24 flex-1">
                    <label className="text-muted-foreground text-xs">Label</label>
                    <Input {...form.register(`variants.${index}.label`)} placeholder="S, M, One Size…" />
                  </div>
                  <div className="min-w-24 flex-1">
                    <label className="text-muted-foreground text-xs">SKU (optional)</label>
                    <Input {...form.register(`variants.${index}.sku`)} />
                  </div>
                  <div className="w-28">
                    <label className="text-muted-foreground text-xs">Price delta (৳)</label>
                    <Input type="number" step="0.01" {...form.register(`variants.${index}.priceDeltaTaka`)} />
                  </div>
                  <div className="w-24">
                    <label className="text-muted-foreground text-xs">Stock</label>
                    <Input type="number" {...form.register(`variants.${index}.stock`)} />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      checked={form.watch(`variants.${index}.isActive`)}
                      onCheckedChange={(v) => form.setValue(`variants.${index}.isActive`, v)}
                    />
                    <span className="text-muted-foreground text-xs">Active</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                    aria-label="Remove variant"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  {index > 0 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index - 1)} aria-label="Move up">
                      <ArrowUp className="size-4" />
                    </Button>
                  )}
                  {index < fields.length - 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index + 1)} aria-label="Move down">
                      <ArrowDown className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
          </Button>
        </form>
      </Form>

      {!isNew && product && (
        <div>
          <h2 className="text-sm font-medium">Images</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {product.product_images.map((img, index) => (
              <div key={img.id} className="group relative">
                <ProductImage
                  path={img.path}
                  alt={img.alt ?? product.name}
                  className="aspect-square w-full rounded-md border"
                />
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-white hover:text-white"
                    disabled={index === 0}
                    onClick={() => moveImage(index, -1)}
                    aria-label="Move image earlier"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-white hover:text-white"
                    disabled={index === product.product_images.length - 1}
                    onClick={() => moveImage(index, 1)}
                    aria-label="Move image later"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-white hover:text-white"
                    onClick={() => deleteImage.mutate({ imageId: img.id, path: img.path })}
                    aria-label="Remove image"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}

            <label className="border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs">
              <Upload className="size-5" />
              Upload
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
        </div>
      )}
    </div>
  )
}
