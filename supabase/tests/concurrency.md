# The two-session concurrency test

`verify_phase1.sql` covers everything a single session can prove. It cannot
prove the one thing that actually matters on a drop launch: that two buyers
racing for the last unit produce **one order, not two**.

This is the check that would have caught the original app's bug. The old
`createOrder` did `SELECT id FROM orders WHERE idempotencykey = $1` and then
inserted — with no UNIQUE constraint on that column. Two requests arriving
together both saw "no existing order" and both inserted. The check below is
what makes that impossible now.

## Setup

Both sessions need a psql connection to the same database:

```bash
# Supabase Dashboard -> Project Settings -> Database -> Connection string
psql "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
```

Open **two** terminals. The SQL editor in the dashboard will not work —
it does not hold a transaction open between statements.

## Fixture (session 1, committed)

```sql
insert into collections (slug, title, season)
values ('race-coll', 'Race', 'Test');

insert into products (slug, name, category, price_minor, status, collection_id)
select 'race-prod', 'Race Product', 'Test', 100000, 'ACTIVE', id
from collections where slug = 'race-coll';

-- Exactly one unit in stock.
insert into product_variants (product_id, label, stock)
select id, 'One Size', 1 from products where slug = 'race-prod';

select id as variant_id from product_variants
where product_id = (select id from products where slug = 'race-prod');
```

Copy the `variant_id`.

## Test A — two buyers, one unit

Paste into **session 1**, and do not commit yet:

```sql
begin;
select create_order(jsonb_build_object(
  'idempotency_key', 'race-a',
  'payment_method', 'COD',
  'customer_name', 'Buyer A',
  'phone', '+8801700000000',
  'shipping_address', '{"line1":"1 Test Rd","city":"Dhaka"}'::jsonb,
  'items', jsonb_build_array(
    jsonb_build_object('variant_id', '<VARIANT_ID>', 'quantity', 1))
));
-- leave the transaction OPEN
```

Now paste the same block into **session 2** with `'race-b'` as the key.

**Expected:** session 2 blocks. It is waiting on the `for no key update` row
lock that session 1 holds. This is the whole point — without it, both sessions
would read `stock = 1` and both would succeed.

Back in **session 1**:

```sql
commit;
```

**Expected:** session 2 immediately fails with

```
ERROR:  INSUFFICIENT_STOCK
```

because it re-reads the row it was waiting for and now sees `stock = 0`.

Verify:

```sql
select count(*) from orders where idempotency_key in ('race-a', 'race-b');
-- expect 1

select stock from product_variants
where product_id = (select id from products where slug = 'race-prod');
-- expect 0, never -1
```

❌ If **both** orders exist, or stock is `-1`, the lock is not working. Stop
and fix `create_order` before building anything on top of it.

## Test B — the same buyer, double-clicked

The realistic version: one impatient customer, two identical requests in
flight. Same key both times.

Run in both sessions, same `idempotency_key`:

```sql
begin;
select create_order(jsonb_build_object(
  'idempotency_key', 'race-same',
  'payment_method', 'COD',
  'customer_name', 'Double Clicker',
  'phone', '+8801700000000',
  'shipping_address', '{"line1":"1 Test Rd","city":"Dhaka"}'::jsonb,
  'items', jsonb_build_array(
    jsonb_build_object('variant_id', '<VARIANT_ID_WITH_STOCK>', 'quantity', 1))
));
```

Commit session 1, then session 2.

**Expected:** session 2 fails on the `orders_idempotency_key_key` unique
violation, *or* returns the same order with `replayed: true` — either is
correct. What must never happen is two orders.

```sql
select count(*) from orders where idempotency_key = 'race-same';
-- expect 1
```

> Note: the UI's `useRef` key makes this rare, but "rare" is not "impossible"
> — a retry on a flaky mobile connection reproduces it exactly. The UNIQUE
> constraint is the guarantee; the `useRef` is only an optimisation.

## Test C — deadlock resistance

Two carts containing the same two variants in **opposite order**. Without the
`order by v.id` in `create_order`'s locking step this deadlocks; with it, one
session simply waits.

Session 1: items `[X, Y]`. Session 2: items `[Y, X]`. Run both, then commit
session 1.

**Expected:** session 2 waits, then succeeds or raises `INSUFFICIENT_STOCK`.

❌ `ERROR: deadlock detected` means the lock ordering has regressed.

## Cleanup

```sql
delete from orders where idempotency_key like 'race-%';
delete from products where slug = 'race-prod';
delete from collections where slug = 'race-coll';
```
