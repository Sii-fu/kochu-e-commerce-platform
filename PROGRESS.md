# KOCHU rebuild — progress

Last updated: 2026-09-16 · Phase 1 of 8 — **verified against a real Postgres** ✅

Rebuilding the Next.js 16 / Neon / Drizzle / better-auth storefront in place as a
pure client-side **Vite + React 19 + Supabase** SPA. Full architecture lives in
`CLAUDE.md`. This file tracks state.

---

## Where things stand

Phase 1 is **done and verified**. Both of yesterday's blockers cleared: Node is
now v24.20.0, and rather than wait on a hosted project, the whole schema was
verified against a real Postgres locally via Docker + the Supabase CLI. All
nine migrations applied cleanly, the seed runs, and the full gate is green.

Verification found and fixed two genuine defects — see
[Defects caught by the gate](#defects-caught-by-the-gate).

### Run it yourself

```bash
npm run db:start        # local Supabase in Docker (first run pulls ~2GB)
npm run db:reset        # apply 0001-0009 from scratch
npm run db:seed:local   # catalog + images
npm run db:verify       # the whole gate: 13 + 10 + 21 checks
```

`db:verify` ends in `PHASE 1 GATE: GREEN` or a non-zero exit.

### Still needed from you — pushing to the hosted project

The project now exists: ref **`tyrubexqizwtxmdtopro`**. Its URL and publishable
key are in `.env`, commented out, so the app can be pointed at it by swapping
two lines. Nothing has been pushed to it yet.

Linking needs a browser login and the database password, so it has to be you:

```bash
npx supabase login
npx supabase link --project-ref tyrubexqizwtxmdtopro
npm run db:push        # applies 0001-0009 to the hosted project
npm run db:types
npm run db:seed        # needs .env.seed
```

Then run `supabase/tests/verify_phase1.sql` once in the hosted SQL editor, and
promote yourself:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

The **secret key** (`sb_secret_…`, formerly service_role) bypasses RLS
entirely. It belongs only in `.env.seed` (gitignored) and is used only by the
seed script. Don't paste it into chat — create the file yourself from
`.env.example`. I never need to see it.

None of this blocks Phases 3–7, which build fine against local.

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

### Phase 1 — Database ✅

Nine migrations in `supabase/migrations/`, all applied cleanly to a real
Postgres 15 and verified:

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

Also written and exercised:

- `supabase/config.toml`
- `supabase/seed/seed.mjs` — catalog seed. Verified idempotent: two runs leave
  4 products / 15 variants / 4 images, not 8 / 30 / 8. Converts PNG→WebP on
  upload, which takes the seed photography from ~1100 KB to ~55 KB each.
- `src/lib/supabase/types.ts` — **generated** from the live local schema
  (1515 lines, all 10 RPCs typed). Never hand-edit.

Signup → `profiles` row via trigger works, and the by-hand first-admin
promotion works:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

That is still the only manual step in the system, by design — there is no
bootstrap backdoor. It runs as the SQL editor's superuser session; a signed-in
customer attempting the same statement gets `ROLE_CHANGE_FORBIDDEN`.

### Phase 2 — Shell ✅

Vite + React 19 + TS builds, typechecks, lints and tests clean.

- **Build**: `vite.config.ts` with `@tailwindcss/vite` (no PostCSS), tsconfig
  project references, `vite-tsconfig-paths`, ESLint 9 flat config. `tsc -b` is
  clean — there is no `ignoreBuildErrors` escape hatch here and never will be.
- **Tokens** (`src/styles/globals.css`): whole palette converted to `oklch()`.
  Brand green `#115d33` = `oklch(0.423 0.099 153.5)` stays as `--primary`, but
  is no longer *also* `--foreground`, `--accent`, `--ring` and `--chart-1` —
  with all five identical, `text-accent` was pixel-identical to body text. The
  new `--accent` is a warm brass, and `--success` / `--warning` / `--info` /
  `--destructive` are real tokens so no status ever needs a raw `bg-red-100`.
- **Type**: Poppins self-hosted via `@fontsource`, and `--font-sans` /
  `--font-display` are set in `@theme` — previously the font applied only by
  inheritance because `font-sans` still resolved to the system stack.
- **28 shadcn primitives** in `src/components/ui`, Radix-based, `rsc: false`.
- **Layout**: `RootLayout` / `Header` / `MobileNav` / `Footer`, skip link,
  44px touch targets, cart badge fed by the Zustand store.
- **Router**: every route in the plan resolves, `/admin` is a separate lazy
  chunk (0.22 kB, so storefront visitors never download it), branded 404, and
  a route-level error boundary with retry.
- **`formatBDT`** over `Intl.NumberFormat('en-BD', …)`.

Gate: **35 tests green**, `tsc -b` clean, `eslint` 0 errors, production build
2.2s. Dev server serves the app and deep links resolve.

⚠️ **Not verified in a browser.** No browser automation was available in this
environment, so `src/test/shell.test.tsx` asserts that every route mounts, the
mobile nav opens and closes on navigation, and nothing logs an error — but
nobody has *looked* at it. Worth five minutes with `npm run dev` before
Phase 3 leans on the layout.

---

## The gate — 44 checks, `npm run db:verify`

Not ceremony. Each one pins a specific defect found in the old codebase.

### `verify_phase1.sql` — 13 in-database checks

Runs in a transaction and rolls back, so it is safe against a seeded database.

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
| 9 | Customer **cannot** self-promote — *run as the real `authenticated` role* | the role-guard trigger |
| 10 | `anon` reads 0 rows from `orders` | RLS |
| 11 | `anon` can't see an unopened drop's products | RLS + drop gating |
| 12 | `anon` can't list discount codes | anon key must not be a coupon dump |
| 13 | Discount applies, is spent **once**, exhausted code refused | added after the step-10 reordering below |

### `concurrency.sh` — 10 assertions across 3 race tests

Automated locally; `concurrency.md` keeps the manual procedure for the hosted DB.

- **A** — two buyers, one unit → exactly **one** order, stock `0` never `-1`
- **B** — same key, both in flight → one order, and the loser gets a clean
  `replayed: true`, not a raw `23505`
- **C** — two carts with the same variants in opposite order → **no deadlock**
  (this is what the `order by v.id` locking exists for)

### `rest_check.sh` — 21 checks through PostgREST

The ones the other two structurally cannot make. In-database tests run as
`postgres`; they cannot prove what the public API exposes. A missing `GRANT`,
a policy that never applies to `anon`, or an admin RPC missing its check would
all pass `verify_phase1.sql` and fail here.

This is the curl-against-REST admin check that **Phase 6's gate** calls for,
already green ahead of the admin UI existing.

---

## Defects caught by the gate

Exactly what it was for. Neither was visible by reading the SQL.

**1. The role guard blocked its own bootstrap.** `profiles_guard_role` raised
`ROLE_CHANGE_FORBIDDEN` for *every* session where `is_admin()` was false —
including the SQL editor, where `auth.uid()` is null. So the documented
"promote the first admin by hand" step could never have worked, and there was
no other way to create an admin. The trigger now restricts only `anon` and
`authenticated`, the two roles a browser-side key can reach; a superuser or
`service_role` session is the deliberate bootstrap path. It is no longer
`SECURITY DEFINER`, because inside a definer function `current_user` is always
the owner, which would have made the new check vacuous.

**2. `create_order` was idempotent sequentially but not concurrently.** The
step-1 replay check catches a retry that arrives *after* the first order
commits. Two requests in flight at once both pass it, and the loser took a raw
unique-constraint violation — a customer double-clicking Place Order on a
flaky mobile connection would have seen a database error for an order that
actually succeeded. The insert now catches `unique_violation`, re-reads by
idempotency key, and returns the same `replayed: true` answer. It re-raises if
the conflict was some *other* unique constraint, so an `order_number`
collision can never hand back another customer's `guest_token`.

That fix moved `used_count = used_count + 1` to after the order insert, so a
losing race no longer burns a discount use on an order it never created. The
`FOR UPDATE` lock still sits at validation time, so `max_uses` remains
race-proof. Check 13 was added to cover it.

---

## Still to do

| Phase | Scope | Est. |
|---|---|---|
| **3** | Auth: sign in/up/reset, `RequireAuth`, `RequireAdmin`, profile, address book | 1d |
| **4** | Storefront reads: home, `/shop` with URL-synced filters + ⌘K search, PDP with gallery + variants, collections, articles, drops, early access | 3d |
| **5** | Cart drawer + checkout + MFS QR/TrxID + order confirmation → **first real transaction** | 2.5d |
| **6** | Admin panel: dashboard, products/variants/images, collections, drops, orders, **MFS verification queue**, articles, customers, discounts, settings | 4d |
| **7** | Polish: skeletons, error boundaries, 404, `/contact` `/faq` `/shipping`, SEO, Lighthouse ≥90 mobile, a11y | 2d |
| **8** | Cutover: delete `_legacy/`, deploy with SPA rewrite, production redirect URLs, promote admin | 0.5d |

**~13.5 days remaining.**

### One thing to know before Phase 3

Port **5173 is already taken** on this machine by another project's dev server,
so `npm run dev` falls through to **5174**. That matters for auth: Supabase
redirects are allow-listed, and `supabase/config.toml` currently names
`http://localhost:5173`. Either free the port, or add 5174 to `site_url` /
`additional_redirect_urls` before wiring sign-in, or the email confirmation and
password-reset links will bounce.

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
   rows and covers every write path. It restricts only `anon` and
   `authenticated` — see defect 1 above for why the unrestricted version could
   not be bootstrapped.
4. **Seed is `.mjs`, not `.ts`.** `--experimental-strip-types` needs Node 22.6+.
   Not worth a transpile step for a script that runs a handful of times.
5. **Explicit table `GRANT`s in 0007.** Supabase's default privileges would
   mostly cover this, but relying on them is fragile — and without a grant,
   RLS policies are moot. Note there is deliberately **no** INSERT/UPDATE grant
   on `orders`, `order_items`, or `mfs_transactions` for any role.
6. **bKash/Nagad numbers are placeholders** (`+8801XXXXXXXXX`) per your call.
   Set the real ones in `/admin/settings` once Phase 6 lands — they live in
   `store_settings`, so no redeploy is needed.
7. **Migrations 0002 and 0006 were edited rather than superseded by an 0010.**
   The invariant is "never edit a *pushed* migration"; these had only ever
   been applied to a throwaway local database, and the hosted project does not
   exist yet, so there is no history anywhere to drift from. Once you push to
   the real project, that rule takes effect for good.
8. **The race and REST suites are scripted** (`concurrency.sh`, `rest_check.sh`),
   where the plan described them as manual. Both needed to be re-runnable:
   they are exactly the checks that must pass again after any change to
   `create_order`, and defect 2 was only found because they were cheap to run.
9. **`/admin` uses react-router's route-level `lazy()`, not `React.lazy`.** Same
   outcome — a separate chunk the storefront never downloads — but it is the
   data-router's own mechanism, so it needs no Suspense boundary and will carry
   loaders when Phase 6 wants them.
10. **Unbuilt routes share one `StubPage` rather than 25 placeholder files.**
   The routes exist from Phase 2 so navigation and deep links are testable
   before the screens are; each is swapped for a real module as its phase
   lands. When `StubPage` has no callers left, delete it.
11. **vitest 3, not 2.** vitest 2 pins Vite 5 and the project is on Vite 6, so
   two copies of Vite ended up installed and their plugin types conflicted.
12. **Fonts import the `latin-` subset explicitly.** The unprefixed
   `@fontsource/poppins` entrypoint also emits devanagari and latin-ext, which
   was 370 KB of files in `dist` the storefront never serves.
13. **`paths` is duplicated into the root `tsconfig.json`.** The shadcn CLI
   reads it directly to resolve `@/…`; without it, `shadcn add` silently writes
   components into a literal `./@/` directory instead of `./src/`.
14. **The client env var is `VITE_SUPABASE_PUBLISHABLE_KEY`, not
   `VITE_SUPABASE_ANON_KEY`.** Supabase's dashboard now issues
   `sb_publishable_…` keys in place of the legacy `anon` JWT. Verified against
   the local stack: it resolves to the same `anon` Postgres role, so every
   policy and grant in `0007_rls.sql` applies unchanged and invariant 5 still
   reads the same — the key is public either way.
15. **Supabase's prebuilt shadcn "Library blocks" are deliberately not used.**
   `npx shadcn add @supabase/supabase-client-react-router` would add a second
   Supabase client alongside the typed one in `src/lib/supabase/client.ts`, on
   its own env var names, plus auth components that assume a sign-in wall. This
   project's checkout is guest-first and its admin check is `profiles.role` in
   the database, so the blocks would have to be unpicked rather than adopted.

---

## Known risks

- **Manual MFS is a trust workflow, not a payment gateway.**
  `unique (provider, trx_id)` blocks receipt reuse, but a fabricated TrxID is
  only caught by a human checking the merchant app. `reviewer_id` is always
  logged.
- **Verified on Postgres 15 locally, not yet on the hosted project.** The
  hosted database will be Postgres 17. Nothing in the schema is version-
  sensitive, but `db push` against the real project is still an unrun step —
  run `npm run db:verify`'s SQL there once it exists.
- **All security rests on RLS + in-RPC checks**, because the anon key is public.
  The anon-role checks are not optional, and `rest_check.sh` is the one that
  actually tests them the way a client would.
- **`db:verify` is a local-only harness.** It shells out to `docker exec` and
  assumes the `supabase_db_kochu-storefront` container. It is a development
  gate, not CI.
