import { supabase } from './client'

export type CatalogBucket = 'products' | 'collections' | 'articles' | 'drops'

/**
 * Uploads to one of the four public catalog buckets. `0008_storage.sql`
 * grants admins insert/update/delete on all four, gated by `is_admin()` --
 * there's no server-side path restriction, so the `{bucket}/{entityId}/{uuid}.ext`
 * convention documented in CLAUDE.md is enforced here, not in the database.
 *
 * Stores the object path, never a full URL -- `<ProductImage>` and every
 * other reader calls `getPublicUrl()` itself.
 */
export async function uploadCatalogImage(
  bucket: CatalogBucket,
  entityId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'webp'
  const path = `${entityId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw error

  return path
}

export async function removeCatalogImage(bucket: CatalogBucket, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}

export function catalogImageUrl(bucket: CatalogBucket, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/**
 * `mfs-receipts` is the one private bucket -- "anyone may insert (guests pay
 * too), only admins may select" (CLAUDE.md). A signed URL is the only way to
 * view one, and it only succeeds because the caller's own admin session
 * passes the bucket's select policy; there's no separate check here.
 */
export async function getMfsReceiptUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('mfs-receipts')
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}
