import { supabase } from './client'
import type { Database } from './types'

/**
 * Typed read helpers, grouped by feature as the catalog grows. Nothing here
 * writes -- writes to money/stock tables go through src/lib/supabase/rpc.ts,
 * and everything else goes through a plain `.insert()`/`.update()` call at
 * its call site, gated by RLS.
 *
 * Every catalog read relies entirely on RLS to filter what's visible (a
 * DRAFT/ARCHIVED product, an unpublished drop's items, a not-yet-open drop) --
 * see products_select_public etc. in 0007_rls.sql. Nothing here re-implements
 * that filtering; a query that fetched everything and filtered client-side
 * would both leak data over the wire and drift from the DB's actual rules.
 */

export type ProductWithImage = {
  id: string
  slug: string
  name: string
  category: string
  price_minor: number
  compare_at_minor: number | null
  is_featured: boolean
  created_at: string
  image_path: string | null
  image_alt: string | null
  variants: { stock: number; is_active: boolean }[]
}

export type ShopFilters = {
  category?: string
  collectionSlug?: string
  minPriceMinor?: number
  maxPriceMinor?: number
  inStockOnly?: boolean
  sort?: 'newest' | 'price-asc' | 'price-desc'
  search?: string
  page: number
  pageSize: number
}

/**
 * The shop grid query. In-stock filtering happens client-side after the fetch
 * (`inStockOnly` below) rather than as a DB predicate, because "in stock"
 * means "has >=1 active variant with stock>0", which needs the variants
 * already joined -- filtering it in SQL would need a subquery per row anyway,
 * and the page sizes here are small enough that it doesn't matter.
 */
export async function getShopProducts(filters: ShopFilters) {
  // A plain (left-join) embed can't filter parent rows by an embedded
  // column -- PostgREST only honours that with `!inner`. Using `!inner`
  // unconditionally would turn every product with no collection into a
  // dropped row, so the join type is picked based on whether this filter is
  // actually in use.
  const collectionsJoin = filters.collectionSlug
    ? 'collections!products_collection_id_fkey!inner(slug)'
    : 'collections!products_collection_id_fkey(slug)'

  let query = supabase
    .from('products')
    .select(
      `id, slug, name, category, price_minor, compare_at_minor, is_featured, created_at,
       product_images(path, alt, sort_order),
       product_variants(stock, is_active),
       ${collectionsJoin}`,
      { count: 'exact' },
    )
    .eq('status', 'ACTIVE')

  if (filters.category) query = query.eq('category', filters.category)
  if (filters.collectionSlug) query = query.eq('collections.slug', filters.collectionSlug)
  if (filters.minPriceMinor != null) query = query.gte('price_minor', filters.minPriceMinor)
  if (filters.maxPriceMinor != null) query = query.lte('price_minor', filters.maxPriceMinor)
  if (filters.search) {
    // search_tsv (0003_catalog.sql) is generated with to_tsvector('simple', ...)
    // -- the config here has to match, or 'simple' vs the client default
    // ('english', which stems/removes stopwords) silently changes what
    // matches.
    query = query.textSearch('search_tsv', filters.search, {
      type: 'websearch',
      config: 'simple',
    })
  }

  switch (filters.sort) {
    case 'price-asc':
      query = query.order('price_minor', { ascending: true })
      break
    case 'price-desc':
      query = query.order('price_minor', { ascending: false })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  const from = filters.page * filters.pageSize
  const to = from + filters.pageSize - 1
  const { data, error, count } = await query.range(from, to)

  if (error) throw error

  let products: ProductWithImage[] = (data ?? []).map((p) => {
    const images = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      price_minor: p.price_minor,
      compare_at_minor: p.compare_at_minor,
      is_featured: p.is_featured,
      created_at: p.created_at,
      image_path: images[0]?.path ?? null,
      image_alt: images[0]?.alt ?? null,
      variants: p.product_variants,
    }
  })

  if (filters.inStockOnly) {
    products = products.filter((p) => p.variants.some((v) => v.is_active && v.stock > 0))
  }

  return { products, total: count ?? 0 }
}

