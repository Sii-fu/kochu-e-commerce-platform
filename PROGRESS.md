# KOCHU rebuild — progress

Last updated: 2026-09-16 · Phase 1 of 8 (code complete, **unverified**)

Rebuilding the Next.js 16 / Neon / Drizzle / better-auth storefront in place as a
pure client-side **Vite + React 19 + Supabase** SPA. Full architecture lives in
`CLAUDE.md`. This file tracks state.

---

## ⛔ Start here tomorrow

Two things block progress. Both need you, not me.

### 1. Upgrade Node to 22 LTS

Current: **v20.14.0**. `@supabase/supabase-js@2.117` does not run on it —
it fails at import:

```
IMPORT FAILED: Node.js detected but native WebSocket not found.
Suggested solution: Ensure you are running Node.js 22+
```

This breaks the seed script. (The browser app is unaffected — browsers have
`WebSocket` natively.) Vite 6 and ESLint 9 also want newer Node, so this is
worth doing regardless.

Get the Node 22 LTS installer from nodejs.org, then:

```bash
node --version      # expect v22.x
rm -rf node_modules && npm install
```

`engines: { node: ">=22" }` is now in `package.json`, so npm will warn if this
gets missed.

### 2. Create the Supabase project

- Region **ap-southeast-1 (Singapore)** — closest to Dhaka, ~40ms vs ~250ms
  for us-east.
- Free tier is fine for now.
- Save the database password when it's shown. **It is shown exactly once.**

---

## What I need from you

Paste these four values and say "continue":

| What | Where to find it |
|---|---|
| **Project ref** | The `abcdefgh...` in your project URL, or Settings → General |
| **Project URL** | Settings → API → Project URL (`https://<ref>.supabase.co`) |
| **anon public key** | Settings → API → Project API keys → `anon` `public` |
| **service_role key** | Settings → API → `service_role` — ⚠️ see below |
| **DB password** | The one you saved at project creation |

### About the two keys

- **anon key** — public by design. It ships inside the JavaScript bundle and
  anyone can read it. Goes in `.env`. Safe to paste here.
- **service_role key** — bypasses RLS completely. Goes only in `.env.seed`
  (gitignored), used only by the seed script. **If you would rather not paste
  it into chat, don't** — create `.env.seed` yourself from `.env.example` and
  just tell me it's done. I never need to see it.

Neither file is committed; `.gitignore` covers `.env` and `.env.*`.

---

## Done

### Phase 0 — Safety net ✅

- `git init`; the entire original app committed and tagged **`pre-rebuild`**
  (61 files). Nothing is lost — `git show pre-rebuild:app/page.tsx` still works.
- Old source quarantined in `_legacy/` (gitignored, read-only reference,
  deleted at Phase 8). Never import from it.
- Brand assets recovered to `public/`: logo, full icon set, 4 product photos,
  collection cover. The v0 junk (`placeholder*.{jpg,svg,png}`) was deliberately
  left behind.
- Purged: `.next/`, `node_modules/`, both lockfiles, `next.config.mjs`,
  `next-env.d.ts`, `postcss.config.mjs`.
- New `package.json`, `.gitignore`, `.env.example`.
- 408 packages installed.

### Phase 1 — Database (code complete, **not yet run**) ⚠️

Nine migrations in `supabase/migrations/`, none executed against a real
Postgres yet:

| File | Contents |
|---|---|
| `0001_extensions_enums.sql` | pgcrypto, citext, pg_trgm; 7 enums |
| `0002_profiles_rbac.sql` | `profiles`, `is_admin()`, signup trigger, role-guard trigger, `store_settings` |
| `0003_catalog.sql` | collections, drops, products, variants, images, drop_access, drop visibility helpers |
| `0004_commerce.sql` | addresses, discount_codes, orders, order_items, mfs_transactions |
| `0005_content.sql` | articles, early_access |
| `0006_functions.sql` | the 10 RPCs — `create_order` is the security core |
| `0007_rls.sql` | RLS on all 15 tables + explicit least-privilege grants |
| `0008_storage.sql` | 5 buckets + policies |
| `0009_indexes_analytics.sql` | 24 indexes + `admin_dashboard_stats()` |

Also written:

- `supabase/config.toml`
- `supabase/seed/seed.mjs` — catalog seed, idempotent, converts PNG→WebP on
  upload. Ports the old `scripts/seed.ts` content with BDT pricing and real
  size variants.
- `supabase/tests/verify_phase1.sql` — **12 automated gate checks**, runs in a
  transaction and rolls back.
- `supabase/tests/concurrency.md` — the 3 two-session race tests that a single
  session can't perform.

---

## What runs the moment the DB exists

```bash
npx supabase login
npx supabase link --project-ref <REF>
npm run db:push        # apply 0001-0009
npm run db:types       # generate src/lib/supabase/types.ts
npm run db:seed        # catalog + images (needs .env.seed)
```

Then the gate — paste `supabase/tests/verify_phase1.sql` into the Supabase SQL
editor. It must print:

```
================================
 PHASE 1: ALL CHECKS PASSED
================================
```

Then create an account through the app and promote it once, by hand:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

This is the only manual step in the whole system, by design — there is no
bootstrap backdoor.

---

## The 12 gate checks

Not ceremony. Each one pins a specific defect found in the old codebase.

