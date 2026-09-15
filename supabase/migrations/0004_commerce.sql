-- 0004_commerce.sql
-- Addresses, discount codes, orders, order items, MFS transactions.
--
-- All money is integer poisha (1 BDT = 100 poisha) in a column named *_minor.
-- The old schema used numeric(10,2) read into JS as Number, which is the
-- source of every rounding hazard in a cart total.

create table addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text,
  recipient   text not null,
  phone       text not null,
  line1       text not null,
  line2       text,
  city        text not null,
  district    text,
  postal_code text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- At most one default address per user.
create unique index addresses_one_default_per_user
  on addresses (user_id)
  where is_default;

create table discount_codes (
  id              uuid primary key default gen_random_uuid(),
  code            citext not null unique,
  description     text,
  type            discount_type not null,
  value           integer not null check (value > 0),  -- percent 1-100, or poisha
  min_order_minor integer not null default 0 check (min_order_minor >= 0),
  max_uses        integer check (max_uses > 0),
  used_count      integer not null default 0 check (used_count >= 0),
  starts_at       timestamptz,
  expires_at      timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint discount_percent_in_range
    check (type <> 'PERCENT' or value between 1 and 100),
  constraint discount_window_valid
    check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table orders (
  id           uuid primary key default gen_random_uuid(),

  -- Human-facing reference. Random suffix so order volume is not inferable.
  order_number text not null unique
    default 'KCH-' || to_char(now(), 'YYMMDD') || '-' ||
            upper(encode(gen_random_bytes(3), 'hex')),

  -- null user_id = guest order. Reachable only via get_order_by_token().
  user_id      uuid references auth.users(id) on delete set null,
  guest_token  uuid not null default gen_random_uuid(),
  guest_email  citext,

  customer_name    text not null,
  phone            text not null,
  shipping_address jsonb not null,   -- snapshot, never a live FK

  status         order_status   not null default 'PENDING_PAYMENT',
  payment_method payment_method not null,
  payment_status payment_status not null default 'UNPAID',

  subtotal_minor integer not null check (subtotal_minor >= 0),
  discount_minor integer not null default 0 check (discount_minor >= 0),
  shipping_minor integer not null default 0 check (shipping_minor >= 0),
  total_minor    integer not null check (total_minor >= 0),
  discount_code  citext,

  -- UNIQUE is what makes checkout replay-safe. The old column had no
  -- constraint, so the "check then insert" guard was a race, not a guarantee.
  idempotency_key text not null unique,

  admin_note    text,
  tracking_code text,
  courier       text,

  placed_at     timestamptz not null default now(),
  processing_at timestamptz,
  shipped_at    timestamptz,
  delivered_at  timestamptz,
  cancelled_at  timestamptz,

  -- Guards against a second cancel double-restoring inventory.
  stock_released boolean not null default false,

  constraint orders_total_is_consistent
    check (total_minor = subtotal_minor - discount_minor + shipping_minor),
  constraint orders_discount_within_subtotal
    check (discount_minor <= subtotal_minor)
);

create table order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,

  -- set null, not cascade: deleting a product must never erase order history.
  -- The old schema had no FK at all, so deleteProduct left orphan rows.
  variant_id uuid references product_variants(id) on delete set null,
  product_id uuid references products(id) on delete set null,

  -- Snapshots, so history stays readable after a product is deleted.
  product_name  text not null,
  variant_label text not null,
  image_path    text,

  unit_price_minor integer not null check (unit_price_minor >= 0),
  quantity         integer not null check (quantity between 1 and 99),
  line_total_minor integer not null check (line_total_minor >= 0),

  constraint order_items_line_total_is_consistent
    check (line_total_minor = unit_price_minor * quantity)
);

create table mfs_transactions (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  provider      payment_method not null,
  trx_id        text not null,
  sender_msisdn text not null,
  amount_minor  integer not null check (amount_minor >= 0),
  receipt_path  text,            -- optional screenshot in the private bucket
  status        mfs_status not null default 'SUBMITTED',
  reviewer_id   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now(),

  constraint mfs_provider_is_mobile_money
    check (provider in ('BKASH', 'NAGAD')),

  -- Blocks the same receipt being submitted against two orders.
  constraint mfs_trx_unique_per_provider unique (provider, trx_id)
);

comment on table mfs_transactions is
  'Manual mobile financial services reconciliation. This is a trust workflow,
   not a payment gateway: the unique (provider, trx_id) constraint stops
   receipt reuse, but a fabricated TrxID is only caught by a human checking
   the merchant app. Always log reviewer_id.';