export async function getProductBySlug(slug: string) {
  const { data, error } = await supabase
    .from('products')
    .select(
      `*,
       product_images(id, path, alt, sort_order),
       product_variants(id, label, price_delta_minor, stock, is_active, sort_order),
       collections!products_collection_id_fkey(slug, title)`,
    )
    .eq('slug', slug)
    .eq('status', 'ACTIVE')
    .single()

  if (error) throw error

  return {
    ...data,
    product_images: [...data.product_images].sort((a, b) => a.sort_order - b.sort_order),
    product_variants: [...data.product_variants].sort((a, b) => a.sort_order - b.sort_order),
  }
}

/** Same collection, excluding the current product. Used by the PDP's related rail. */
export async function getRelatedProducts(collectionId: string, excludeProductId: string) {
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, slug, name, category, price_minor, compare_at_minor, is_featured, created_at,
       product_images(path, alt, sort_order),
       product_variants(stock, is_active)`,
    )
    .eq('status', 'ACTIVE')
    .eq('collection_id', collectionId)
    .neq('id', excludeProductId)
    .limit(4)

  if (error) throw error

  return (data ?? []).map((p) => {
    const images = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      price_minor: p.price_minor,
      compare_at_minor: p.compare_at_minor,
      is_featured: p.is_featured,
      created_at: p.created_at,
      image_path: images[0]?.path ?? null,
      image_alt: images[0]?.alt ?? null,
      variants: p.product_variants,
    } satisfies ProductWithImage
  })
}

export async function getFeaturedProducts(limit = 4) {
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, slug, name, category, price_minor, compare_at_minor, is_featured, created_at,
       product_images(path, alt, sort_order),
       product_variants(stock, is_active)`,
    )
    .eq('status', 'ACTIVE')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((p) => {
    const images = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      price_minor: p.price_minor,
      compare_at_minor: p.compare_at_minor,
      is_featured: p.is_featured,
      created_at: p.created_at,
      image_path: images[0]?.path ?? null,
      image_alt: images[0]?.alt ?? null,
      variants: p.product_variants,
    } satisfies ProductWithImage
  })
}

export async function getCollections() {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}

export async function getCollectionBySlug(slug: string) {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) throw error
  return data
}

/**
 * Drops the current visitor can see. RLS (`drops_select_published_or_admin`)
 * already restricts to published rows -- this just adds the "live now" vs
 * "upcoming" vs "ended" split the /drops page renders as sections. An
 * upcoming drop is deliberately visible here (that's the countdown page);
 * its *products* stay invisible until the window opens, enforced separately
 * by the products RLS policy.
 *
 * Three buckets, not two: a drop whose ends_at has passed fails "is it live"
 * but is not upcoming either -- lumping it into "upcoming" would render a
 * countdown to a start time already in the past, which Countdown clamps to
 * "Live now" and shows for a drop that's actually over.
 */
export async function getDrops() {
  const { data, error } = await supabase
    .from('drops')
    .select('*')
    .order('starts_at', { ascending: true })

  if (error) throw error

  const now = Date.now()
  const status = (d: { starts_at: string; ends_at: string | null }) => {
    const started = new Date(d.starts_at).getTime() <= now
    const ended = d.ends_at != null && new Date(d.ends_at).getTime() < now
    if (ended) return 'ended'
    return started ? 'live' : 'upcoming'
  }

  return {
    live: data.filter((d) => status(d) === 'live'),
    upcoming: data.filter((d) => status(d) === 'upcoming'),
    ended: data.filter((d) => status(d) === 'ended'),
  }
}

export async function getDropBySlug(slug: string) {
  const { data, error } = await supabase.from('drops').select('*').eq('slug', slug).single()
  if (error) throw error
  return data
}

