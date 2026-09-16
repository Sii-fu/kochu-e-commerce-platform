#!/usr/bin/env bash
#
# The two-session race tests, automated against the local stack.
#
# verify_phase1.sql proves everything one session can prove. It cannot prove
# the thing that actually matters on a drop launch: that two buyers racing for
# the last unit produce one order, not two. Each test below starts session 2
# while session 1 still holds its locks.
#
#   npx supabase start && bash supabase/tests/concurrency.sh
#
# For the hosted database, see concurrency.md -- the same tests driven by hand
# from two psql terminals.

set -u
cd "$(dirname "$0")"

C=supabase_db_kochu-storefront
X=33333333-3333-3333-3333-333333333333
Y=44444444-4444-4444-4444-444444444444
LAST=11111111-1111-1111-1111-111111111111
BULK=22222222-2222-2222-2222-222222222222

docker inspect "$C" >/dev/null 2>&1 || {
  echo "Local Supabase is not running. Start it with: npx supabase start"
  exit 1
}

psql() { MSYS_NO_PATHCONV=1 docker exec -i "$C" psql -U postgres -d postgres -X -q "$@"; }
val()  { psql -t -A -c "$1" | tr -d '[:space:]'; }

pass=0; fail=0
expect() { # $1=label $2=expected $3=actual
  if [ "$2" = "$3" ]; then echo "  PASS  $1 ($3)"; pass=$((pass+1))
  else echo "  FAIL  $1 -- expected $2, got $3"; fail=$((fail+1)); fi
}

# Session 1 holds its transaction open for HOLD seconds so session 2 is
# guaranteed to arrive while the locks are still held.
HOLD=6
order() { # $1=key $2=items-json  -> prints create_order's result
  cat <<SQL | psql -t -A 2>&1
begin;
select create_order(jsonb_build_object(
  'idempotency_key', '$1',
  'payment_method', 'COD',
  'customer_name', 'Racer',
  'phone', '+8801700000000',
  'shipping_address', '{"line1":"1 Test Rd","city":"Dhaka"}'::jsonb,
  'items', '$2'::jsonb
));
${3:-}
commit;
SQL
}
item() { echo "{\"variant_id\":\"$1\",\"quantity\":$2}"; }

echo "=== fixture ==="
docker cp concurrency_fixture.sql "$C:/tmp/concurrency_fixture.sql" >/dev/null
psql -f /tmp/concurrency_fixture.sql >/dev/null

# ---------------------------------------------------------------- Test A
echo
echo "=== A: two buyers, one unit ==="
order race-a "[$(item $LAST 1)]" "select pg_sleep($HOLD);" >/tmp/a1.log 2>&1 &
P1=$!; sleep 2
order race-b "[$(item $LAST 1)]" >/tmp/a2.log 2>&1 &
P2=$!; wait $P1 $P2
expect "exactly one order" 1 "$(val "select count(*) from orders where idempotency_key in ('race-a','race-b');")"
expect "stock floors at 0"  0 "$(val "select stock from product_variants where id='$LAST';")"
grep -q INSUFFICIENT_STOCK /tmp/a2.log \
  && { echo "  PASS  loser got INSUFFICIENT_STOCK"; pass=$((pass+1)); } \
  || { echo "  FAIL  loser did not get INSUFFICIENT_STOCK:"; cat /tmp/a2.log; fail=$((fail+1)); }

# ---------------------------------------------------------------- Test B
echo
echo "=== B: one buyer, double-clicked (same key, both in flight) ==="
order race-same "[$(item $BULK 1)]" "select pg_sleep($HOLD);" >/tmp/b1.log 2>&1 &
P1=$!; sleep 2
order race-same "[$(item $BULK 1)]" >/tmp/b2.log 2>&1 &
P2=$!; wait $P1 $P2
expect "exactly one order"   1 "$(val "select count(*) from orders where idempotency_key='race-same';")"
expect "charged once"        4 "$(val "select stock from product_variants where id='$BULK';")"
# The loser must get the winner's order back, not a raw 23505. A customer
# whose order did succeed must never be shown a database error.
grep -q '"replayed": true' /tmp/b2.log \
  && { echo "  PASS  loser got the original order (replayed)"; pass=$((pass+1)); } \
  || { echo "  FAIL  loser did not get a clean replay:"; cat /tmp/b2.log; fail=$((fail+1)); }

# ---------------------------------------------------------------- Test C
echo
echo "=== C: two carts, same variants, opposite order ==="
order race-c1 "[$(item $X 1),$(item $Y 1)]" "select pg_sleep($HOLD);" >/tmp/c1.log 2>&1 &
P1=$!; sleep 2
order race-c2 "[$(item $Y 1),$(item $X 1)]" >/tmp/c2.log 2>&1 &
P2=$!; wait $P1 $P2
expect "both orders placed" 2 "$(val "select count(*) from orders where idempotency_key in ('race-c1','race-c2');")"
expect "X decremented twice" 3 "$(val "select stock from product_variants where id='$X';")"
expect "Y decremented twice" 3 "$(val "select stock from product_variants where id='$Y';")"
# This is what `order by v.id` in create_order's locking step exists to prevent.
grep -qi "deadlock" /tmp/c1.log /tmp/c2.log \
  && { echo "  FAIL  deadlock detected -- lock ordering has regressed"; fail=$((fail+1)); } \
  || { echo "  PASS  no deadlock"; pass=$((pass+1)); }

echo
psql -c "delete from orders where idempotency_key like 'race-%';" \
     -c "delete from products where slug='race-prod';" \
     -c "delete from collections where slug='race-coll';" >/dev/null

echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