| # | Check | Why |
|---|---|---|
| 1 | Valid cart creates an order, decrements stock, COD → `PROCESSING` | baseline |
| 2 | Replayed idempotency key → **same** order, stock decremented **once** | old code had no UNIQUE on the key, so the guard was a race |
| 3 | Client-sent `price: 1` is **ignored**, real price charged | the zero-backend threat model in one line |
| 4 | Over-ordering raises `INSUFFICIENT_STOCK` and writes **nothing** | no partial orders |
| 5 | Drop item can't be bought before its window opens | enforced in DB, not by hiding a button |
| 6 | MFS order stays `PENDING_PAYMENT`; right token opens it, wrong token doesn't | guest checkout security |
| 7 | Cancel restores stock **exactly once**; second cancel refused | old `updateOrderStatus` silently destroyed inventory on cancel |
| 8 | Non-admin gets `FORBIDDEN` from admin RPCs | RBAC |
| 9 | Customer **cannot** self-promote to admin | the role-guard trigger |
| 10 | `anon` reads 0 rows from `orders` | RLS |
| 11 | `anon` can't see an unopened drop's products | RLS + drop gating |
| 12 | `anon` can't list discount codes | anon key must not be a coupon dump |

Plus, from `concurrency.md` (needs two psql terminals):

- **A** — two buyers, one unit → exactly **one** order, stock `0` never `-1`
- **B** — same key twice concurrently → one order
- **C** — two carts with the same variants in opposite order → **no deadlock**
  (this is what the `order by v.id` locking exists for)

---

## Still to do

| Phase | Scope | Est. |
|---|---|---|
| **1 (finish)** | Run migrations, seed, verify all 12 + 3 race tests | 0.5d |
| **2** | Vite shell: Tailwind v4 tokens, shadcn primitives, router, layout, header/mobile nav/footer, `formatBDT`, providers | 1d |
| **3** | Auth: sign in/up/reset, `RequireAuth`, `RequireAdmin`, profile, address book | 1d |
| **4** | Storefront reads: home, `/shop` with URL-synced filters + ⌘K search, PDP with gallery + variants, collections, articles, drops, early access | 3d |
| **5** | Cart drawer + checkout + MFS QR/TrxID + order confirmation → **first real transaction** | 2.5d |
| **6** | Admin panel: dashboard, products/variants/images, collections, drops, orders, **MFS verification queue**, articles, customers, discounts, settings | 4d |
| **7** | Polish: skeletons, error boundaries, 404, `/contact` `/faq` `/shipping`, SEO, Lighthouse ≥90 mobile, a11y | 2d |
| **8** | Cutover: delete `_legacy/`, deploy with SPA rewrite, production redirect URLs, promote admin | 0.5d |

**~14.5 days remaining.**

---

## Decisions locked in

| | |
|---|---|
| Currency | **BDT only**, integer poisha (`*_minor`). No `numeric`, no floats. |
| Payments | **bKash + Nagad (manual MFS) + COD.** All Stripe deps removed. No Edge Functions. |
| Checkout | **Guest-first**, order read back via secret `guest_token`. |
| Old Neon data | **Not migrated.** Fresh seed. |
| Admin | `profiles.role = 'admin'`, checked in the DB. Never an env allowlist. |

---

## Notes / deviations from the approved plan

1. **Added a 5th storage bucket, `collections`.** The plan listed
   products/articles/drops/mfs-receipts and simply forgot collection cover art.
   Filing covers under `products/` would make the path convention lie. Same
   policies as the other catalog buckets.
2. **`admin_dashboard_stats` is a function, not a view.** A view would either
   run `security_invoker=true` and silently return a *customer's own* numbers
   when a customer queried it, or bypass RLS entirely. A guarded function
   states the access rule in one place.
3. **Role-pinning is a trigger, not a policy `WITH CHECK`.** The planned
   `with check (role = (select role from profiles where id = auth.uid()))`
   is a recursion trap — that subquery is itself subject to profiles' RLS.
   `WITH CHECK` also can't see `OLD`. `profiles_guard_role` (0002) sees both
   rows and covers every write path.
4. **Seed is `.mjs`, not `.ts`.** `--experimental-strip-types` needs Node 22.6+.
   Not worth a transpile step for a script that runs a handful of times.
5. **Explicit table `GRANT`s in 0007.** Supabase's default privileges would
   mostly cover this, but relying on them is fragile — and without a grant,
   RLS policies are moot. Note there is deliberately **no** INSERT/UPDATE grant
   on `orders`, `order_items`, or `mfs_transactions` for any role.
6. **bKash/Nagad numbers are placeholders** (`+8801XXXXXXXXX`) per your call.
   Set the real ones in `/admin/settings` once Phase 6 lands — they live in
   `store_settings`, so no redeploy is needed.

---

## Known risks

- **Manual MFS is a trust workflow, not a payment gateway.**
  `unique (provider, trx_id)` blocks receipt reuse, but a fabricated TrxID is
  only caught by a human checking the merchant app. `reviewer_id` is always
  logged.
- **Nothing is verified yet.** The SQL is carefully reviewed but has never been
  executed. Expect to fix a syntax error or two on first `db push` — that is
  what Phase 1's gate is for, and why it runs before any UI exists.
- **All security rests on RLS + in-RPC checks**, because the anon key is public.
  The anon-role checks (10–12) are not optional.
