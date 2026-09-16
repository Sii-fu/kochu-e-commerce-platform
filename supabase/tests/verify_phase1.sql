-- verify_phase1.sql
--
-- The Phase 1 gate. Run this in the Supabase SQL editor (or via psql) after
-- `supabase db push` and BEFORE any frontend code is written.
--
-- It runs entirely inside a transaction and ROLLBACKs at the end, so it is
-- safe against a seeded database and leaves nothing behind.
--
-- Every check RAISEs on failure. If you see the final "PHASE 1: ALL CHECKS
-- PASSED" notice, the gate is green. Any exception means stop and fix.
--
-- The one check this file CANNOT make is the concurrency test -- that needs
-- two simultaneous sessions. See supabase/tests/concurrency.md.

begin;

-- Make notices visible in psql; harmless in the SQL editor.
set local client_min_messages to notice;

do $verify$
declare
  v_user_a   uuid := gen_random_uuid();
  v_user_vip uuid := gen_random_uuid();
  v_coll     uuid;
  v_drop     uuid;
  v_prod     uuid;
  v_drop_prod uuid;
  v_var_a    uuid;
  v_var_b    uuid;
  v_drop_var uuid;
  v_res      jsonb;
  v_res2     jsonb;
  v_order    uuid;
  v_stock    integer;
  v_count    bigint;
  v_total    integer;
  v_ok       boolean;
