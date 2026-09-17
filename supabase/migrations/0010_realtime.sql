-- 0010_realtime.sql
-- Enables Postgres Changes on `orders` so a signed-in customer's open order
-- page updates live when an admin approves an MFS payment or advances the
-- order status (create_order, verify_mfs_transaction, admin_update_order_status
-- in 0006_functions.sql all write to this table).
--
-- Realtime enforces the table's own RLS using the connecting role, so this
-- grants nothing new: `orders_select_own_or_admin` (0007_rls.sql) still means
-- anon gets zero rows and a signed-in customer only ever sees their own order
-- change. A guest checkout (anon, no session) has no row-level access to
-- `orders` at all -- by design, see invariant 3 in CLAUDE.md -- so its
-- confirmation page polls instead of subscribing; only the signed-in
-- /account/orders/:id page uses this.

alter publication supabase_realtime add table orders;
