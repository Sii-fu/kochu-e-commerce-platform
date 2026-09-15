-- 0009_indexes_analytics.sql
-- Indexes and the admin analytics surface.
--
-- Note on shape: the plan called for an `admin_dashboard_stats` VIEW. It is
-- implemented as a SECURITY DEFINER function instead. A view would either
-- run with security_invoker=true (and then silently return a *customer's own*
-- numbers when a customer queries it -- confusing, and a foot-gun if it ever
-- backs a shared component) or bypass RLS entirely. A guarded function states
-- the access rule in one place, consistent with every other privileged path.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index products_status_created_idx   on products (status, created_at desc);
create index products_collection_idx       on products (collection_id) where status = 'ACTIVE';
create index products_drop_idx             on products (drop_id) where drop_id is not null;
create index products_featured_idx         on products (is_featured) where status = 'ACTIVE' and is_featured;
create index products_search_tsv_idx       on products using gin (search_tsv);
create index products_name_trgm_idx        on products using gin (name gin_trgm_ops);
create index products_category_idx         on products (category) where status = 'ACTIVE';

create index product_variants_product_idx  on product_variants (product_id);
create index product_variants_low_stock_idx on product_variants (stock) where is_active;
create index product_images_product_idx    on product_images (product_id, sort_order);

create index orders_user_placed_idx        on orders (user_id, placed_at desc);
create index orders_status_placed_idx      on orders (status, placed_at desc);
create index orders_payment_queue_idx      on orders (payment_status, placed_at desc)
  where payment_status = 'AWAITING_VERIFICATION';
create index orders_placed_at_idx          on orders (placed_at desc);

create index order_items_order_idx         on order_items (order_id);
create index order_items_product_idx       on order_items (product_id);

create index mfs_queue_idx                 on mfs_transactions (status, created_at desc);
create index mfs_order_idx                 on mfs_transactions (order_id);

create index articles_published_idx        on articles (is_published, published_at desc);
create index drops_published_start_idx     on drops (is_published, starts_at);
create index drop_access_user_idx          on drop_access (user_id);
create index collections_active_sort_idx   on collections (is_active, sort_order);


-- ---------------------------------------------------------------------------
-- admin_dashboard_stats: KPI tiles + inventory alerts in one round trip.
-- Revenue counts only orders that were actually paid or fulfilled, so an
-- unverified bKash order is not booked as income -- the old admin page summed
-- every order regardless of payment state.
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(p_days, 1));
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  return jsonb_build_object(
    'revenue_minor', coalesce((
      select sum(total_minor) from orders
      where status <> 'CANCELLED'
        and (payment_status = 'PAID' or status in ('SHIPPED', 'DELIVERED'))
    ), 0),
    'revenue_period_minor', coalesce((
      select sum(total_minor) from orders
      where placed_at >= v_since
        and status <> 'CANCELLED'
        and (payment_status = 'PAID' or status in ('SHIPPED', 'DELIVERED'))
    ), 0),
    'orders_total',     (select count(*) from orders),
    'orders_period',    (select count(*) from orders where placed_at >= v_since),
    'orders_open',      (select count(*) from orders
                          where status in ('PENDING_PAYMENT', 'PROCESSING', 'SHIPPED')),
    'orders_delivered', (select count(*) from orders where status = 'DELIVERED'),
    'orders_cancelled', (select count(*) from orders where status = 'CANCELLED'),
    'awaiting_verification', (select count(*) from mfs_transactions where status = 'SUBMITTED'),
    'customers',        (select count(*) from profiles where role = 'customer'),
    'early_access',     (select count(*) from early_access),
    'low_stock', coalesce((
      select jsonb_agg(x order by x ->> 'stock')
      from (
        select jsonb_build_object(
                 'variant_id', v.id,
                 'product_id', p.id,
                 'product_name', p.name,
                 'variant_label', v.label,
                 'slug', p.slug,
                 'stock', v.stock
               ) as x
        from product_variants v
        join products p on p.id = v.product_id
        where v.is_active
          and p.status = 'ACTIVE'
          and v.stock <= 5
        order by v.stock
        limit 20
      ) s
    ), '[]'::jsonb),
    'revenue_series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'revenue_minor', d.rev, 'orders', d.cnt)
                       order by d.day)
      from (
        select date_trunc('day', placed_at)::date as day,
               sum(total_minor) filter (
                 where status <> 'CANCELLED'
                   and (payment_status = 'PAID' or status in ('SHIPPED', 'DELIVERED'))
               ) as rev,
               count(*) as cnt
        from orders
        where placed_at >= v_since
        group by 1
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_dashboard_stats(integer) from public, anon;
grant execute on function public.admin_dashboard_stats(integer) to authenticated;
