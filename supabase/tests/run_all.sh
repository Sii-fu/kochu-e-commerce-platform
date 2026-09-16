#!/usr/bin/env bash
#
# The full Phase 1 gate against the local stack:  npm run db:verify
#
#   1. verify_phase1.sql  -- 13 in-database checks, in a transaction, rolled back
#   2. concurrency.sh     -- the three two-session race tests
#   3. rest_check.sh      -- 21 checks against the real PostgREST surface
#
# Re-run this after any change to a migration. Prerequisites:
#   npx supabase start
#   npm run db:seed:local
#   an admin account (see rest_check.sh's header)

set -u
cd "$(dirname "$0")"
C=supabase_db_kochu-storefront

docker inspect "$C" >/dev/null 2>&1 || {
  echo "Local Supabase is not running. Start it with: npm run db:start"
  exit 1
}

rc=0

echo "############ 1/3  verify_phase1.sql ############"
docker cp verify_phase1.sql "$C:/tmp/verify_phase1.sql" >/dev/null
MSYS_NO_PATHCONV=1 docker exec -i "$C" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/verify_phase1.sql 2>&1 \
  | grep -E "NOTICE|ERROR" | sed 's/^psql:[^ ]* //'
[ "${PIPESTATUS[0]}" -eq 0 ] || rc=1

echo
echo "############ 2/3  concurrency.sh ############"
bash concurrency.sh || rc=1

echo
echo "############ 3/3  rest_check.sh ############"
bash rest_check.sh || rc=1

echo
if [ "$rc" -eq 0 ]; then
  echo "================================"
  echo " PHASE 1 GATE: GREEN"
  echo "================================"
else
  echo "PHASE 1 GATE: FAILED -- see above"
fi
exit $rc
