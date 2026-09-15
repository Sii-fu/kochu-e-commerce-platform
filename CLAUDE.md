# CLAUDE.md — KOCHU Storefront

Guidance for Claude Code when working in `kochu-e-commerce-platform`.

## What this project is

KOCHU is a Dhaka-based fashion label (`@kochu.bd`). This repo is being rebuilt **in place** from a
Next.js 16 + Neon/Drizzle + better-auth app into a **pure client-side React 19 + Vite SPA talking
directly to Supabase**. There is no application server. All integrity lives in the database:
`SECURITY DEFINER` RPCs, RLS, and role-based access control.

The old code is quarantined in `_legacy/` as a read-only reference. Copy forward from it; never
import from it. It is deleted at the end of Phase 8.

## Stack

| Layer | Choice |
|---|---|
| Build | Vite + React 19 + TypeScript |
| Routing | react-router (`createBrowserRouter`), `React.lazy` for the whole `/admin` tree |
| Server state | TanStack Query — **all** of it |
| Client state | Zustand (cart, drawers, filter drafts) — **only** this |
| Forms | react-hook-form + zod (`@hookform/resolvers`) |
| Styling | Tailwind v4 via `@tailwindcss/vite` (not PostCSS) |
| Components | shadcn/ui, Radix-based, `rsc: false` |
| Backend | Supabase (Postgres + Auth + Storage + Realtime). No Edge Functions. |
| Charts | recharts · Carousel: embla · Toasts: sonner · QR: qrcode |

Removed and never to be reintroduced: `next`, `stripe` and all `@stripe/*`, `next-stripe`,
`@vercel/blob`, `@vercel/analytics`, `pg`, `drizzle-orm`, `better-auth`, `@base-ui/react`, `postcss`.

## Commands

```bash
npm run dev                 # Vite dev server
npm run build && npm run preview
npm run lint
npm run test                # vitest

supabase db push            # apply supabase/migrations/*.sql
supabase gen types typescript --local > src/lib/supabase/types.ts
node --env-file=.env.seed supabase/seed/seed.ts
```

Env: `.env` holds **only** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The service-role key
lives in a gitignored `.env.seed` and is used solely by the seed script. It must never appear in
`src/`, in a `VITE_`-prefixed variable, or in any committed file.

## Non-negotiable invariants

These are the defects the rebuild exists to fix. Do not regress them.

1. **Money is integer poisha.** Every money column is `integer` and named `*_minor` (1 ৳ = 100
   poisha). No `numeric`, no floats, no client-side arithmetic on display strings. Format only at
   the edge via `formatBDT(minor)` / the `<Price>` component. BDT only.
2. **The client never sends prices.** Checkout posts variant ids and quantities. `create_order()`
   re-derives every price, discount, and shipping amount from the database. A payload with
   `price: 1` gets charged the real price.
3. **Money and stock tables have no INSERT/UPDATE policy at all.** `orders`, `order_items`,
   `mfs_transactions`, and stock changes are reachable *only* through `SECURITY DEFINER` RPCs.
   Everything else is `is_admin()` for writes plus a narrow read predicate.
4. **Every `SECURITY DEFINER` function sets `search_path = public, pg_temp`** and re-checks
   authorization internally — `is_admin()` at the top of admin RPCs, ownership or `guest_token`
   checks on customer RPCs. This is the highest-risk surface in a zero-backend design.
5. **The anon key is public.** It ships in the JS bundle. Nothing may rely on it being secret.
6. **Admin is `profiles.role = 'admin'`,** checked in the DB. Never an env allowlist, never a
   client-side email comparison. `role` is pinned by the `profiles` UPDATE policy's `with check`,
   so a customer cannot self-promote.
7. **Migrations are the only schema artifact.** Every schema change is a new numbered file in
   `supabase/migrations/`, applied with `supabase db push`, followed by regenerating
   `src/lib/supabase/types.ts`. Never edit a pushed migration. Never hand-edit the schema in the
   dashboard. Schema drift is the original sin of the old codebase.
8. **`typescript.ignoreBuildErrors` has no equivalent here and never will.** A red type check
   blocks the phase.

## Database

Migrations `0001`–`0009`: extensions/enums → profiles+RBAC → catalog → commerce → content →
functions → RLS → storage → indexes/views.

Enums replace the old free-text status columns: `user_role`, `product_status`, `order_status`,
`payment_status`, `payment_method`, `mfs_status`, `discount_type`.

**Every product has at least one variant**, even single-size items (`"One Size"`). There is no
"stock on product or on variant" branching. `product_variants.stock` carries
`check (stock >= 0)` as the last line of defence against oversell.

`order_items` snapshots `product_name`, `variant_label`, `image_path`, and `unit_price_minor`, with
FKs `on delete set null`, so order history stays readable after a product is deleted.

