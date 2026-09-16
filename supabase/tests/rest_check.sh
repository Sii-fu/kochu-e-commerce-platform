#!/usr/bin/env bash
#
# Exercises the public REST surface the way a browser -- or an attacker holding
# the anon key -- would, rather than from inside the database. In-database
# tests run as postgres and so cannot prove what PostgREST actually exposes:
# a missing GRANT, a policy that never applies to the anon role, or an admin
# RPC reachable without a check would all pass verify_phase1.sql and fail here.
#
#   npx supabase start
#   node --env-file=.env.seed.local supabase/seed/seed.mjs
#   bash supabase/tests/rest_check.sh
#
# Expects the seeded catalog, and an admin account -- sign up owner@kochu.test
# through the app, then promote it:
#   update profiles set role='admin' where email='owner@kochu.test';
#
# The anon key below is the fixed demo key every local Supabase prints. It is
# not a secret and grants nothing beyond this machine.
set -u
API=http://127.0.0.1:54321
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

pass=0; fail=0
check() { # $1=label  $2=expected-substring  $3=actual
  if echo "$3" | grep -q "$2"; then echo "  PASS  $1"; pass=$((pass+1));
  else echo "  FAIL  $1"; echo "        expected to contain: $2"; echo "        got: $3"; fail=$((fail+1)); fi
}

# A plain customer account.
curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"shopper@kochu.test","password":"kochu-local-pw-123"}' > /dev/null
CUST=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"email":"shopper@kochu.test","password":"kochu-local-pw-123"}' \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
ADMIN=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@kochu.test","password":"kochu-local-pw-123"}' \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
[ -n "$CUST" ] || { echo "could not get a customer token"; exit 1; }
[ -n "$ADMIN" ] || { echo "could not get an admin token"; exit 1; }

get()  { curl -s "$API/rest/v1/$1" -H "apikey: $ANON" -H "Authorization: Bearer $2"; }
rpc()  { curl -s -X POST "$API/rest/v1/rpc/$1" -H "apikey: $ANON" -H "Authorization: Bearer $3" \
           -H "Content-Type: application/json" -d "$2"; }

echo "=== anon: what the public key alone can reach ==="
check "products are readable"        '"slug"'              "$(get 'products?select=slug&limit=1' "$ANON")"
check "orders are not"               'permission denied'   "$(get 'orders?select=id' "$ANON")"
check "discount_codes are not"       'permission denied'   "$(get 'discount_codes?select=code' "$ANON")"
check "early_access is not readable" 'permission denied'   "$(get 'early_access?select=email' "$ANON")"
check "profiles are not readable"    'permission denied'   "$(get 'profiles?select=email' "$ANON")"
check "VIP drop product is hidden"   '^\[\]$'              "$(get 'products?select=slug&slug=eq.structured-corset' "$ANON")"
check "stock is not writable"        'permission denied'   "$(curl -s -X PATCH "$API/rest/v1/product_variants?id=neq.00000000-0000-0000-0000-000000000000" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"stock":9999}')"

echo
echo "=== customer JWT: admin RPCs must all refuse ==="
check "admin_update_order_status" 'FORBIDDEN' "$(rpc admin_update_order_status '{"p_order_id":"00000000-0000-0000-0000-000000000000","p_next":"SHIPPED"}' "$CUST")"
check "verify_mfs_transaction"    'FORBIDDEN' "$(rpc verify_mfs_transaction '{"p_tx_id":"00000000-0000-0000-0000-000000000000","p_approve":true}' "$CUST")"
check "grant_drop_access"         'FORBIDDEN' "$(rpc grant_drop_access '{"p_drop_id":"00000000-0000-0000-0000-000000000000","p_emails":["x@y.z"]}' "$CUST")"
check "admin_dashboard_stats"     'FORBIDDEN' "$(rpc admin_dashboard_stats '{}' "$CUST")"
check "cannot read other orders"  '^\[\]$'    "$(get 'orders?select=id' "$CUST")"
check "cannot list discounts"     '^\[\]$'    "$(get 'discount_codes?select=code' "$CUST")"
check "cannot self-promote"       'ROLE_CHANGE_FORBIDDEN' "$(curl -s -X PATCH "$API/rest/v1/profiles?id=eq.$(echo "$CUST" | cut -d. -f2 | base64 -d 2>/dev/null | sed -n 's/.*"sub":"\([^"]*\)".*/\1/p')" -H "apikey: $ANON" -H "Authorization: Bearer $CUST" -H "Content-Type: application/json" -d '{"role":"admin"}')"

echo
echo "=== admin JWT: the same RPCs must be reachable ==="
check "admin_dashboard_stats works" 'orders'          "$(rpc admin_dashboard_stats '{}' "$ADMIN")"
check "admin sees discount codes"   'WELCOME10'       "$(get 'discount_codes?select=code' "$ADMIN")"
check "admin sees the VIP product"  'structured-corset' "$(get 'products?select=slug&slug=eq.structured-corset' "$ADMIN")"

echo
echo "=== guest checkout over REST ==="
VAR=$(get 'product_variants?select=id&limit=1' "$ANON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
ORDER=$(rpc create_order "{\"payload\":{\"idempotency_key\":\"rest-$(date +%s)\",\"payment_method\":\"COD\",\"customer_name\":\"REST Guest\",\"phone\":\"+8801700000000\",\"shipping_address\":{\"line1\":\"1 Test Rd\",\"city\":\"Dhaka\"},\"items\":[{\"variant_id\":\"$VAR\",\"quantity\":1,\"unit_price_minor\":1}]}}" "$ANON")
check "anon can place an order" '"order_number"' "$ORDER"
OID=$(echo "$ORDER" | sed -n 's/.*"order_id": *"\([^"]*\)".*/\1/p')
TOK=$(echo "$ORDER" | sed -n 's/.*"guest_token": *"\([^"]*\)".*/\1/p')
check "right token opens it"  '"order_number"'   "$(rpc get_order_by_token "{\"p_order_id\":\"$OID\",\"p_token\":\"$TOK\"}" "$ANON")"
check "wrong token does not"  'ORDER_NOT_FOUND'  "$(rpc get_order_by_token "{\"p_order_id\":\"$OID\",\"p_token\":\"11111111-1111-1111-1111-111111111111\"}" "$ANON")"
check "client price ignored"  '"total_minor"'    "$ORDER"

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
