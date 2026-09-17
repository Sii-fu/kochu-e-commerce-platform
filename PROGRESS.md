# KOCHU rebuild — progress

Last updated: 2026-09-17 · Phase 6 of 8 — **admin panel, built; DB verification pending** ⚠️

Rebuilding the Next.js 16 / Neon / Drizzle / better-auth storefront in place as a
pure client-side **Vite + React 19 + Supabase** SPA. Full architecture lives in
`CLAUDE.md`. This file tracks state.

---

## Where things stand

Phases 0–3 are done. The hosted project (`tyrubexqizwtxmdtopro`) is live,
migrated, seeded, and has a real promoted admin
(`sifatbinasad@gmail.com`) — see [TODO_HUMAN.md](TODO_HUMAN.md) for the
handful of things that still needed a human (dashboard settings, the DB
password, an actual browser).

Auth is real `supabase.auth`, not stubbed: sign in/up/reset, session +
profile hooks, `<RequireAuth>` / `<RequireAdmin>` route guards, profile form,
address book. Verified both ways — guard behavior against a mocked client in
`src/test/auth-guards.test.tsx`, and the actual signup → trigger → promote →
admin-RPC-succeeds flow run for real against the local Supabase Auth + REST
API (not mocked). See [Phase 3 — Auth](#phase-3--auth--account-shell-).

Verification along the way found and fixed genuine defects — see
[Defects caught by the gate](#defects-caught-by-the-gate).

**Phase 5 (cart + checkout) is done and verified for real** — pushed to the
hosted project and walked end-to-end: guest COD checkout, stock decrement,
the bKash/Nagad TrxID flow, and the new Realtime subscription on
`/account/orders/:id`, all confirmed working by you against
`tyrubexqizwtxmdtopro`. See
[Phase 5 — Cart + checkout](#phase-5--cart--checkout-).

**Phase 6 (the admin panel) is now built** — see
[Phase 6 — Admin panel](#phase-6--admin-panel-️) below. This machine has no
Docker (established during Phase 5), so this session verified it the same
way: everything checkable without a database (`tsc -b`, `eslint`, `vitest`,
`vite build`) is green, but no admin write has actually round-tripped through
the hosted project yet. Unlike Phase 5, this needs no `.env` change and no
new `db push` beyond what Phase 5 already did — the hosted project is already
what `npm run dev` points at. See
[Still to verify before Phase 6 is done](#still-to-verify-before-phase-6-is-done).

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

⚠️ Update: it has now been looked at (see `TODO_HUMAN.md` item 5) — no
errors, stub pages exactly as expected.

### Phase 3 — Auth + account shell ✅

- **`useSession()`** (`src/hooks/useSession.ts`) is the single source of truth
  for who's signed in — wraps `supabase.auth.getSession()` +
  `onAuthStateChange`, with a `loading` flag so a guard can tell "definitely
  signed out" from "haven't checked yet" and avoid bouncing a visitor whose
  session just hasn't rehydrated yet.
- **`useProfile()`** layers `profiles.role` on top via TanStack Query
  (`src/lib/supabase/queries.ts`), cached rather than re-fetched on every
  guard check.
- **`<RequireAuth>`** (`/account/*`) and **`<RequireAdmin>`** (`/admin/*`)
  both honour `?next=`, and both accept optional `children` so the same
  component works as a layout route (`<RequireAuth>` in `routes.tsx`) or a
  direct wrapper (`<RequireAdmin>` inside the lazy `/admin` module, which has
  no nested routes of its own to guard). `<RequireAdmin>` is UX only — the
  real boundary is `is_admin()` re-checked inside every admin RPC.
- **Admin nav link** (header + mobile nav) reads `profiles.role` the same
  way, never an env allowlist.
- **Sign up** handles both email-confirmation modes without knowing which is
  active: branches on whether `data.session` came back, rather than assuming.
- **Password reset** works around a real race: `detectSessionInUrl`
  processes the recovery link at client-module load, before
  `ResetPasswordPage`'s effect subscribes to `onAuthStateChange` — so
  `PASSWORD_RECOVERY` can fire before anyone's listening. Fixed by also
  checking `getSession()` against a `type=recovery` URL hash on mount.
- **Address book** respects `addresses_one_default_per_user` (a unique
  partial index, 0004) by clearing the existing default before setting a new
  one — two sequential statements, acceptable for a non-money table where
  the DB constraint (not app logic) is what actually makes "two defaults"
  impossible.

Verified two ways:

1. **Guard behavior**, mocked — `src/test/auth-guards.test.tsx`: signed-out
   visitor → `/sign-in?next=...`, signed-in non-admin still bounced from
   `/admin` (role is checked, not just "is anyone logged in"). Building this
   also surfaced that every route test was making a real network call once
   `<Header>` started reading `useProfile()` — fixed by mocking
   `@/lib/supabase/client` globally in `src/test/setup.ts`
   (`src/test/mocks/supabase.ts`), which is now the default for all tests.
2. **The actual CLAUDE.md Phase 3 gate**, for real — ran against the local
   Supabase Auth + REST API, not mocked: signup creates a `profiles` row via
   the trigger; a non-admin gets `FORBIDDEN` from `admin_dashboard_stats`;
   promoting by hand (the only bootstrap path) makes the same RPC succeed for
   the same token; a second, separate account still can't self-promote via a
   raw REST `PATCH` (`ROLE_CHANGE_FORBIDDEN`). 8/8.

Gate: 39 tests green (35 shell + 4 new guard tests), `tsc -b` clean, `eslint`
0 errors, production build still splits `/admin` into its own chunk (0.90 kB).

### Phase 4 — Storefront read paths ✅

Home, `/shop` with URL-synced filters + infinite scroll, PDP with
gallery/variants/stock, collections, drops (a real countdown to a real
timestamp — the old app's was `new Date(Date.now() + 7 days)`, recomputed
fresh every render, so it was permanently "7 days out"), early access, and
the article journal (`react-markdown`, since nothing existing covered it).

- **`src/lib/supabase/queries.ts`** grew a full set of typed catalog reads.
  Every one of them relies entirely on RLS to decide what's visible —
  nothing here re-implements `DRAFT`/`ARCHIVED` filtering or drop-window
  gating client-side. That would both leak data over the wire and drift from
  the DB's actual rules the moment a policy changed.
- **`src/lib/supabase/rpc.ts`** — typed wrappers for all 10
  `SECURITY DEFINER` functions, arg names checked against the generated
  types (`p_order_id`, `p_msisdn`, etc.) rather than guessed.
- **`useShopFilters`** reads straight from `useSearchParams`, no
  intermediate `useState` — a reload or a pasted link reconstructs the exact
  same view with nothing to go stale, and every filter change is a real
  navigation entry so the back button works. Price is stored in the URL as
  whole taka (`min=1000`), not poisha.
- **`<ProductGrid>`** stayed purely presentational — headings and filters
  are composed by the page, never baked into the grid. That's the specific
  bug being avoided: the old `ShopGrid` was reused inside a collection page
  and dragged its own "KOCHU Shop" heading and category filter along with
  it, producing a second heading under the collection's own.
- **`<VariantPicker>`** disables a sold-out or admin-deactivated variant but
  still renders it — a customer sees the size exists, just not right now.

Verified directly against the real local database, not just the types:

1. **RLS actually filters what these queries return.** The seeded
   VIP-only product (`structured-corset`, gated behind `winter-preview`'s
   `early_access_at`) is absent from every query shape an anonymous visitor
   can run, and an upcoming drop's products are absent from the `/shop`
   query specifically.
2. **The "survives a reload" mechanism, proven, not assumed.** The same
   filtered query run twice returns byte-identical results — confirming the
   actual premise `useShopFilters` depends on: it's a pure read of the URL,
   with nothing cached in between to drift.
3. **Two PostgREST specifics that only show up by running the query**, not
   from the generated types: an embedded-resource filter
   (`.eq('collections.slug', …)`) is silently a no-op without `!inner` on
   that embed — found and fixed before it shipped as a collection filter
   that looked like it worked but filtered nothing. And `search_tsv` is
   generated with `to_tsvector('simple', …)`, so `textSearch()` needed
   `config: 'simple'` explicitly — the client's default English stemming
   config doesn't error, it just quietly stops matching what's actually
   stored.
4. **The sold-out-variant gate had no real data to exercise.** No seeded
   variant is actually at 0 stock. Added
   `src/features/catalog/VariantPicker.test.tsx` instead: a sold-out and an
   admin-deactivated variant both render disabled-but-visible, and a click
   on either never fires `onSelect`.

Gate: 44 tests green, `tsc -b` clean, `eslint` 0 errors.

⚠️ **Bundle size, flagged for Phase 7, not fixed here.** The main chunk grew
to 701 KB after this phase. `react-markdown`'s parser tree got its own lazy
chunk (route-level `lazy()`, same pattern as `/admin`) since most visitors
browsing products never read an article — that alone brought it to 580 KB.
Not chased further: Phase 5 and 6 will reshape the bundle again, and
Lighthouse performance is explicitly Phase 7's gate.

### Phase 5 — Cart + checkout ✅

Built, typechecked, linted, unit-tested, and then verified for real against
the hosted project (`tyrubexqizwtxmdtopro`) once `.env` was pointed at it and
`0010_realtime.sql` was pushed:

1. `supabase db push` applied `0010_realtime.sql` to hosted.
2. The real CLAUDE.md gate, in a browser against hosted: guest checkout →
   COD → order landed as `PROCESSING` → stock decremented → the confirmation
   link worked and a tampered token was rejected → a double-clicked "Place
   order" produced exactly one order.
3. The bKash/Nagad path: a submitted TrxID flipped `payment_status` to
   `AWAITING_VERIFICATION`; approving it by hand in SQL flipped the order to
   `PAID`/`PROCESSING` and the signed-in `/account/orders/:id` page updated
   live via the new Realtime subscription, with no manual refresh.
4. bKash/Nagad merchant numbers set in `store_settings` so the checkout MFS
   panel shows real numbers, not placeholders.

All confirmed working. Details of what was built: below.

- **`<CartDrawer>`** (`src/features/cart/CartDrawer.tsx`), mounted once in
  `RootLayout` and opened from anywhere via `useUi().setCartOpen`. Renders the
  cart store's display snapshot with zero network, then layers live drift
  warnings on top.
- **`useCartValidation()`** (`src/features/cart/useCartValidation.ts`) is the
  only thing that talks to the database for the cart: on every drawer open /
  checkout mount it re-fetches the live `product_variants` + `products` rows
  for whatever's in the cart and diffs them against the stored snapshot --
  `unavailable` (deactivated or product no longer `ACTIVE`) and
  `out-of-stock` block checkout outright; `price-changed` and `low-stock` are
  shown inline but don't block, since `create_order()` re-derives the real
  price and will reject over-ordering itself. 6 unit tests
  (`useCartValidation.test.tsx`) cover all five branches against a mocked
  Supabase client.
- **`CheckoutPage`** (`src/features/checkout/CheckoutPage.tsx`) is guest-first
  per CLAUDE.md: a signed-out visitor sees an explicit "continue as guest" /
  "sign in" choice *before* any delivery field, never a wall after typing. A
  signed-in visitor skips straight to the form, with saved addresses
  (`getAddresses`) offered as radio picks that prefill the fields, plus "use a
  new address". Discount code preview (`validate_discount`, doesn't spend a
  use) and the shipping preview (`shipping_for`) both call the exact same
  RPCs `create_order()` uses internally, so the number shown here is what
  actually gets charged barring a race between preview and submit --
  `create_order()` is still the one source of truth. The idempotency key is
  `useRef(crypto.randomUUID())`, generated once per mount, not per render or
  per click -- what makes a double-clicked "Place order" resolve to the one
  order the Phase 1 gate's replay logic already proves is safe.
- **`OrderSummaryCard`** (`src/features/checkout/OrderSummaryCard.tsx`) is
  the one place cart/order lines get rendered as a receipt -- shared verbatim
  between checkout, the guest confirmation page, and the signed-in order
  detail page, fed a small normalized `SummaryLine[]` regardless of which of
  the three different underlying shapes (cart store lines, RPC `order_items`
  jsonb, or a direct `order_items` table row) it came from.
- **`MfsPaymentPanel`** (`src/features/checkout/MfsPaymentPanel.tsx`) is the
  manual bKash/Nagad flow CLAUDE.md's known risks section describes: a QR
  code (client-side `qrcode`, encoding just the merchant number -- there's no
  bKash/Nagad payment-URI standard to target) plus the merchant number in
  text, then a form for the sender's number and the TrxID, submitted via
  `submit_mfs_transaction()`. Renders again after a rejection (the RPC resets
  the order to `PENDING_PAYMENT`), so resubmission is just "the panel is back."
- **`OrderConfirmationPage`** (`/order/:id?token=`, top-level, no auth) is the
  only thing an anonymous guest ever uses to track an order, exactly the way
  `get_order_by_token()` was built for. **It polls, not subscribes**: see the
  Realtime note below.
- **Account order pages** (`src/features/account/OrdersPage.tsx`,
  `OrderDetailPage.tsx`) are the signed-in equivalent, reading `orders`
  directly (`orders_select_own_or_admin` in 0007_rls.sql) instead of through
  the token RPC. `OrderDetailPage` subscribes to Postgres Changes on its own
  `orders` row and invalidates the query on any update -- this is the one
  that's actually live, not polling.
- **`checkoutErrorMessage()`** (`src/lib/errors.ts`) maps every `raise
  exception '<CODE>'` string out of `create_order()` and
  `submit_mfs_transaction()` to real copy, the same pattern
  `authErrorMessage()` already used for Supabase Auth errors. Unit-tested.
- **New migration, `0010_realtime.sql`**: adds `orders` to the
  `supabase_realtime` publication. Nothing before Phase 5 needed Postgres
  Changes, so nothing had turned it on. No RLS changes -- Realtime enforces
  the table's existing policy using the connecting role, which is exactly
  what makes polling the only option for a guest (see below).

**Realtime only covers the signed-in order page, by design, not by gap.**
`orders_select_own_or_admin` gives `anon` zero rows on `orders` -- that's
Phase 1 gate check #10, non-negotiable. Realtime authorizes Postgres Changes
through the same RLS as the connecting role, so an anonymous guest literally
cannot subscribe to their own order's changes no matter what the publication
contains. `OrderConfirmationPage` polls every 8s while a payment is
outstanding instead; `/account/orders/:id` gets the real subscription because
a signed-in owner's `user_id = auth.uid()` clause actually lets Realtime
through.

**Gate so far**: 55 tests green (44 prior + 11 new -- `useCartValidation`
×6, `checkoutErrorMessage` ×2, `formatShippingAddress` ×3), `tsc -b` clean,
`eslint src` 0 errors (0 warnings beyond the pre-existing shadcn
fast-refresh ones), production build succeeds. `src/test/shell.test.tsx`'s
existing route list already covered `/checkout`, `/order/:id`,
`/account/orders`, and `/account/orders/:id` as stubs since Phase 2; all four
now render the real pages under a mocked, signed-out, no-network Supabase
client with zero console errors.

### Seed data — expanded for real UI testing ✅

The original seed (4 products, 2 drops, 3 articles, 1 discount code) was
enough to verify RLS but too thin to actually browse. Now: **19 products, 3
collections, 4 drops, 6 articles, 5 discount codes, 5 early-access signups,
5 guest orders** — on both local and the hosted project.

Deliberately includes the edge cases that had no real data behind them
before: a DRAFT and an ARCHIVED product, a fully sold-out product, a
partially sold-out one, low-stock-everywhere, two sale prices, a live drop
with real products attached, an unpublished drop, and discount codes in
every state (active percent, active fixed, expired, exhausted, deactivated).
Photography beyond the original four items is a generated solid-colour
placeholder (`sharp`, no network fetch) — see `supabase/seed/seed.mjs`'s
top comment for the full list of what each row is there to exercise.

Seeding an ended drop exposed a real bug: `getDrops()` classified anything
that failed "is it live" as "upcoming", so an ended drop rendered a
countdown to a start time already in the past. Fixed with a third bucket
(live/upcoming/ended) — see `src/lib/supabase/queries.ts`.

Orders are seeded through the real `create_order()` RPC, never a direct
insert. Walking two to `SHIPPED`/`CANCELLED` couldn't go through
`admin_update_order_status()` though: confirmed directly against the local
stack that a service-role connection has `auth.uid() = null`, so the
function's internal `is_admin()` check fails even though service_role
otherwise bypasses RLS entirely — RLS bypass and an in-function
authorization check are different mechanisms. That transition's
stock-restore logic is replicated directly against the tables instead,
seed-script-only.

Verified: two full seed runs produce identical row counts (idempotent), and
anon sees exactly 15 of 19 products — the 4 missing are exactly the
VIP-gated, archived, draft, and ended-drop ones. Full Phase 1 gate (44
checks) re-run clean on top of the new data.

### Phase 6 — Admin panel ⚠️

Every screen CLAUDE.md's Phase 6 scope calls for is built: dashboard,
products + variants + image reorder, collections, drops (+ a scheduler's
actual job -- publish window fields -- and a VIP grant-access action),
orders with the status transition table, the **MFS verification queue**,
articles with update, customers, discounts, and settings. Typechecked,
linted, and the existing test suite (auth guards, shell smoke test) still
passes with the real admin panel behind `<RequireAdmin>` instead of the old
stub. **Not yet exercised against the hosted project** -- see
[Still to verify before Phase 6 is done](#still-to-verify-before-phase-6-is-done).
Unlike Phase 5, nothing here needs a new `.env` or a new `db push`: this
machine's Docker gap (see Phase 5) doesn't block it, since `.env` already
points at the hosted project and every table Phase 6 writes to
(`products`, `product_variants`, `product_images`, `collections`, `drops`,
`articles`, `discount_codes`, `store_settings`, `profiles`) already exists
there.

- **Data layer is entirely new**: `src/lib/supabase/admin/queries.ts` (reads
  that don't filter to `ACTIVE`/`published`/`active` the way the
  customer-facing `queries.ts` deliberately does -- an admin has to see
  `DRAFT` products and unpublished drops) and
  `src/lib/supabase/admin/mutations.ts` (plain `.insert()/.update()/.delete()`
  calls -- every one of these tables is a `for all to authenticated using
  (is_admin())` policy, not an RPC, confirmed against 0007_rls.sql before
  writing a line of this). `src/lib/supabase/storage.ts` is a new upload
  helper (`{bucket}/{entityId}/{uuid}.ext`, since 0008_storage.sql enforces no
  path convention server-side) plus a signed-URL helper for the one private
  bucket, `mfs-receipts`. `src/lib/validation/admin.ts` has a zod schema per
  entity, mirroring the DB's own CHECK constraints client-side (percent
  1-100, compare-at > price, a drop's window ordering) so those are never the
  first error an admin sees as a raw Postgres exception.
- **`AdminLayout`** replaces the Phase 6 stub with a real sidebar (desktop) /
  horizontal tab bar (narrow) nav across all ten screens.
- **Every admin screen is its own `React.lazy` chunk**, not just statically
  imported into `route.tsx` -- caught by a real test failure, not written in
  up front: the first version statically imported every page (dashboard
  included) at the top of `route.tsx`, so a non-admin merely visiting `/admin`
  to be bounced back to `/sign-in` had to fetch and evaluate the *entire*
  admin bundle first, recharts included, since a dynamic `import()`
  transitively resolves every static import inside the target module before
  any of it can render. `auth-guards.test.tsx`'s signed-out-visitor-hits-/admin
  test started failing on a timeout the moment `DashboardPage` (which imports
  recharts) was added -- not because the redirect logic changed, but because
  the redirect couldn't render until a ~400 KB dependency graph loaded first.
  Splitting every screen into `React.lazy(() => import('./XPage'))` fixed the
  test and is the actually-correct architecture: confirmed in the production
  build that `DashboardPage` is its own 396 KB chunk and the shared
  `route`+`admin` shell a customer bounces through is under 14 KB combined.
- **Dashboard** (`admin_dashboard_stats()`, already existed from Phase 1/0009,
  just never had a caller) -- KPI tiles, a single-series revenue line chart
  (recharts, one hue from `--color-chart-1`, no palette validation needed
  since it's one series, per the dataviz skill's own scoping), and a low-stock
  list linking straight to each product's edit page.
- **MFS verification queue** (`/admin/mfs-queue`) -- CLAUDE.md calls this the
  highest-value screen, and it's the direct sequel to Phase 5's
  `submit_mfs_transaction()`: every `SUBMITTED` transaction, the order it
  belongs to, a signed URL to the receipt screenshot (the one private
  bucket), and Approve/Reject wired to `verify_mfs_transaction()` behind a
  confirmation dialog. Reject takes an admin-only note; the customer never
  sees it (`get_order_by_token()` already stripped `review_note` in Phase 5).
- **Orders** (`/admin/orders`, `/admin/orders/:id`) -- status-filterable list,
  and a detail page built entirely from Phase 5's own `OrderSummaryCard`
  and `formatShippingAddress()` reused verbatim, plus the transition table
  from `admin_update_order_status()` (`0006_functions.sql`) mirrored exactly
  as which buttons are even offered, so an admin can't attempt an invalid
  transition the RPC would just reject anyway.
- **Products** (`/admin/products`, `/admin/products/new`,
  `/admin/products/:id`) -- the most complex screen: a dedicated page (not a
  dialog, given the field count), a `useFieldArray` variants list enforcing
  "at least one variant, even 'One Size'" the same way the DB schema does,
  and an image grid with upload / reorder (persisted as `sort_order`
  updates) / delete, all through the new storage helper.
- **Collections, drops, articles, discount codes** -- the smaller CRUD
  screens, all following the same dialog-for-list-entities pattern as
  Phase 3's `AddressBook`, except articles (a route/page, given the markdown
  body) and products. Drops additionally get a "Grant access" dialog wired
  to `grant_drop_access()` for VIP email allowlisting.
- **Customers** -- a read-only list plus a role-toggle button
  (`profiles.role`, gated by both `profiles_update_admin` and the
  `profiles_guard_role` trigger from Phase 1) so promoting a second admin no
  longer requires the SQL editor. An admin can't demote themselves (the
  button is hidden on your own row) -- self-promotion is already blocked by
  the trigger, but self-*demotion* through this UI would just be confusing,
  not insecure, so it's hidden rather than relied upon as a security control.
- **Settings** -- one form over the single-row `store_settings` table
  (shipping thresholds, bKash/Nagad numbers, support contact, announcement),
  reusing the same public `getStoreSettings()` read Phase 5's checkout page
  already used.
- **`adminErrorMessage()`** (`src/lib/errors.ts`) is `checkoutErrorMessage()`'s
  sibling for the admin-only RPC codes (`FORBIDDEN`, `INVALID_STATUS_TRANSITION`,
  `TRANSACTION_NOT_FOUND`, `TRANSACTION_ALREADY_REVIEWED`). Unit-tested.

**Gate so far**: 61 tests green (55 prior + 4 `adminErrorMessage` cases + 2
regression tests below), `tsc -b` clean, `eslint src` 0 errors, production
build succeeds with the admin panel correctly split into ~15 small chunks
instead of one large one.

#### Defects found on your first real click-through

1. **`session!.user.id` crashed `/account/addresses` and `/account/orders`
   for every real signed-in visitor.** `<RequireAuth>` already resolves a
   session before rendering its children, but `AddressBook`, the account
   `OrdersPage`, and the account `OrderDetailPage` each mount their *own*
   independent `useSession()` call -- a fresh `getSession()` round-trip with
   its own `{session: null, loading: true}` initial state -- so asserting
   `session!.user.id` non-null crashed on the very first render, every time,
   regardless of what the guard upstream already knew. `ProfileForm.tsx`
   (Phase 3) had already solved this correctly -- `session?.user.email` for
   render, `session!.user.id` only inside a deferred `mutationFn` closure --
   but `AddressBook.tsx` (also Phase 3) had the same bug this whole time and
   nothing had ever exercised it in a real browser with a real session before
   now. Fixed all three the same way: `session?.user.id`, `enabled: !!userId`
   on the query, an explicit `sessionLoading` check before the `isLoading`
   skeleton returns. `shell.test.tsx` never caught this because it only ever
   renders these routes signed out, where `<RequireAuth>` redirects before
   the page body mounts -- added
   `src/test/account-session-crash.test.tsx` (2 tests, signed-in this time)
   so it can't regress silently again.
2. **No filters on `/admin/products`.** Added a name search plus status and
   category filters, client-side (the product list isn't paginated, and the
   seed catalog is small enough that this doesn't need a server round trip).
3. **MFS queue Approve/Reject not doing anything, under investigation** --
   see the note in `TODO_HUMAN.md`. Nothing surfaced by reading the code
   against `verify_mfs_transaction()`'s signature and grants; needs a repro
   detail (does the confirmation dialog open? any toast or console error on
   Confirm?) that only shows up in the browser.

#### Still to verify before Phase 6 is done

All of this needs a real click-through against the hosted project as the
promoted admin (`sifatbinasad@gmail.com`) -- nothing here has round-tripped
through Supabase yet:

1. **Products**: create one with two variants and two images, confirm it
   shows up correctly on `/shop` once its status is `ACTIVE`, reorder the
   images and confirm the storefront PDP's gallery order actually changed,
   delete one image and confirm the storage object is actually gone (not
   just the DB row), delete the product and confirm a past order referencing
   it (if any) still renders its snapshot correctly.
2. **MFS queue**: approve one of the pending submissions from Phase 5's own
   manual test and confirm the customer's `/account/orders/:id` page updates
   live (this is the Realtime path Phase 5 verified from the customer side;
   this is the admin side writing the row that triggers it). Reject one and
   confirm it goes back to `PENDING_PAYMENT` and the customer can resubmit.
3. **Orders**: walk one order through `PROCESSING → SHIPPED → DELIVERED` with
   a tracking code, and separately cancel a `PROCESSING` order and confirm
   stock is actually restored in `product_variants` -- then attempt to
   cancel it again and confirm nothing double-restores (`stock_released`).
4. **Collections/drops/articles/discounts**: one create + edit + delete pass
   each, confirming cover images/featured images actually upload and render,
   and that a drop's "Grant access" actually lets that emailed customer
   through the drop's window early.
5. **Customers**: promote a second account to admin, sign in as it, confirm
   it can reach `/admin`; demote it back and confirm it's bounced again.
6. **A non-admin JWT gets `FORBIDDEN` from every admin RPC, over curl against
   the REST endpoint, not just through the UI** -- this is CLAUDE.md's
   explicit Phase 6 gate line. `verify_mfs_transaction` and
   `admin_update_order_status` were already covered by Phase 4's
   `rest_check.sh` scaffolding pattern; `grant_drop_access` and
   `admin_dashboard_stats` should be added to that script and re-run.

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
| **5** | Cart drawer + checkout + MFS QR/TrxID + order confirmation → **first real transaction** -- ✅ done, verified against hosted | — |
| **6** | Admin panel: dashboard, products/variants/images, collections, drops, orders, **MFS verification queue**, articles, customers, discounts, settings -- built, DB-unverified (see above) | — |
| **7** | Polish: skeletons, error boundaries, 404, `/contact` `/faq` `/shipping`, SEO, Lighthouse ≥90 mobile, a11y, **bundle size** (see Phase 4 note) | 2d |
| **8** | Cutover: delete `_legacy/`, deploy with SPA rewrite, production redirect URLs, promote admin | 0.5d |

**~2.5 days remaining**, once Phase 6's DB verification (above) is done.

Note: `/shop`'s ⌘K instant search over `pg_trgm` (listed in the original plan
under Phase 4) did not land — the shop page's own search box covers the
"find a product" need via `search_tsv`. The command palette is deferred, not
dropped; revisit if it's still wanted once Phase 6 exists and there's more to
search across (orders, customers) where a palette earns its keep more than it
does over a four-product seed catalog.

### Port 5173 vs 5174 — resolved

Port 5173 is taken by another project on this machine, so `npm run dev` falls
through to 5174. Local `config.toml` now lists both in
`additional_redirect_urls`. The hosted project's equivalent — Authentication →
URL Configuration → Redirect URLs — was a dashboard-only setting the CLI
can't push; done by hand per `TODO_HUMAN.md` item 4.

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
16. **The guest order confirmation page polls; only the signed-in account
   order page subscribes to Realtime.** The plan's line ("order detail pages
   subscribe to Supabase Realtime") reads as if this were uniform. It can't
   be: `orders_select_own_or_admin` gives `anon` zero rows on `orders` by
   design (Phase 1 gate check #10), and Realtime authorizes Postgres Changes
   through that same RLS using the connecting role. A guest session has no
   row-level access to subscribe to, token or not. `/order/:id` polls every
   8s while a payment is outstanding instead; `/account/orders/:id` is the
   one that actually subscribes, because a signed-in owner's row *is*
   visible to their own role.
17. **The whole `/admin` subtree is one react-router `lazy()` boundary
   (deviation #9), but every screen inside it is its own `React.lazy()`
   chunk on top of that.** These solve different problems and both turned
   out necessary. The outer boundary keeps admin code out of the storefront
   bundle entirely. But a static `import` of every screen at the top of
   `route.tsx` still meant the entire admin dependency graph -- recharts
   included -- had to load before `<RequireAdmin>` could even render a
   redirect, since a dynamic `import()` transitively resolves every module
   its target statically imports before any of it runs. This wasn't a
   theoretical concern: `auth-guards.test.tsx`'s signed-out-visitor-hits-`/admin`
   test started failing on a timeout the moment `DashboardPage` (which
   imports recharts) existed, purely from the added transform/evaluation
   weight, with the redirect logic itself unchanged. `React.lazy()` per
   screen, wrapped in one `<Suspense>` inside the descendant `<Routes>`,
   fixed it and is confirmed in the production build: `DashboardPage` is its
   own ~396 KB chunk, and the shared shell a bounced visitor actually
   downloads is under 14 KB.
18. **`route.tsx` renders a descendant `<Routes>` rather than routes.tsx
   listing `/admin`'s children statically.** React Router's `lazy()` cannot
   itself supply `path`/`children` -- the router needs the full route tree
   before code-splitting resolves -- so routes.tsx keeps its single
   `{ path: 'admin/*', lazy: ... }` entry from Phase 2, and `Component`
   hands off routing for everything under that splat to its own `<Routes>`
   tree. This is the standard, sanctioned pattern for "lazily load an entire
   section with its own internal routing," not a workaround.

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
- **Phase 5 was built without Docker available in-session.** Everything
  static (`tsc -b`, `eslint`, `vitest`, `vite build`) is green, but no RPC has
  actually been called against a real Postgres since Phase 4. Treat the
  checkout flow as unverified until someone runs the steps in
  [Still to verify before Phase 5 is done](#still-to-verify-before-phase-5-is-done).