### RPCs (`src/lib/supabase/rpc.ts` wraps each one, typed)

| Function | Notes |
|---|---|
| `create_order(payload jsonb)` | The security core. Idempotent on `idempotency_key` (UNIQUE) — replay returns the original order. Locks variants `for no key update` **ordered by `v.id`** to avoid deadlocks under drop traffic. Validates status, stock, drop window, discount. Inserts order + items and decrements stock in the same transaction. Returns `{order_id, guest_token, order_number, total_minor, replayed}`. |
| `validate_discount(code, subtotal_minor)` | Read-only preview for the UI. Does **not** increment `used_count`. |
| `get_order_by_token(order_id, token)` | The only way an anonymous visitor reads an order. |
| `submit_mfs_transaction(...)` | Customer submits TrxID → `payment_status = 'AWAITING_VERIFICATION'`. Rejects on method mismatch or duplicate `(provider, trx_id)`. |
| `verify_mfs_transaction(tx_id, approve, note)` | Admin-only. Approve → `PAID` + `PROCESSING`. Reject → back to `PENDING_PAYMENT`/`UNPAID` so the customer can resubmit. |
| `admin_update_order_status(...)` | Admin-only. Enforces the transition table and restores variant stock on `CANCELLED`, guarded by `orders.stock_released`. |
| `shipping_for(subtotal_minor)` | Reads the single-row `store_settings`. No hardcoded thresholds anywhere in the UI. |
| `grant_drop_access` / `redeem_drop_key` | VIP whitelist and self-service key redemption. |

Order status transitions:

```
PENDING_PAYMENT → PROCESSING | CANCELLED
PROCESSING      → SHIPPED    | CANCELLED
SHIPPED         → DELIVERED  | CANCELLED
DELIVERED, CANCELLED → terminal
```

**`create_order` is one transaction. Keep it that way** — no emails, no webhooks, no external calls
inside it. If notifications are wanted later, write to an outbox table in the same transaction and
drain it separately.

### Storage

Buckets: `products`, `articles`, `drops` (public read, admin write) and `mfs-receipts` (anyone may
insert — guests pay too; only admins may select). Paths are `products/{product_id}/{uuid}.webp` so a
product's folder can be cleared in one call. Use `getPublicUrl()` directly. There is no image proxy
route and none is to be added.

## Frontend conventions

- **Server state is TanStack Query; client state is Zustand.** Putting server data in Zustand
  produces the exact stale-cart bug the old app had. Do not do it.
- **Cart store** (`persist("kochu-cart-v2")`) holds a display snapshot:
  `{ variantId, productId, slug, name, variantLabel, imagePath, unitPriceMinor, quantity }[]`.
  It exists so the drawer renders instantly with zero network. It is display-only — `create_order`
  ignores it and re-prices from the DB. `useCartValidation()` revalidates on drawer open and flags
  drift inline ("Price updated", "Only 2 left") with a remove affordance, rather than failing at
  submit.
- **Never fetch the catalog to resolve cart ids.** That was the old `/cart` page's bug.
- **Cart is a `Sheet` drawer**, not a page, openable from anywhere.
- **Checkout is guest-first.** The choice ("checkout as guest, or sign in for saved addresses") is
  offered before any typing. No sign-in wall after the form is filled.
- **Idempotency key** is generated once per checkout attempt with `useRef`, not per render.
- **Filters are URL-synced** (category, collection, price range, in-stock, sort) so views are
  shareable and the back button works.
- **Every mutation gives feedback**: inline zod errors before submit, disabled + spinner while
  pending, sonner toast on success, optimistic table updates with rollback. Destructive actions use
  `AlertDialog`, never `window.confirm`.
- **Every surface has skeleton, empty, and error states.** Route-level `ErrorBoundary` with retry,
  branded 404. No flash of "no longer available" before a fetch resolves.
- **`<ProductImage>`** renders a branded fallback on error. There is no magic `/placeholder.png`.
- Guards are route-level: `<RequireAuth>` for `/account/*`, `<RequireAdmin>` for `/admin/*`.
  `/admin` honours `?next=` and sign-in must actually return there. The admin nav link renders only
  when `profiles.role = 'admin'`.
- Order detail pages subscribe to Supabase Realtime on the `orders` row, so an admin marking an
  order shipped updates the customer's open tab live.
- Touch targets ≥ 44px. Mobile is the majority of traffic.

## Design tokens

Brand green `#115d33` stays as `--primary`; `--radius: 0.375rem`. Introduce a **distinct warm
accent** for sale badges, drop timers, and MFS status — currently `--foreground`, `--primary`,
`--accent`, `--ring`, and `--chart-1` are all the same colour, so `text-accent` carries zero
emphasis. Convert the whole palette to `oklch()`. Route all status colours through tokens; no raw
`bg-red-100` / `bg-green-100`. Set `--font-sans` / `--font-display` in `@theme` and self-host
Poppins with `font-display: swap` — today the font applies only by inheritance.

