import { supabase } from '../client'
import { toMinor } from '@/lib/money'
import type {
  ArticleInput,
  CollectionInput,
  DiscountCodeInput,
  DropInput,
  ProductInput,
  StoreSettingsInput,
  VariantInput,
} from '@/lib/validation/admin'
import { removeCatalogImage, uploadCatalogImage } from '../storage'
import type { Database } from '../types'

/**
 * Admin CRUD writes. Every table here is `is_admin()`-gated in
 * 0007_rls.sql -- a plain `.insert()/.update()/.delete()` is the correct and
 * only path (no RPC exists for these, unlike orders/stock). The three
 * genuinely privileged operations that DO have RPCs
 * (admin_update_order_status, verify_mfs_transaction, grant_drop_access) are
 * already wrapped in src/lib/supabase/rpc.ts -- reuse those, don't
 * reimplement them as direct table writes here.
 */

// ---------------------------------------------------------------------------
// Products + variants
// ---------------------------------------------------------------------------

function productRow(input: ProductInput) {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description || null,
    details: input.details || null,
    category: input.category,
    collection_id: input.collectionId || null,
    drop_id: input.dropId || null,
    price_minor: toMinor(input.priceTaka),
    compare_at_minor: input.compareAtTaka ? toMinor(input.compareAtTaka) : null,
    status: input.status,
    is_featured: input.isFeatured,
  }
}

/**
 * Reconciles the variant rows for a product against the form's current list:
 * anything with an `id` is updated, anything without one is inserted, and
 * any existing row whose id no longer appears in the form is deleted.
 * `sort_order` is just the form's own row order.
 */
async function syncVariants(productId: string, variants: VariantInput[]) {
  const keepIds = variants.filter((v) => v.id).map((v) => v.id as string)

  const deleteQuery = supabase.from('product_variants').delete().eq('product_id', productId)
  const { error: deleteError } =
    keepIds.length > 0 ? await deleteQuery.not('id', 'in', `(${keepIds.join(',')})`) : await deleteQuery

  if (deleteError) throw deleteError

  for (const [index, variant] of variants.entries()) {
    const row = {
      product_id: productId,
      label: variant.label,
      sku: variant.sku || null,
      price_delta_minor: toMinor(variant.priceDeltaTaka),
      stock: variant.stock,
      is_active: variant.isActive,
      sort_order: index,
    }

    const { error } = variant.id
      ? await supabase.from('product_variants').update(row).eq('id', variant.id)
      : await supabase.from('product_variants').insert(row)

    if (error) throw error
  }
}

export async function createProduct(input: ProductInput): Promise<string> {
  const { data, error } = await supabase.from('products').insert(productRow(input)).select('id').single()
  if (error) throw error

  await syncVariants(data.id, input.variants)
  return data.id
}

export async function updateProduct(id: string, input: ProductInput): Promise<string> {
  const { error } = await supabase.from('products').update(productRow(input)).eq('id', id)
  if (error) throw error

  await syncVariants(id, input.variants)
  return id
}

/** Best-effort storage cleanup -- the DB rows cascade on their own via the product_id FK. */
export async function deleteProduct(id: string): Promise<void> {
  const { data: images } = await supabase.from('product_images').select('path').eq('product_id', id)
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error

  await Promise.allSettled((images ?? []).map((img) => removeCatalogImage('products', img.path)))
}

export async function addProductImage(productId: string, file: File, nextSortOrder: number) {
  const path = await uploadCatalogImage('products', productId, file)
  const { error } = await supabase
    .from('product_images')
    .insert({ product_id: productId, path, sort_order: nextSortOrder })
  if (error) throw error
}

export async function removeProductImage(imageId: string, path: string) {
  const { error } = await supabase.from('product_images').delete().eq('id', imageId)
  if (error) throw error
  await removeCatalogImage('products', path)
}

