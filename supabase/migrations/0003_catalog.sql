-- 0003_catalog.sql
-- Collections, drops, products, variants, images.
--
-- Two structural changes from the old schema:
--   1. Every product has at least one variant, even single-size items
--      ("One Size"). Stock lives in exactly one place, so there is no
--      "stock on product or on variant" branching anywhere in the codebase.
--   2. `product_variants.stock` carries CHECK (stock >= 0). The old
--      `products.stock` was a nullable integer with no constraint, so an
--      oversell would silently go negative.

create table collections (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  description text,
  cover_image text,
  season      text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table drops (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  description     text,
  cover_image     text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  early_access_at timestamptz,   -- drop_access holders shop from here
  access_key      text,          -- optional shared code for the VIP portal
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint drops_window_valid
    check (ends_at is null or ends_at > starts_at),
  constraint drops_early_access_precedes_start
    check (early_access_at is null or early_access_at <= starts_at)
);

create table products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  description      text,
  details          text,          -- care / materials, rendered separately
  category         text not null,
  collection_id    uuid references collections(id) on delete set null,
  drop_id          uuid references drops(id) on delete set null,
  price_minor      integer not null check (price_minor >= 0),
  compare_at_minor integer check (compare_at_minor >= 0),
  status           product_status not null default 'DRAFT',
  is_featured      boolean not null default false,
  search_tsv       tsvector generated always as (
                     to_tsvector(
                       'simple',
                       coalesce(name, '') || ' ' || coalesce(category, '')
                     )
                   ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint products_compare_at_above_price
    check (compare_at_minor is null or compare_at_minor > price_minor)
);

create trigger products_touch_updated_at
  before update on products
  for each row
  execute function public.touch_updated_at();

create table product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products(id) on delete cascade,
  label             text not null,          -- 'S' | 'M' | 'One Size'
  sku               text unique,
  price_delta_minor integer not null default 0,
  stock             integer not null default 0 check (stock >= 0),
  sort_order        int not null default 0,
  is_active         boolean not null default true,
  unique (product_id, label)
);

comment on column product_variants.stock is
  'The last line of defence against oversell. create_order() decrements this
   inside the same transaction that writes the order; the CHECK aborts the
   transaction if concurrency ever defeats the row lock.';

create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  path       text not null,   -- storage object path, not a proxy URL
  alt        text,
  sort_order int not null default 0
);

create table drop_access (
  drop_id    uuid not null references drops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (drop_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Drop visibility helpers. Used by the products RLS policy and re-checked
-- inside create_order(), so a drop item cannot be bought before its window
-- opens even if the client calls the RPC directly.
-- ---------------------------------------------------------------------------

create or replace function public.drop_is_live(p_drop uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select d.is_published
       and now() >= d.starts_at
       and (d.ends_at is null or now() <= d.ends_at)
    from drops d
    where d.id = p_drop
  ), false);
$$;

create or replace function public.has_early_access(p_drop uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from drop_access da
       where da.drop_id = p_drop
         and da.user_id = auth.uid()
     )
     and coalesce((
       select d.is_published
          and d.early_access_at is not null
          and now() >= d.early_access_at
          and (d.ends_at is null or now() <= d.ends_at)
       from drops d
       where d.id = p_drop
     ), false);
$$;

grant execute on function public.drop_is_live(uuid)     to anon, authenticated;
grant execute on function public.has_early_access(uuid) to anon, authenticated;