begin
  raise notice '--- fixtures ---';

  -- Two auth users: a plain customer and a VIP with drop access.
  insert into auth.users (id, instance_id, aud, role, email,
                          encrypted_password, email_confirmed_at,
                          created_at, updated_at)
  values
    (v_user_a,   '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'verify-a@kochu.test',   'x', now(), now(), now()),
    (v_user_vip, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'verify-vip@kochu.test', 'x', now(), now(), now());

  insert into collections (slug, title, season)
  values ('verify-coll', 'Verify Collection', 'Test')
  returning id into v_coll;

  -- A drop that is published but opens to the public in 7 days, with early
  -- access already live for whitelisted members.
  insert into drops (slug, title, starts_at, early_access_at, is_published, access_key)
  values ('verify-drop', 'Verify Drop',
          now() + interval '7 days', now() - interval '1 hour', true, 'VERIFYKEY')
  returning id into v_drop;

  insert into products (slug, name, category, price_minor, status, collection_id)
  values ('verify-prod', 'Verify Product', 'Test', 100000, 'ACTIVE', v_coll)
  returning id into v_prod;

  insert into products (slug, name, category, price_minor, status, collection_id, drop_id)
  values ('verify-drop-prod', 'Verify Drop Product', 'Test', 250000, 'ACTIVE', v_coll, v_drop)
  returning id into v_drop_prod;

  insert into product_variants (product_id, label, stock, sort_order)
  values (v_prod, 'M', 10, 0) returning id into v_var_a;

  insert into product_variants (product_id, label, stock, sort_order)
  values (v_prod, 'L', 1, 1) returning id into v_var_b;   -- the "last unit"

  insert into product_variants (product_id, label, stock, sort_order)
  values (v_drop_prod, 'One Size', 5, 0) returning id into v_drop_var;

  insert into drop_access (drop_id, user_id) values (v_drop, v_user_vip);

  raise notice 'fixtures created';


  -------------------------------------------------------------------------
  raise notice '--- 1. a valid cart creates an order and decrements stock ---';
  -------------------------------------------------------------------------
  v_res := create_order(jsonb_build_object(
    'idempotency_key', 'verify-key-1',
    'payment_method', 'COD',
    'customer_name', 'Verify Buyer',
    'phone', '+8801700000000',
    'shipping_address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Dhaka'),
    'items', jsonb_build_array(
      jsonb_build_object('variant_id', v_var_a, 'quantity', 2))
  ));

  v_order := (v_res ->> 'order_id')::uuid;
  if v_order is null then
    raise exception 'FAIL 1: no order id returned';
  end if;

  select stock into v_stock from product_variants where id = v_var_a;
  if v_stock <> 8 then
    raise exception 'FAIL 1: stock is %, expected 8', v_stock;
  end if;

  -- COD must be accepted straight into PROCESSING.
  if (select status from orders where id = v_order) <> 'PROCESSING' then
    raise exception 'FAIL 1: COD order should be PROCESSING';
  end if;

  -- 2 x 1000.00 BDT = 200000 poisha, plus shipping from store_settings.
  select total_minor into v_total from orders where id = v_order;
  if v_total <> 200000 + shipping_for(200000) then
    raise exception 'FAIL 1: total is %, expected %',
      v_total, 200000 + shipping_for(200000);
  end if;
  raise notice 'PASS 1  (order %, stock 10 -> 8, total %)', v_res ->> 'order_number', v_total;


  -------------------------------------------------------------------------
  raise notice '--- 2. replaying an idempotency key returns the same order ---';
  -------------------------------------------------------------------------
  v_res2 := create_order(jsonb_build_object(
    'idempotency_key', 'verify-key-1',          -- same key
    'payment_method', 'COD',
    'customer_name', 'Verify Buyer',
    'phone', '+8801700000000',
    'shipping_address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Dhaka'),
    'items', jsonb_build_array(
      jsonb_build_object('variant_id', v_var_a, 'quantity', 2))
  ));

  if (v_res2 ->> 'order_id')::uuid <> v_order then
    raise exception 'FAIL 2: replay created a different order';
  end if;
  if (v_res2 ->> 'replayed')::boolean is not true then
    raise exception 'FAIL 2: replay not flagged';
  end if;

  select stock into v_stock from product_variants where id = v_var_a;
  if v_stock <> 8 then
    raise exception 'FAIL 2: replay decremented stock again (now %)', v_stock;
  end if;

  select count(*) into v_count from orders where idempotency_key = 'verify-key-1';
  if v_count <> 1 then
    raise exception 'FAIL 2: % orders share the idempotency key', v_count;
  end if;
  raise notice 'PASS 2  (one order, stock still 8)';


  -------------------------------------------------------------------------
  raise notice '--- 3. a client-supplied price is ignored ---';
  -------------------------------------------------------------------------
  v_res := create_order(jsonb_build_object(
    'idempotency_key', 'verify-key-3',
    'payment_method', 'COD',
    'customer_name', 'Cheapskate',
    'phone', '+8801700000000',
    'shipping_address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Dhaka'),
    'items', jsonb_build_array(
      -- Every one of these is a lie. None of them is read.
      jsonb_build_object('variant_id', v_var_a, 'quantity', 1,
                         'price', 1, 'price_minor', 1,
                         'unit_price_minor', 1, 'line_total_minor', 1))
  ));

  select subtotal_minor into v_total
  from orders where id = (v_res ->> 'order_id')::uuid;

  if v_total <> 100000 then
    raise exception 'FAIL 3: subtotal is %, expected 100000 -- CLIENT PRICE WAS TRUSTED', v_total;
  end if;

  select unit_price_minor into v_total
  from order_items where order_id = (v_res ->> 'order_id')::uuid;
  if v_total <> 100000 then
    raise exception 'FAIL 3: item unit price is %, expected 100000', v_total;
  end if;
  raise notice 'PASS 3  (charged 100000 poisha, not 1)';


  -------------------------------------------------------------------------
  raise notice '--- 4. over-ordering raises and writes nothing ---';
  -------------------------------------------------------------------------
  select stock into v_stock from product_variants where id = v_var_a;
  begin
    perform create_order(jsonb_build_object(
      'idempotency_key', 'verify-key-4',
      'payment_method', 'COD',
      'customer_name', 'Greedy',
      'phone', '+8801700000000',
      'shipping_address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Dhaka'),
      'items', jsonb_build_array(
        jsonb_build_object('variant_id', v_var_a, 'quantity', 99))
    ));
    raise exception 'FAIL 4: over-order succeeded';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'INSUFFICIENT_STOCK' then
        raise exception 'FAIL 4: wrong error "%"', sqlerrm;
      end if;
  end;

  -- The subtransaction rolled back; nothing may have been written.
  select count(*) into v_count from orders where idempotency_key = 'verify-key-4';
  if v_count <> 0 then
    raise exception 'FAIL 4: a partial order was written';
  end if;
  if (select stock from product_variants where id = v_var_a) <> v_stock then
    raise exception 'FAIL 4: stock changed on a failed order';
  end if;
  raise notice 'PASS 4  (INSUFFICIENT_STOCK, no partial write)';


  -------------------------------------------------------------------------
  raise notice '--- 5. a drop item cannot be bought before its window ---';
  -------------------------------------------------------------------------
  begin
    perform create_order(jsonb_build_object(
      'idempotency_key', 'verify-key-5',
      'payment_method', 'COD',
      'customer_name', 'Too Early',
      'phone', '+8801700000000',
      'shipping_address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Dhaka'),
      'items', jsonb_build_array(
        jsonb_build_object('variant_id', v_drop_var, 'quantity', 1))
    ));
    raise exception 'FAIL 5: bought a drop item before it opened';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'DROP_NOT_OPEN' then
        raise exception 'FAIL 5: wrong error "%"', sqlerrm;
      end if;
  end;
  raise notice 'PASS 5  (DROP_NOT_OPEN for a non-member)';


  -------------------------------------------------------------------------
  raise notice '--- 6. guest order readable only with the right token ---';
  -------------------------------------------------------------------------
  v_res := create_order(jsonb_build_object(
    'idempotency_key', 'verify-key-6',
    'payment_method', 'BKASH',
    'customer_name', 'Guest Buyer',
    'phone', '+8801700000000',
    'shipping_address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Dhaka'),
    'items', jsonb_build_array(
      jsonb_build_object('variant_id', v_var_a, 'quantity', 1))
  ));
  v_order := (v_res ->> 'order_id')::uuid;

  -- bKash must NOT be auto-accepted.
  if (select status from orders where id = v_order) <> 'PENDING_PAYMENT' then
    raise exception 'FAIL 6: MFS order should be PENDING_PAYMENT';
  end if;

  if get_order_by_token(v_order, (v_res ->> 'guest_token')::uuid) is null then
    raise exception 'FAIL 6: correct token did not return the order';
  end if;

  begin
    perform get_order_by_token(v_order, gen_random_uuid());
    raise exception 'FAIL 6: a wrong token returned the order';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'ORDER_NOT_FOUND' then
        raise exception 'FAIL 6: wrong error "%"', sqlerrm;
      end if;
  end;
  raise notice 'PASS 6  (MFS pending; right token opens, wrong token does not)';


  -------------------------------------------------------------------------
  raise notice '--- 7. cancelling restores stock exactly once ---';
  -------------------------------------------------------------------------
  -- Become an admin to drive the status RPC.
  insert into profiles (id, email, role)
  values (v_user_a, 'verify-a@kochu.test', 'admin')
  on conflict (id) do update set role = 'admin';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

  select stock into v_stock from product_variants where id = v_var_a;

  perform admin_update_order_status(v_order, 'CANCELLED', 'verify cancel');

  if (select stock from product_variants where id = v_var_a) <> v_stock + 1 then
    raise exception 'FAIL 7: stock not restored on cancel';
  end if;

  -- A second cancel must be refused by the transition table (CANCELLED is
  -- terminal), so stock cannot be restored twice.
  begin
    perform admin_update_order_status(v_order, 'CANCELLED', 'again');
    raise exception 'FAIL 7: second cancel was allowed';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'INVALID_STATUS_TRANSITION' then
        raise exception 'FAIL 7: wrong error "%"', sqlerrm;
      end if;
  end;

  if (select stock from product_variants where id = v_var_a) <> v_stock + 1 then
    raise exception 'FAIL 7: stock double-restored';
  end if;
  raise notice 'PASS 7  (restored once, second cancel refused)';


  -------------------------------------------------------------------------
  raise notice '--- 8. a non-admin is refused by admin RPCs ---';
  -------------------------------------------------------------------------
  update profiles set role = 'customer' where id = v_user_a;

  begin
    perform admin_update_order_status(v_order, 'PROCESSING');
    raise exception 'FAIL 8: a customer changed an order status';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'FORBIDDEN' then
        raise exception 'FAIL 8: wrong error "%"', sqlerrm;
      end if;
  end;

  begin
    perform admin_dashboard_stats();
    raise exception 'FAIL 8: a customer read the dashboard';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'FORBIDDEN' then
        raise exception 'FAIL 8: wrong error "%"', sqlerrm;
      end if;
  end;
  raise notice 'PASS 8  (FORBIDDEN from admin RPCs)';


  -------------------------------------------------------------------------
  raise notice '--- 9. a customer cannot promote themselves ---';
  -------------------------------------------------------------------------
  -- This must run as the real `authenticated` role, not as postgres. The
  -- guard deliberately exempts superuser/service_role sessions -- that is the
  -- first-admin bootstrap path -- so running it as postgres would prove
  -- nothing about what a signed-in customer can do.
  begin
    set local role authenticated;
    update profiles set role = 'admin' where id = v_user_a;
    reset role;
    raise exception 'FAIL 9: self-promotion succeeded';
  exception
    when sqlstate 'P0001' then
      reset role;
      if sqlerrm <> 'ROLE_CHANGE_FORBIDDEN' then
        raise exception 'FAIL 9: wrong error "%"', sqlerrm;
      end if;
  end;

  if (select role from profiles where id = v_user_a) <> 'customer' then
    raise exception 'FAIL 9: role changed despite the guard';
  end if;
  raise notice 'PASS 9  (ROLE_CHANGE_FORBIDDEN as authenticated)';

  -------------------------------------------------------------------------
  raise notice '--- 13. a discount applies once and is spent once ---';
  -------------------------------------------------------------------------
  insert into discount_codes (code, type, value, max_uses)
  values ('VERIFY10', 'PERCENT', 10, 1);

  v_res := create_order(jsonb_build_object(
    'idempotency_key', 'verify-key-13',
    'payment_method', 'COD',
    'customer_name', 'Coupon User',
    'phone', '+8801700000000',
    'shipping_address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Dhaka'),
    'discount_code', 'verify10',          -- citext: case must not matter
    'items', jsonb_build_array(
      jsonb_build_object('variant_id', v_var_a, 'quantity', 1))
  ));
  v_order := (v_res ->> 'order_id')::uuid;

  select discount_minor into v_total from orders where id = v_order;
  if v_total <> 10000 then
    raise exception 'FAIL 13: discount is %, expected 10000', v_total;
  end if;

  select total_minor into v_total from orders where id = v_order;
  if v_total <> 100000 - 10000 + shipping_for(90000) then
    raise exception 'FAIL 13: total is %, expected %',
      v_total, 100000 - 10000 + shipping_for(90000);
  end if;

  select used_count into v_count from discount_codes where code = 'VERIFY10';
  if v_count <> 1 then
    raise exception 'FAIL 13: used_count is %, expected 1', v_count;
  end if;

  -- A replay must not spend a second use. The increment deliberately sits
  -- after the order insert so a losing race burns nothing.
  perform create_order(jsonb_build_object(
    'idempotency_key', 'verify-key-13',
    'payment_method', 'COD',
    'customer_name', 'Coupon User',
    'phone', '+8801700000000',
    'shipping_address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Dhaka'),
    'discount_code', 'verify10',
    'items', jsonb_build_array(
      jsonb_build_object('variant_id', v_var_a, 'quantity', 1))
  ));

  select used_count into v_count from discount_codes where code = 'VERIFY10';
  if v_count <> 1 then
    raise exception 'FAIL 13: replay spent a second use (now %)', v_count;
  end if;

  -- max_uses is now exhausted, so a fresh order must be refused.
  begin
    perform create_order(jsonb_build_object(
      'idempotency_key', 'verify-key-13b',
      'payment_method', 'COD',
      'customer_name', 'Late Coupon User',
      'phone', '+8801700000000',
      'shipping_address', jsonb_build_object('line1', '1 Test Rd', 'city', 'Dhaka'),
      'discount_code', 'VERIFY10',
      'items', jsonb_build_array(
        jsonb_build_object('variant_id', v_var_a, 'quantity', 1))
    ));
    raise exception 'FAIL 13: an exhausted code was accepted';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'INVALID_DISCOUNT' then
        raise exception 'FAIL 13: wrong error "%"', sqlerrm;
      end if;
  end;
  raise notice 'PASS 13 (10%% applied, spent once, exhausted code refused)';

  perform set_config('request.jwt.claims', null, true);
  raise notice 'ALL IN-SESSION CHECKS PASSED';
