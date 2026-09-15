-- 0007_rls.sql
-- Row-Level Security for every table.
--
-- Two rules shape this file:
--
--   1. Anything that touches money or stock -- orders, order_items,
--      mfs_transactions, product_variants.stock -- has NO insert or update
--      policy at all. Those tables are writable only through the
--      SECURITY DEFINER functions in 0006. A client holding the anon key
--      cannot write them by any route.
--
--   2. Everything else is is_admin() for writes plus a narrow read predicate.
--      No table gets a `using (true)` write policy.

alter table profiles         enable row level security;
alter table store_settings   enable row level security;
alter table collections      enable row level security;
alter table drops            enable row level security;
alter table products         enable row level security;
alter table product_variants enable row level security;
alter table product_images   enable row level security;
alter table drop_access      enable row level security;
alter table addresses        enable row level security;
alter table discount_codes   enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table mfs_transactions enable row level security;
alter table articles         enable row level security;
alter table early_access     enable row level security;


-- ===========================================================================
-- profiles
-- ===========================================================================
create policy profiles_select_self_or_admin
  on profiles for select to authenticated
  using (id = auth.uid() or is_admin());

-- A customer may edit their own profile. `role` is pinned by the
-- profiles_guard_role BEFORE UPDATE trigger in 0002 rather than by a WITH
-- CHECK subquery, which would recurse through this very policy.
create policy profiles_update_self
  on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin
  on profiles for update to authenticated
  using (is_admin())
  with check (is_admin());

-- No INSERT policy: rows are created only by the on_auth_user_created trigger.
-- No DELETE policy: profiles die with their auth.users row via FK cascade.


-- ===========================================================================
-- store_settings
-- ===========================================================================
create policy store_settings_read_all
  on store_settings for select to anon, authenticated
  using (true);

create policy store_settings_write_admin
  on store_settings for update to authenticated
  using (is_admin()) with check (is_admin());


-- ===========================================================================
-- collections
-- ===========================================================================
create policy collections_select_active_or_admin
  on collections for select to anon, authenticated
  using (is_active or is_admin());

create policy collections_write_admin
  on collections for all to authenticated
  using (is_admin()) with check (is_admin());


-- ===========================================================================
-- drops
--
-- An upcoming drop is deliberately VISIBLE -- that is the countdown page.
-- Its products stay hidden until the window opens, enforced by the products
-- policy below, not by hiding a button in the UI.
-- ===========================================================================
create policy drops_select_published_or_admin
  on drops for select to anon, authenticated
  using (is_published or is_admin());

create policy drops_write_admin
  on drops for all to authenticated
  using (is_admin()) with check (is_admin());


-- ===========================================================================
-- products
-- ===========================================================================
create policy products_select_public
  on products for select to anon, authenticated
  using (
    is_admin()
    or (
      status = 'ACTIVE'
      and (
        drop_id is null
        or drop_is_live(drop_id)
        or has_early_access(drop_id)
      )
    )
  );

create policy products_write_admin
  on products for all to authenticated
  using (is_admin()) with check (is_admin());


-- ===========================================================================
-- product_variants
--
-- SELECT mirrors the parent product's visibility. There is no customer-facing
-- UPDATE policy, so `stock` can only move through create_order() and
-- admin_update_order_status().
-- ===========================================================================
create policy product_variants_select_public
  on product_variants for select to anon, authenticated
  using (
    is_admin()
    or exists (
      select 1 from products p
      where p.id = product_id
        and p.status = 'ACTIVE'
        and (p.drop_id is null
             or drop_is_live(p.drop_id)
             or has_early_access(p.drop_id))
    )
  );

create policy product_variants_write_admin
  on product_variants for all to authenticated
  using (is_admin()) with check (is_admin());


-- ===========================================================================
-- product_images
-- ===========================================================================
create policy product_images_select_public
  on product_images for select to anon, authenticated
  using (
    is_admin()
    or exists (
      select 1 from products p
      where p.id = product_id
        and p.status = 'ACTIVE'
        and (p.drop_id is null
             or drop_is_live(p.drop_id)
             or has_early_access(p.drop_id))
    )
  );

create policy product_images_write_admin
  on product_images for all to authenticated
  using (is_admin()) with check (is_admin());


-- ===========================================================================
-- drop_access
-- ===========================================================================
create policy drop_access_select_self_or_admin
  on drop_access for select to authenticated
  using (user_id = auth.uid() or is_admin());

