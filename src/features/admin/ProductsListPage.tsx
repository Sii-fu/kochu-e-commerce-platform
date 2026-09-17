import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Package, Plus } from 'lucide-react'
import { getAdminProducts } from '@/lib/supabase/admin/queries'
import { deleteProduct } from '@/lib/supabase/admin/mutations'
import { formatBDT } from '@/lib/money'
import { ProductImage } from '@/components/common/ProductImage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import type { Database } from '@/lib/supabase/types'
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

const STATUS_VARIANT = {
  DRAFT: 'outline',
  ACTIVE: 'default',
  ARCHIVED: 'secondary',
} as const

type ProductStatus = Database['public']['Enums']['product_status']

const ALL = '__all__'

export function ProductsListPage() {
  const queryClient = useQueryClient()
  const { data: products, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-products'],
    queryFn: getAdminProducts,
  })

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProductStatus | typeof ALL>(ALL)
  const [category, setCategory] = useState<string>(ALL)

  const categories = useMemo(
    () => [...new Set((products ?? []).map((p) => p.category))].sort(),
    [products],
  )

  const filtered = useMemo(() => {
    if (!products) return []
    const term = search.trim().toLowerCase()
    return products.filter((p) => {
      if (status !== ALL && p.status !== status) return false
      if (category !== ALL && p.category !== category) return false
      if (term && !p.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [products, search, status, category])

  const remove = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast.success('Product deleted')
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
    onError: () => toast.error('Could not delete that product. Try again.'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Products</h1>
        <Button asChild size="sm">
          <Link to="/admin/products/new">
            <Plus className="size-4" /> New product
          </Link>
        </Button>
      </div>

      {!isLoading && !isError && !!products?.length && (
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56"
          />
          <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus | typeof ALL)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !products || products.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="No products yet"
          description="Create your first product to get the catalog started."
          action={
            <Button asChild size="sm">
              <Link to="/admin/products/new">New product</Link>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No products match" description="Try a different search or filter." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Link to={`/admin/products/${product.id}`} className="flex items-center gap-3">
                      <ProductImage
                        path={product.image_path}
                        alt={product.name}
                        className="size-10 shrink-0 rounded-md"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium hover:underline">{product.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {product.collection_title ?? 'No collection'}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{product.category}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[product.status]}>{product.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatBDT(product.price_minor)}</TableCell>
                  <TableCell
                    className={`text-right ${product.total_stock === 0 ? 'text-destructive font-medium' : ''}`}
                  >
                    {product.total_stock}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the product, its variants, and its images. Past orders keep
                            their own snapshot of this product, so order history is unaffected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(product.id)}>
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
    </div>
  )
}
