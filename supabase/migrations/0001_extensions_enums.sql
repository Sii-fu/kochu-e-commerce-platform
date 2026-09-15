-- 0001_extensions_enums.sql
-- Extensions and the enum vocabulary.
--
-- The old schema used free-text status columns validated only in application
-- code, which let `app/admin/page.tsx` filter on a 'paid' status that
-- `updateOrderStatus` did not accept. Enums make that unrepresentable.

create extension if not exists pgcrypto;   -- gen_random_uuid, gen_random_bytes
create extension if not exists citext;     -- case-insensitive email / codes
create extension if not exists pg_trgm;    -- fuzzy instant search

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