create policy drop_access_write_admin
  on drop_access for all to authenticated
  using (is_admin()) with check (is_admin());

-- Customers gain access only through redeem_drop_key() / grant_drop_access().


-- ===========================================================================
-- addresses
-- ===========================================================================
create policy addresses_select_own_or_admin
  on addresses for select to authenticated
  using (user_id = auth.uid() or is_admin());

create policy addresses_insert_own
  on addresses for insert to authenticated
  with check (user_id = auth.uid());

create policy addresses_update_own
  on addresses for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy addresses_delete_own
  on addresses for delete to authenticated
  using (user_id = auth.uid());


-- ===========================================================================
-- discount_codes
--
-- Never listable by customers -- otherwise the anon key becomes a coupon
-- dump. Validation goes through validate_discount(), which returns only the
-- outcome for one submitted code.
-- ===========================================================================
create policy discount_codes_admin_only
  on discount_codes for all to authenticated
  using (is_admin()) with check (is_admin());


-- ===========================================================================
-- orders
--
-- Guests are NOT covered here on purpose: an anonymous visitor reads their
-- order only through get_order_by_token(), which requires the secret token.
-- ===========================================================================
create policy orders_select_own_or_admin
  on orders for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- Admins may annotate an order directly; status changes still go through
-- admin_update_order_status() so the transition table is always enforced.
create policy orders_update_admin
  on orders for update to authenticated
  using (is_admin()) with check (is_admin());

-- No INSERT policy for anyone. create_order() is the only writer.
-- No DELETE policy for anyone. Orders are cancelled, never deleted.


-- ===========================================================================
-- order_items
-- ===========================================================================
create policy order_items_select_via_order
  on order_items for select to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or is_admin())
    )
  );

-- No write policies at all. Items are written only by create_order().


-- ===========================================================================
-- mfs_transactions
-- ===========================================================================
create policy mfs_select_own_or_admin
  on mfs_transactions for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from orders o
      where o.id = order_id
        and o.user_id = auth.uid()
    )
  );

-- No write policies. submit_mfs_transaction() and verify_mfs_transaction()
-- are the only writers, and both re-check authorization internally.


-- ===========================================================================
-- articles
-- ===========================================================================
create policy articles_select_published_or_admin
  on articles for select to anon, authenticated
  using (is_published or is_admin());

create policy articles_write_admin
  on articles for all to authenticated
  using (is_admin()) with check (is_admin());


-- ===========================================================================
-- early_access
--
-- Public signup is the point of the table. Reads are admin-only so the list
-- is not harvestable with the anon key.
-- ===========================================================================
create policy early_access_insert_public
  on early_access for insert to anon, authenticated
  with check (true);

create policy early_access_select_admin
  on early_access for select to authenticated
  using (is_admin());

create policy early_access_delete_admin
  on early_access for delete to authenticated
  using (is_admin());


-- ===========================================================================
-- Table privileges
--
-- RLS only filters rows a role is already permitted to touch. Without a
-- GRANT, PostgREST returns "permission denied" and the policies above are
-- moot; with a blanket GRANT, a table that ever loses its policies is wide
-- open. Supabase's default privileges would cover most of this implicitly --
-- stating it explicitly keeps both layers least-privilege and makes the
-- intent reviewable.
--
-- Note there is no INSERT/UPDATE/DELETE grant anywhere for orders,
-- order_items or mfs_transactions, for either role. Those tables are
-- writable only by the SECURITY DEFINER functions in 0006, which execute as
-- the owner and are unaffected by these grants.
-- ===========================================================================
revoke all on all tables in schema public from anon, authenticated;

-- Public catalog and content: read-only for everyone.
grant select on
  store_settings, collections, drops, products, product_variants,
  product_images, articles
to anon, authenticated;

-- Signed-in customers.
grant select on profiles, drop_access, orders, order_items, mfs_transactions
  to authenticated;
grant update on profiles to authenticated;
grant select, insert, update, delete on addresses to authenticated;

-- Public signup surface (insert only -- the list is not readable by anon).
grant insert on early_access to anon, authenticated;
grant select, delete on early_access to authenticated;

-- Admin write surface. The is_admin() policies are what actually gate these;
-- the grant merely makes the attempt possible for a signed-in user.
grant insert, update, delete on
  collections, drops, products, product_variants, product_images, articles,
  discount_codes, drop_access
to authenticated;
grant select on discount_codes to authenticated;
grant update on store_settings to authenticated;
