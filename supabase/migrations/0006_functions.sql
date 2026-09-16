-- 0006_functions.sql
-- The RPC layer. This is the entire "backend".
--
-- Every function here is SECURITY DEFINER, which means it bypasses RLS by
-- design. Two rules are therefore absolute:
--   1. `set search_path = public, pg_temp` on every one (blocks search-path
--      hijacking via a malicious schema earlier on the path).
--   2. Re-check authorization *inside* the function. RLS is not protecting
--      these bodies; only the code below is.

-- ---------------------------------------------------------------------------
-- shipping_for: single source of truth for delivery cost.
-- ---------------------------------------------------------------------------
create or replace function public.shipping_for(p_subtotal_minor integer)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select case
           when p_subtotal_minor >= s.free_shipping_threshold_minor then 0
           else s.flat_shipping_minor
         end
  from store_settings s
  where s.id;
$$;

grant execute on function public.shipping_for(integer) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- validate_discount: read-only preview for the checkout UI.
-- Deliberately does NOT increment used_count -- only create_order does that,
-- inside the order transaction.
-- ---------------------------------------------------------------------------
create or replace function public.validate_discount(
  p_code           text,
  p_subtotal_minor integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c        discount_codes%rowtype;
  v_amount integer;
begin
  if nullif(trim(p_code), '') is null then
    return jsonb_build_object('valid', false, 'message', 'Enter a code.');
  end if;

  select * into c
  from discount_codes
  where code = trim(p_code)::citext
    and is_active
    and (starts_at  is null or now() >= starts_at)
    and (expires_at is null or now() <= expires_at)
    and (max_uses   is null or used_count < max_uses);

  if not found then
    return jsonb_build_object('valid', false,
             'message', 'That code is not valid or has expired.');
  end if;

  if p_subtotal_minor < c.min_order_minor then
    return jsonb_build_object('valid', false,
             'message', 'Order minimum not met.',
             'min_order_minor', c.min_order_minor);
  end if;

  v_amount := case
                when c.type = 'PERCENT' then (p_subtotal_minor * c.value) / 100
                else least(c.value, p_subtotal_minor)
              end;

  return jsonb_build_object(
    'valid', true,
    'code', c.code,
    'type', c.type,
    'value', c.value,
    'discount_minor', v_amount
  );
end;
$$;

grant execute on function public.validate_discount(text, integer) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- create_order: the security core.
--
-- The client sends variant ids and quantities. Nothing else about money is
-- trusted: unit prices, the discount amount, shipping, and the total are all
-- re-derived here. A payload carrying "price": 1 is charged the real price.
--
-- Ports the good parts of the old app/actions/order.ts -- idempotency key,
-- row locks, server-recomputed totals, same-transaction stock decrement --
-- and fixes its two weaknesses: the idempotency key now has a UNIQUE
-- constraint, and locks are taken in a deterministic order.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idem     text           := nullif(trim(payload ->> 'idempotency_key'), '');
  v_method   payment_method;
  v_uid      uuid           := auth.uid();
  v_items    jsonb;
  v_order_id uuid;
  v_token    uuid;
  v_number   text;
  v_subtotal integer;
  v_discount integer := 0;
  v_shipping integer;
  v_status   order_status;
  v_missing  bigint;
  v_inactive bigint;
  v_short    bigint;
  v_locked   bigint;
  c          discount_codes%rowtype;
begin
  ---------------------------------------------------------------------------
  -- 0. Shape checks
  ---------------------------------------------------------------------------
  if v_idem is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  begin
    v_method := (payload ->> 'payment_method')::payment_method;
  exception when others then
    raise exception 'INVALID_PAYMENT_METHOD';
  end;

  if nullif(trim(payload ->> 'customer_name'), '') is null
     or nullif(trim(payload ->> 'phone'), '') is null
     or payload -> 'shipping_address' is null
     or jsonb_typeof(payload -> 'shipping_address') <> 'object' then
    raise exception 'INCOMPLETE_DELIVERY_DETAILS';
  end if;

  if jsonb_typeof(payload -> 'items') <> 'array'
     or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'CART_EMPTY';
  end if;

  ---------------------------------------------------------------------------
  -- 1. Idempotent replay. A repeated key returns the original order and
  --    writes nothing -- this is what makes a double-clicked "Place order"
  --    button safe.
  ---------------------------------------------------------------------------
  select o.id, o.guest_token, o.order_number
    into v_order_id, v_token, v_number
  from orders o
  where o.idempotency_key = v_idem;

  if found then
    return jsonb_build_object(
      'order_id',     v_order_id,
      'guest_token',  v_token,
      'order_number', v_number,
      'replayed',     true
    );
  end if;

  ---------------------------------------------------------------------------
  -- 2. Normalise the cart: collapse duplicate lines for the same variant.
  ---------------------------------------------------------------------------
  select jsonb_agg(jsonb_build_object('variant_id', d.variant_id,
                                      'quantity',   d.quantity))
    into v_items
  from (
    select (i ->> 'variant_id')::uuid as variant_id,
           sum((i ->> 'quantity')::int) as quantity
    from jsonb_array_elements(payload -> 'items') i
    group by 1
  ) d;

  if exists (
    select 1
    from jsonb_array_elements(v_items) x
    where (x ->> 'quantity')::int not between 1 and 99
  ) then
    raise exception 'INVALID_QUANTITY';
  end if;

  ---------------------------------------------------------------------------
  -- 3. Lock every requested variant, ordered by id.
  --
  --    The ordering is what prevents deadlocks when a drop launches and many
  --    concurrent carts overlap: all sessions acquire locks in the same
  --    sequence, so they queue instead of forming a cycle.
  ---------------------------------------------------------------------------
  perform 1
  from product_variants v
  where v.id in (
    select (x ->> 'variant_id')::uuid from jsonb_array_elements(v_items) x
  )
  order by v.id
  for no key update;

  ---------------------------------------------------------------------------
  -- 4. Validate against locked rows and price the cart from the database.
  ---------------------------------------------------------------------------
  with req as (
    select (x ->> 'variant_id')::uuid as variant_id,
           (x ->> 'quantity')::int    as quantity
    from jsonb_array_elements(v_items) x
  )
  select
    count(*) filter (where v.id is null),
    count(*) filter (where v.id is not null
                       and (not v.is_active or p.status <> 'ACTIVE')),
    count(*) filter (where v.id is not null and v.stock < r.quantity),
    count(*) filter (where p.drop_id is not null
                       and not drop_is_live(p.drop_id)
                       and not has_early_access(p.drop_id)),
    coalesce(sum((p.price_minor + v.price_delta_minor) * r.quantity), 0)
  into v_missing, v_inactive, v_short, v_locked, v_subtotal
  from req r
  left join product_variants v on v.id = r.variant_id
  left join products p         on p.id = v.product_id;

  if v_missing  > 0 then raise exception 'PRODUCT_UNAVAILABLE'; end if;
  if v_inactive > 0 then raise exception 'PRODUCT_UNAVAILABLE'; end if;
  if v_short    > 0 then raise exception 'INSUFFICIENT_STOCK';  end if;
  if v_locked   > 0 then raise exception 'DROP_NOT_OPEN';       end if;

  ---------------------------------------------------------------------------
  -- 5. Discount: re-validated here and locked FOR UPDATE, so no concurrent
  --    checkout can drive used_count past max_uses. The lock is held for the
  --    rest of the transaction; the increment itself happens in step 10, once
  --    the order is known to exist.
  ---------------------------------------------------------------------------
  if nullif(trim(payload ->> 'discount_code'), '') is not null then
    select * into c
    from discount_codes
    where code = trim(payload ->> 'discount_code')::citext
      and is_active
      and (starts_at  is null or now() >= starts_at)
      and (expires_at is null or now() <= expires_at)
      and (max_uses   is null or used_count < max_uses)
      and v_subtotal >= min_order_minor
    for update;

    if not found then
      raise exception 'INVALID_DISCOUNT';
    end if;

    v_discount := case
                    when c.type = 'PERCENT' then (v_subtotal * c.value) / 100
                    else least(c.value, v_subtotal)
                  end;
  end if;

  ---------------------------------------------------------------------------
  -- 6. Shipping from settings, never from the client.
  ---------------------------------------------------------------------------
  v_shipping := shipping_for(v_subtotal - v_discount);

  ---------------------------------------------------------------------------
  -- 7. COD is accepted immediately. Mobile money waits for a verified TrxID.
  ---------------------------------------------------------------------------
  v_status := case when v_method = 'COD' then 'PROCESSING'
                   else 'PENDING_PAYMENT' end;

  -- The step-1 replay check catches a *sequential* retry. It cannot catch two
  -- requests in flight at once: both pass it, then both insert. The UNIQUE
  -- constraint on idempotency_key is what actually decides the race, so the
  -- loser is converted into the same replay answer the winner got rather than
  -- surfacing a raw 23505 to a customer whose order did in fact succeed.
  begin
    insert into orders (
      user_id, guest_email, customer_name, phone, shipping_address,
      status, payment_method, payment_status,
      subtotal_minor, discount_minor, shipping_minor, total_minor,
      discount_code, idempotency_key, processing_at
    )
    values (
      v_uid,
      nullif(trim(payload ->> 'email'), '')::citext,
      trim(payload ->> 'customer_name'),
      trim(payload ->> 'phone'),
      payload -> 'shipping_address',
      v_status, v_method, 'UNPAID',
      v_subtotal, v_discount, v_shipping,
      v_subtotal - v_discount + v_shipping,
      nullif(trim(payload ->> 'discount_code'), '')::citext,
      v_idem,
      case when v_status = 'PROCESSING' then now() end
    )
    returning id, guest_token, order_number
         into v_order_id, v_token, v_number;
  exception when unique_violation then
    select o.id, o.guest_token, o.order_number
      into v_order_id, v_token, v_number
    from orders o
    where o.idempotency_key = v_idem;

    -- Only an idempotency_key collision is a replay. Anything else (an
    -- order_number collision, say) must not be answered with another
    -- customer's order and guest_token.
    if not found then
      raise;
    end if;

    return jsonb_build_object(
      'order_id',     v_order_id,
      'guest_token',  v_token,
      'order_number', v_number,
      'replayed',     true
    );
  end;

  ---------------------------------------------------------------------------
  -- 8. Items, with name/label/image snapshotted so history survives deletion.
  ---------------------------------------------------------------------------
  insert into order_items (
    order_id, variant_id, product_id, product_name, variant_label,
    image_path, unit_price_minor, quantity, line_total_minor
  )
  select
    v_order_id,
    v.id,
    p.id,
    p.name,
    v.label,
    (select pi.path from product_images pi
      where pi.product_id = p.id
      order by pi.sort_order, pi.id
      limit 1),
    p.price_minor + v.price_delta_minor,
    r.quantity,
    (p.price_minor + v.price_delta_minor) * r.quantity
  from (
    select (x ->> 'variant_id')::uuid as variant_id,
           (x ->> 'quantity')::int    as quantity
    from jsonb_array_elements(v_items) x
  ) r
  join product_variants v on v.id = r.variant_id
  join products p         on p.id = v.product_id;

  ---------------------------------------------------------------------------
  -- 9. Decrement stock in the same transaction. If concurrency ever defeats
  --    the lock, CHECK (stock >= 0) aborts the whole thing rather than
  --    letting the order through against negative inventory.
  ---------------------------------------------------------------------------
  update product_variants v
     set stock = v.stock - r.quantity
  from (
    select (x ->> 'variant_id')::uuid as variant_id,
           (x ->> 'quantity')::int    as quantity
    from jsonb_array_elements(v_items) x
  ) r
  where v.id = r.variant_id;

  ---------------------------------------------------------------------------
  -- 10. Spend the discount only now, so a checkout that lost the idempotency
  --     race does not burn a second use on an order it never created.
  ---------------------------------------------------------------------------
  if c.id is not null then
    update discount_codes
       set used_count = used_count + 1
     where id = c.id;
  end if;

  return jsonb_build_object(
    'order_id',     v_order_id,
    'guest_token',  v_token,
    'order_number', v_number,
    'total_minor',  v_subtotal - v_discount + v_shipping,
    'replayed',     false
  );
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- get_order_by_token: the only path by which an anonymous visitor reads an
-- order. The orders RLS policy has no anon clause at all.
-- ---------------------------------------------------------------------------
create or replace function public.get_order_by_token(
  p_order_id uuid,
  p_token    uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  o orders%rowtype;
begin
  select * into o from orders where id = p_order_id;

  -- Same error either way: never reveal whether an order id exists.
  if not found or o.guest_token is distinct from p_token then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'order', to_jsonb(o) - 'idempotency_key' - 'admin_note',
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.product_name)
      from order_items i
      where i.order_id = o.id
    ), '[]'::jsonb),
    'payment', (
      select to_jsonb(m) - 'reviewer_id' - 'review_note'
      from mfs_transactions m
      where m.order_id = o.id
      order by m.created_at desc
      limit 1
    )
  );
