import { supabase } from '../client'
import type { Database } from '../types'

/**
 * Admin-scoped reads. Unlike src/lib/supabase/queries.ts (which filters to
 * what a customer may see -- `status=eq.ACTIVE`, `is_published=eq.true`,
 * etc.), everything here relies on `is_admin()`-gated RLS (0007_rls.sql) to
 * return every row regardless of status. These queries would return nothing
 * useful -- or, if a policy were ever loosened, leak DRAFT/unpublished rows --
 * to anyone who isn't an admin, so nothing here re-implements that check;
 * the database is what actually decides.
 */

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function getAdminProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, slug, name, category, status, price_minor, compare_at_minor, is_featured, created_at,
       collections!products_collection_id_fkey(title),
       product_images(path, sort_order),
       product_variants(stock, is_active)`,
    )
    .order('created_at', { ascending: false })

  if (error) throw error

  return data.map((p) => {
    const images = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      status: p.status,
      price_minor: p.price_minor,
      compare_at_minor: p.compare_at_minor,
      is_featured: p.is_featured,
      created_at: p.created_at,
      collection_title: p.collections?.title ?? null,
      image_path: images[0]?.path ?? null,
      total_stock: p.product_variants.reduce((sum, v) => sum + (v.is_active ? v.stock : 0), 0),
      variant_count: p.product_variants.length,
    }
  })
}

export async function getAdminProductById(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select(
      `*,
       product_images(id, path, alt, sort_order),
       product_variants(id, label, sku, price_delta_minor, stock, is_active, sort_order)`,
    )
    .eq('id', id)
    .single()

  if (error) throw error

  return {
    ...data,
    product_images: [...data.product_images].sort((a, b) => a.sort_order - b.sort_order),
    product_variants: [...data.product_variants].sort((a, b) => a.sort_order - b.sort_order),
  }
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function getAdminCollections() {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

export async function getAdminDrops() {
  const { data, error } = await supabase
    .from('drops')
    .select('*')
    .order('starts_at', { ascending: false })

  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export async function getAdminArticles() {
  const { data, error } = await supabase
    .from('articles')
    .select('id, slug, title, is_published, published_at, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getAdminArticleById(id: string) {
  const { data, error } = await supabase.from('articles').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Discount codes
// ---------------------------------------------------------------------------

export async function getAdminDiscountCodes() {
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type AdminOrderListRow = {
  id: string
  order_number: string
  customer_name: string
  guest_email: string | null
  user_id: string | null
  status: Database['public']['Enums']['order_status']
  payment_method: Database['public']['Enums']['payment_method']
  payment_status: Database['public']['Enums']['payment_status']
  total_minor: number
  placed_at: string
}

export async function getAdminOrders(status?: Database['public']['Enums']['order_status']) {
  let query = supabase
    .from('orders')
    .select(
      'id, order_number, customer_name, guest_email, user_id, status, payment_method, payment_status, total_minor, placed_at',
    )
    .order('placed_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  return data as AdminOrderListRow[]
}

/** Full row, admin_note included -- customer-facing queries deliberately strip it. */
export async function getAdminOrderById(id: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `*, order_items(*), mfs_transactions(id, provider, trx_id, sender_msisdn, amount_minor, status, receipt_path, reviewed_at, review_note, created_at)`,
    )
    .eq('id', id)
    .single()

  if (error) throw error

  const { mfs_transactions, ...rest } = data
  const payments = [...mfs_transactions].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return { ...rest, mfs_transactions: payments }
}

// ---------------------------------------------------------------------------
// MFS verification queue -- the highest-value screen in the admin panel.
// ---------------------------------------------------------------------------

export async function getMfsQueue() {
  const { data, error } = await supabase
    .from('mfs_transactions')
    .select(
      `id, provider, trx_id, sender_msisdn, amount_minor, receipt_path, created_at,
       orders!inner(id, order_number, customer_name, guest_email, total_minor, placed_at)`,
    )
    .eq('status', 'SUBMITTED')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function getAdminCustomers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}
