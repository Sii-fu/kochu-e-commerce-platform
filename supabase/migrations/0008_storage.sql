-- 0008_storage.sql
-- Storage buckets and their policies.
--
-- The catalog buckets are public-read, served straight from the CDN via
-- getPublicUrl(). This deletes the old /api/images proxy entirely -- that
-- route was an unauthenticated passthrough to "private" Vercel blobs with
-- `Cache-Control: public, immutable`, i.e. private in name only, with an
-- extra hop of latency. No image proxy is to be reintroduced.

-- `collections` is a fifth bucket the plan did not anticipate: collection
-- cover art needs a home, and filing it under products/ or drops/ would make
-- the path convention lie about what the object is. It is governed by exactly
-- the same policies as the other catalog buckets.
insert into storage.buckets (id, name, public)
values
  ('products',     'products',     true),
  ('collections',  'collections',  true),
  ('articles',     'articles',     true),
  ('drops',        'drops',        true),
  ('mfs-receipts', 'mfs-receipts', false)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- Catalog buckets: world-readable, admin-writable.
-- Paths are products/{product_id}/{uuid}.webp so a product folder can be
-- cleared in one call.
-- ---------------------------------------------------------------------------
create policy catalog_public_read
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('products', 'collections', 'articles', 'drops'));

create policy catalog_admin_insert
  on storage.objects for insert to authenticated
  with check (bucket_id in ('products', 'collections', 'articles', 'drops') and is_admin());

create policy catalog_admin_update
  on storage.objects for update to authenticated
  using (bucket_id in ('products', 'collections', 'articles', 'drops') and is_admin())
  with check (bucket_id in ('products', 'collections', 'articles', 'drops') and is_admin());

create policy catalog_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id in ('products', 'collections', 'articles', 'drops') and is_admin());


-- ---------------------------------------------------------------------------
-- MFS receipts: write-only for the public, readable only by admins.
--
-- Guests pay too, so anon must be able to upload a payment screenshot. They
-- must never be able to read the bucket back -- receipts carry phone numbers
-- and partial account details.
-- ---------------------------------------------------------------------------
create policy mfs_receipt_insert_public
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'mfs-receipts');

create policy mfs_receipt_select_admin
  on storage.objects for select to authenticated
  using (bucket_id = 'mfs-receipts' and is_admin());

create policy mfs_receipt_delete_admin
  on storage.objects for delete to authenticated
  using (bucket_id = 'mfs-receipts' and is_admin());
