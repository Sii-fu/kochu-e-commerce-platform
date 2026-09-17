-- 0001_extensions_enums.sql
-- Extensions and the enum vocabulary.
--
-- The old schema used free-text status columns validated only in application
-- code, which let `app/admin/page.tsx` filter on a 'paid' status that
-- `updateOrderStatus` did not accept. Enums make that unrepresentable.

-- pgcrypto is pinned to the `extensions` schema explicitly, matching where
-- hosted Supabase projects pre-install it (a bare local Postgres has no such
-- pre-install, so this line is what actually creates it there). Because it
-- already exists on the hosted project, `if not exists` is a no-op that
-- leaves it wherever it already was -- so the schema only matters when this
-- statement is the one doing the creating, but stating it explicitly keeps
-- both environments identical rather than relying on that coincidence.
-- `extensions` is not on every role's default search_path, which is why the
-- one gen_random_bytes() call site in 0004_commerce.sql is schema-qualified.
-- gen_random_uuid() needs no such qualification: it has been built into
-- Postgres core (pg_catalog) since v13.
--
-- citext and pg_trgm are NOT pre-installed by Supabase, so they are left
-- unqualified and land in `public` on both environments -- qualifying them
-- would mean schema-qualifying every citext column and every gin_trgm_ops
-- index for no benefit.
create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
create extension if not exists citext;
create extension if not exists pg_trgm;

create type user_role      as enum ('customer', 'admin');

create type product_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');

create type order_status   as enum (
  'PENDING_PAYMENT',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED'
);

create type payment_status as enum (
  'UNPAID',
  'AWAITING_VERIFICATION',
  'PAID',
  'REFUNDED',
  'FAILED'
);

create type payment_method as enum ('COD', 'BKASH', 'NAGAD');

create type mfs_status     as enum ('SUBMITTED', 'VERIFIED', 'REJECTED');

create type discount_type  as enum ('PERCENT', 'FIXED');