/** Products belonging to a drop. RLS hides them entirely until the window opens. */
export async function getDropProducts(dropId: string) {
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, slug, name, category, price_minor, compare_at_minor, is_featured, created_at,
       product_images(path, alt, sort_order),
       product_variants(stock, is_active)`,
    )
    .eq('status', 'ACTIVE')
    .eq('drop_id', dropId)

  if (error) throw error

  return (data ?? []).map((p) => {
    const images = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      price_minor: p.price_minor,
      compare_at_minor: p.compare_at_minor,
      is_featured: p.is_featured,
      created_at: p.created_at,
      image_path: images[0]?.path ?? null,
      image_alt: images[0]?.alt ?? null,
      variants: p.product_variants,
    } satisfies ProductWithImage
  })
}

export async function getArticles() {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getArticleBySlug(slug: string) {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error) throw error
  return data
}

export async function getDistinctCategories() {
  const { data, error } = await supabase.from('products').select('category').eq('status', 'ACTIVE')
  if (error) throw error
  return [...new Set((data ?? []).map((p) => p.category))].sort()
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function getAddresses(userId: string) {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * The single-row store config -- free shipping threshold, flat shipping
 * fee, and the bKash/Nagad merchant numbers the checkout MFS panel shows.
 * Never hardcode any of these; `store_settings_read_all` (0007_rls.sql)
 * makes this readable by anon so the checkout page can render it before
 * anyone signs in.
 */
export async function getStoreSettings() {
  const { data, error } = await supabase.from('store_settings').select('*').single()
  if (error) throw error
  return data
}

/**
 * Live variant + product state for every id currently in the cart, fetched
 * fresh whenever the drawer opens or checkout mounts. This is the only
 * thing `useCartValidation()` trusts -- the cart store itself is a display
 * snapshot that can go stale the moment another customer buys the last one.
 */
export async function getVariantsForCart(variantIds: string[]) {
  if (variantIds.length === 0) return []

  const { data, error } = await supabase
    .from('product_variants')
    .select('id, stock, is_active, price_delta_minor, products(price_minor, status)')
    .in('id', variantIds)

  if (error) throw error
  return data
}

/**
 * Customer-safe columns only -- never admin_note or the idempotency_key.
 * `guest_token` is included for the account order page's own use with
 * `submitMfsTransaction`/`MfsPaymentPanel` (which take an id+token pair
 * either way) -- not a new capability, since the owner reading this row at
 * all already means RLS has confirmed it's theirs.
 */
const ORDER_COLUMNS = `id, order_number, user_id, guest_token, guest_email, customer_name, phone,
  shipping_address, status, payment_method, payment_status,
  subtotal_minor, discount_minor, shipping_minor, total_minor, discount_code,
  tracking_code, courier, placed_at, processing_at, shipped_at, delivered_at,
  cancelled_at`

export type OrderRecord = {
  id: string
  order_number: string
  user_id: string | null
  guest_token: string
  guest_email: string | null
  customer_name: string
  phone: string
  shipping_address: Database['public']['Tables']['orders']['Row']['shipping_address']
  status: Database['public']['Enums']['order_status']
  payment_method: Database['public']['Enums']['payment_method']
  payment_status: Database['public']['Enums']['payment_status']
  subtotal_minor: number
  discount_minor: number
  shipping_minor: number
  total_minor: number
  discount_code: string | null
  tracking_code: string | null
  courier: string | null
  placed_at: string
  processing_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
}

export type OrderItemRecord = {
  id: string
  product_name: string
  variant_label: string
  image_path: string | null
  unit_price_minor: number
  quantity: number
  line_total_minor: number
}

export type MfsPaymentRecord = {
  id: string
  provider: Database['public']['Enums']['payment_method']
  trx_id: string
  sender_msisdn: string
  amount_minor: number
  status: Database['public']['Enums']['mfs_status']
  created_at: string
} | null

export type OrderDetail = {
  order: OrderRecord
  items: OrderItemRecord[]
  payment: MfsPaymentRecord
}

/** A signed-in customer's own order list. `orders_select_own_or_admin` (0007_rls.sql) is the real gate. */
export async function getUserOrders(userId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_method, payment_status, total_minor, placed_at')
    .eq('user_id', userId)
    .order('placed_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * A single order, for a signed-in owner. The `.eq('user_id', userId)` is
 * belt-and-suspenders on top of RLS: it's what turns "some other customer's
 * order id in the URL" into a clean not-found instead of relying solely on
 * the policy to reject it.
 */
export async function getUserOrderById(userId: string, orderId: string): Promise<OrderDetail> {
  const { data, error } = await supabase
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items(*), mfs_transactions(id, provider, trx_id, sender_msisdn, amount_minor, status, created_at)`)
    .eq('id', orderId)
    .eq('user_id', userId)
    .single()

  if (error) throw error

  const { order_items, mfs_transactions, ...order } = data
  const payment =
    [...mfs_transactions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null

  return { order: order as OrderRecord, items: order_items, payment }
}