end
$verify$;


-- ---------------------------------------------------------------------------
-- RLS checks. These must run as the real anon / authenticated roles, which a
-- SECURITY DEFINER DO block cannot simulate -- so they are separate.
-- ---------------------------------------------------------------------------

do $rls$
declare
  v_count bigint;
begin
  raise notice '--- 10. anon cannot read orders ---';
  set local role anon;
  select count(*) into v_count from orders;
  reset role;
  if v_count <> 0 then
    raise exception 'FAIL 10: anon read % order rows', v_count;
  end if;
  raise notice 'PASS 10 (anon sees 0 orders)';
exception when insufficient_privilege then
  reset role;
  raise notice 'PASS 10 (anon has no SELECT grant on orders at all)';
end
$rls$;

do $rls2$
declare
  v_count bigint;
begin
  raise notice '--- 11. anon cannot see a not-yet-open drop product ---';
  set local role anon;
  select count(*) into v_count from products where slug = 'verify-drop-prod';
  reset role;
  if v_count <> 0 then
    raise exception 'FAIL 11: anon saw a VIP-only drop product';
  end if;
  raise notice 'PASS 11 (anon sees 0 rows for the upcoming drop)';
end
$rls2$;

do $rls3$
declare
  v_count bigint;
begin
  raise notice '--- 12. anon cannot list discount codes ---';
  set local role anon;
  begin
    select count(*) into v_count from discount_codes;
    reset role;
    if v_count <> 0 then
      raise exception 'FAIL 12: anon listed % discount codes', v_count;
    end if;
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS 12 (no grant to anon)';
    return;
  end;
  raise notice 'PASS 12 (anon sees 0 codes)';
end
$rls3$;

do $done$
begin
  raise notice '';
  raise notice '================================';
  raise notice ' PHASE 1: ALL CHECKS PASSED';
  raise notice '================================';
  raise notice 'Still required: the two-session concurrency test.';
  raise notice 'See supabase/tests/concurrency.md';
end
$done$;

rollback;