## Directory layout

```
src/
  lib/supabase/{client,types,queries,rpc}.ts   types.ts is GENERATED — never hand-edit
  lib/{money,errors,utils}.ts  lib/validation/ zod schemas shared by forms + RPC payloads
  components/{ui,layout,common}/
  features/{catalog,cart,checkout,account,drops,articles,auth,admin}/
  hooks/  store/{cart,ui}.ts  styles/globals.css  routes.tsx  main.tsx
supabase/{config.toml,migrations/,seed/seed.ts}
```

Feature folders own their components; `components/ui` is shadcn primitives only; `components/common`
is cross-feature (`ProductImage`, `Price`, `Countdown`, `StockBadge`, `EmptyState`, `ErrorState`).
`<ProductGrid>` is purely presentational — headings and filters are composed by the page, never
baked into the grid.

## Roadmap — phase gates

Do not start a phase until the previous one's check passes.

- **Phase 0 — Safety net (0.5d).** `git init`, commit the tree as-is, tag `pre-rebuild`, quarantine
  into `_legacy/`, recover assets. ✅ one commit contains the full original app.
- **Phase 1 — Database first (2d).** Migrations 0001–0009, generated types, seed script. ✅ verified
  **in the SQL editor before any frontend exists**: valid cart decrements stock; same
  `idempotency_key` twice returns one order and decrements once; hand-edited price is ignored;
  over-ordering raises `INSUFFICIENT_STOCK` and writes nothing; two concurrent orders on the last
  unit → one succeeds, one raises; as `anon`, `select * from orders` returns 0 rows and
  `update profiles set role='admin'` is blocked; an unpublished drop's products are invisible to
  anon and visible to a `drop_access` holder after `early_access_at`.
- **Phase 2 — Shell (1d).** Vite, tokens, primitives, router stubs, providers, layout. ✅ every route
  renders, mobile nav opens, ৳ formatting correct, no console errors.
- **Phase 3 — Auth + account shell (1d).** ✅ signup creates a `profiles` row via trigger; `/admin`
  bounces a customer to `/sign-in?next=/admin` and returns there after login.
- **Phase 4 — Storefront read paths (3d).** ✅ filter state survives reload and a shared URL; sold-out
  variants disabled on the PDP; an upcoming drop's products are absent from `/shop`.
- **Phase 5 — Cart + checkout (2.5d).** ✅ first real transaction: guest COD order end-to-end; order
  is `PROCESSING`; stock decremented; confirmation link works in incognito and fails with a wrong
  token; double-clicking Place Order creates exactly one order.
- **Phase 6 — Admin panel (4d).** Dashboard, products + variants + image reorder, collections,
  drops scheduler, orders, **MFS verification queue** (highest-value screen), articles with update,
  customers, discounts, settings. ✅ approving an MFS transaction flips the order to
  `PAID`/`PROCESSING` and the customer's open page updates live; cancelling a shipped order restores
  stock; a second cancel does not double-restore; a non-admin JWT gets `FORBIDDEN` from every admin
  RPC — **tested with curl against the REST endpoint, not just through the UI**.
- **Phase 7 — Polish (2d).** ✅ Lighthouse ≥ 90 mobile on `/`, `/shop`, PDP; checkout completable by
  keyboard alone.
- **Phase 8 — Cutover (0.5d).** Delete `_legacy/`, rewrite this file's stack notes if anything
  changed, deploy static build with SPA rewrite to `index.html`, set production redirect URLs,
  promote the real admin, rotate the anon key if it leaked. ✅ a deep link like `/product/some-slug`
  loads directly, not just via client navigation.

## Known risks

- Manual MFS is a **trust workflow, not a payment gateway**. `unique (provider, trx_id)` blocks
  receipt reuse, but a fake TrxID is only caught by a human checking the merchant app. Keep the
  admin queue's order context rich, and always log `reviewer_id`.
- Concurrent drop traffic is the stress case. Load-test a drop launch before the first real one.
- All security rests on RLS and in-RPC checks. The Phase 1 anon-role checks are not optional.

## Things not to do

- Do not add an API route, server action, Edge Function, or any server-side runtime.
- Do not add Stripe or any card gateway. Payments are bKash + Nagad (manual MFS) + COD.
- Do not use `numeric`/float for money, or `Number` arithmetic on prices in the client.
- Do not write to `orders`, `order_items`, `mfs_transactions`, or `product_variants.stock` from the
  client under any circumstance.
- Do not add a `using (true)` write policy to any table.
- Do not hand-edit `src/lib/supabase/types.ts` or a migration that has been pushed.
- Do not mix `@base-ui/react` primitives with the Radix-based shadcn set — the old `button.tsx` is
  discarded, not ported.
- Do not import anything from `_legacy/`.