end;
$$;

grant execute on function public.get_order_by_token(uuid, uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- submit_mfs_transaction: customer submits a bKash/Nagad TrxID.
-- ---------------------------------------------------------------------------
create or replace function public.submit_mfs_transaction(
  p_order_id     uuid,
  p_token        uuid,
  p_provider     payment_method,
  p_trx_id       text,
  p_msisdn       text,
  p_receipt_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o     orders%rowtype;
  v_new uuid;
begin
  select * into o from orders where id = p_order_id for update;

  if not found
     or (o.guest_token is distinct from p_token
         and (auth.uid() is null or o.user_id is distinct from auth.uid())) then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if o.payment_method <> p_provider then
    raise exception 'PAYMENT_METHOD_MISMATCH';
  end if;

  if p_provider not in ('BKASH', 'NAGAD') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if o.status <> 'PENDING_PAYMENT' then
    raise exception 'ORDER_NOT_AWAITING_PAYMENT';
  end if;

  if nullif(trim(p_trx_id), '') is null or nullif(trim(p_msisdn), '') is null then
    raise exception 'INCOMPLETE_PAYMENT_DETAILS';
  end if;

  begin
    insert into mfs_transactions (order_id, provider, trx_id, sender_msisdn,
                                  amount_minor, receipt_path)
    values (p_order_id, p_provider, upper(trim(p_trx_id)), trim(p_msisdn),
            o.total_minor, p_receipt_path)
    returning id into v_new;
  exception when unique_violation then
    raise exception 'TRX_ID_ALREADY_USED';
  end;

  update orders
     set payment_status = 'AWAITING_VERIFICATION'
   where id = p_order_id;

  return jsonb_build_object('transaction_id', v_new,
                            'payment_status', 'AWAITING_VERIFICATION');
end;
$$;

grant execute on function public.submit_mfs_transaction(
  uuid, uuid, payment_method, text, text, text
) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- verify_mfs_transaction: the admin approval queue's write path.
-- ---------------------------------------------------------------------------
create or replace function public.verify_mfs_transaction(
  p_tx_id   uuid,
  p_approve boolean,
  p_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m mfs_transactions%rowtype;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select * into m from mfs_transactions where id = p_tx_id for update;
  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;

  if m.status <> 'SUBMITTED' then
    raise exception 'TRANSACTION_ALREADY_REVIEWED';
  end if;

  update mfs_transactions
     set status      = case when p_approve then 'VERIFIED' else 'REJECTED' end,
         reviewer_id = auth.uid(),
         reviewed_at = now(),
         review_note = p_note
   where id = p_tx_id;

  if p_approve then
    update orders
       set payment_status = 'PAID',
           status         = 'PROCESSING',
           processing_at  = coalesce(processing_at, now())
     where id = m.order_id;
  else
    -- Back to square one so the customer can submit a corrected TrxID.
    update orders
       set payment_status = 'UNPAID',
           status         = 'PENDING_PAYMENT'
     where id = m.order_id;
  end if;

  return jsonb_build_object('transaction_id', p_tx_id, 'approved', p_approve);
end;
$$;

revoke all on function public.verify_mfs_transaction(uuid, boolean, text) from public, anon;
grant execute on function public.verify_mfs_transaction(uuid, boolean, text) to authenticated;


-- ---------------------------------------------------------------------------
-- admin_update_order_status: the transition table, plus the stock restore
-- the old updateOrderStatus was missing -- cancelling an order there silently
-- destroyed the inventory it had reserved.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_order_status(
  p_order_id      uuid,
  p_next          order_status,
  p_note          text default null,
  p_tracking_code text default null,
  p_courier       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o       orders%rowtype;
  v_allow order_status[];
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select * into o from orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_allow := case o.status
    when 'PENDING_PAYMENT' then array['PROCESSING', 'CANCELLED']::order_status[]
    when 'PROCESSING'      then array['SHIPPED', 'CANCELLED']::order_status[]
    when 'SHIPPED'         then array['DELIVERED', 'CANCELLED']::order_status[]
    else array[]::order_status[]     -- DELIVERED and CANCELLED are terminal
  end;

  if not (p_next = any(v_allow)) then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  -- Return reserved inventory exactly once, guarded by stock_released.
  if p_next = 'CANCELLED' and not o.stock_released then
    update product_variants v
       set stock = v.stock + i.quantity
    from order_items i
    where i.order_id = p_order_id
      and i.variant_id = v.id;
  end if;

  update orders
     set status         = p_next,
         admin_note     = coalesce(p_note, admin_note),
         tracking_code  = coalesce(p_tracking_code, tracking_code),
         courier        = coalesce(p_courier, courier),
         processing_at  = case when p_next = 'PROCESSING' then coalesce(processing_at, now()) else processing_at end,
         shipped_at     = case when p_next = 'SHIPPED'    then coalesce(shipped_at, now())    else shipped_at end,
         delivered_at   = case when p_next = 'DELIVERED'  then coalesce(delivered_at, now())  else delivered_at end,
         cancelled_at   = case when p_next = 'CANCELLED'  then coalesce(cancelled_at, now())  else cancelled_at end,
         stock_released = stock_released or p_next = 'CANCELLED',
         -- A cancelled COD order was never paid; a cancelled paid order is owed a refund.
         payment_status = case
                            when p_next = 'CANCELLED' and payment_status = 'PAID' then 'REFUNDED'
                            else payment_status
                          end
   where id = p_order_id;

  return jsonb_build_object('order_id', p_order_id, 'status', p_next);
end;
$$;

revoke all on function public.admin_update_order_status(uuid, order_status, text, text, text) from public, anon;
grant execute on function public.admin_update_order_status(uuid, order_status, text, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- Drop access: admin whitelist grant, and self-service key redemption.
-- ---------------------------------------------------------------------------
create or replace function public.grant_drop_access(
  p_drop_id uuid,
  p_emails  text[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  with matched as (
    select u.id
    from auth.users u
    where lower(u.email) = any (
      select lower(trim(e)) from unnest(p_emails) e
    )
  )
  insert into drop_access (drop_id, user_id)
  select p_drop_id, id from matched
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.grant_drop_access(uuid, text[]) from public, anon;
grant execute on function public.grant_drop_access(uuid, text[]) to authenticated;


create or replace function public.redeem_drop_key(
  p_drop_id uuid,
  p_key     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d drops%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into d from drops where id = p_drop_id;

  if not found
     or d.access_key is null
     or d.access_key <> trim(p_key) then
    raise exception 'INVALID_ACCESS_KEY';
  end if;

  insert into drop_access (drop_id, user_id)
  values (p_drop_id, auth.uid())
  on conflict do nothing;

  return jsonb_build_object('drop_id', p_drop_id, 'granted', true);
end;
$$;

revoke all on function public.redeem_drop_key(uuid, text) from public, anon;
grant execute on function public.redeem_drop_key(uuid, text) to authenticated;