export async function reorderProductImages(images: { id: string; sort_order: number }[]) {
  await Promise.all(
    images.map(({ id, sort_order }) =>
      supabase.from('product_images').update({ sort_order }).eq('id', id).then(({ error }) => {
        if (error) throw error
      }),
    ),
  )
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

function collectionRow(input: CollectionInput) {
  return {
    slug: input.slug,
    title: input.title,
    description: input.description || null,
    season: input.season || null,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  }
}

export async function createCollection(input: CollectionInput): Promise<string> {
  const { data, error } = await supabase
    .from('collections')
    .insert(collectionRow(input))
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateCollection(id: string, input: CollectionInput) {
  const { error } = await supabase.from('collections').update(collectionRow(input)).eq('id', id)
  if (error) throw error
}

export async function updateCollectionCover(id: string, file: File) {
  const path = await uploadCatalogImage('collections', id, file)
  const { error } = await supabase.from('collections').update({ cover_image: path }).eq('id', id)
  if (error) throw error
}

export async function deleteCollection(id: string) {
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

function dropRow(input: DropInput) {
  return {
    slug: input.slug,
    title: input.title,
    description: input.description || null,
    starts_at: new Date(input.startsAt).toISOString(),
    ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    early_access_at: input.earlyAccessAt ? new Date(input.earlyAccessAt).toISOString() : null,
    access_key: input.accessKey || null,
    is_published: input.isPublished,
  }
}

export async function createDrop(input: DropInput): Promise<string> {
  const { data, error } = await supabase.from('drops').insert(dropRow(input)).select('id').single()
  if (error) throw error
  return data.id
}

export async function updateDrop(id: string, input: DropInput) {
  const { error } = await supabase.from('drops').update(dropRow(input)).eq('id', id)
  if (error) throw error
}

export async function updateDropCover(id: string, file: File) {
  const path = await uploadCatalogImage('drops', id, file)
  const { error } = await supabase.from('drops').update({ cover_image: path }).eq('id', id)
  if (error) throw error
}

export async function deleteDrop(id: string) {
  const { error } = await supabase.from('drops').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

function articleRow(input: ArticleInput, existingPublishedAt: string | null) {
  return {
    slug: input.slug,
    title: input.title,
    abstract: input.abstract,
    content: input.content,
    collection_id: input.collectionId || null,
    is_published: input.isPublished,
    // articles_published_has_date (0005_content.sql) requires published_at
    // whenever is_published is true -- set it the first time, never clear it
    // on a later edit so the original publish date sticks.
    published_at: input.isPublished ? (existingPublishedAt ?? new Date().toISOString()) : existingPublishedAt,
  }
}

export async function createArticle(input: ArticleInput): Promise<string> {
  const { data, error } = await supabase
    .from('articles')
    .insert(articleRow(input, null))
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateArticle(
  id: string,
  input: ArticleInput,
  existingPublishedAt: string | null,
): Promise<string> {
  const { error } = await supabase
    .from('articles')
    .update(articleRow(input, existingPublishedAt))
    .eq('id', id)
  if (error) throw error
  return id
}

export async function updateArticleFeaturedImage(id: string, file: File) {
  const path = await uploadCatalogImage('articles', id, file)
  const { error } = await supabase.from('articles').update({ featured_image: path }).eq('id', id)
  if (error) throw error
}

export async function deleteArticle(id: string) {
  const { error } = await supabase.from('articles').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Discount codes
// ---------------------------------------------------------------------------

function discountCodeRow(input: DiscountCodeInput) {
  return {
    code: input.code.trim().toUpperCase(),
    description: input.description || null,
    type: input.type,
    // PERCENT is a plain 1-100 integer; FIXED is a taka amount converted to
    // poisha. Two different units share one DB column -- see 0004_commerce.sql.
    value: input.type === 'FIXED' ? toMinor(input.value) : Math.round(input.value),
    min_order_minor: toMinor(input.minOrderTaka),
    max_uses: input.maxUses ?? null,
    starts_at: input.startsAt ? new Date(input.startsAt).toISOString() : null,
    expires_at: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    is_active: input.isActive,
  }
}

export async function createDiscountCode(input: DiscountCodeInput) {
  const { error } = await supabase.from('discount_codes').insert(discountCodeRow(input))
  if (error) throw error
}

export async function updateDiscountCode(id: string, input: DiscountCodeInput) {
  const { error } = await supabase.from('discount_codes').update(discountCodeRow(input)).eq('id', id)
  if (error) throw error
}

export async function deleteDiscountCode(id: string) {
  const { error } = await supabase.from('discount_codes').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Store settings -- always exactly one row (id boolean primary key default true).
// ---------------------------------------------------------------------------

export async function updateStoreSettings(input: StoreSettingsInput) {
  const { error } = await supabase
    .from('store_settings')
    .update({
      free_shipping_threshold_minor: toMinor(input.freeShippingThresholdTaka),
      flat_shipping_minor: toMinor(input.flatShippingTaka),
      bkash_number: input.bkashNumber || null,
      nagad_number: input.nagadNumber || null,
      support_email: input.supportEmail || null,
      support_phone: input.supportPhone || null,
      announcement: input.announcement || null,
    })
    .eq('id', true)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/**
 * `profiles_guard_role` (0002_profiles_rbac.sql) additionally requires
 * `is_admin()` on any row where `role` changes -- satisfied here since only
 * an authenticated admin ever reaches this call, same policy that gates the
 * plain `.update()` itself.
 */
export async function updateCustomerRole(
  userId: string,
  role: Database['public']['Enums']['user_role'],
) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
}
