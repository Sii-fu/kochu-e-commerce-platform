# Things only you can do

These need your hands — a dashboard login, a password, a key I'm not allowed
to see, or a browser. Everything else I can keep doing on my own.

---

## ✅ All clear as of Phase 3

Everything below this line is done:

1. **Hosted database seeded.** Catalog, collections, drops, articles, images
   all on `tyrubexqizwtxmdtopro`.
2. **Admin account exists and is promoted** —
   `sifatbinasad@gmail.com` has `role = 'admin'` on the hosted project
   (verified by querying `profiles` directly).
3. **Hosted security core verified over REST** (10/10) by me, since I don't
   have the DB password: catalog reads, RLS denial on
   `orders`/`discount_codes`/`profiles`, the VIP-drop product staying hidden,
   and the full guest-checkout path (`create_order` ignoring a client-sent
   price, idempotency replay, right/wrong `guest_token`). The
   `verify_phase1.sql` script's *internal* checks (concurrent-order locking,
   the role-guard trigger) are still unverified on hosted specifically, but
   are proven on local against the identical migrations — low risk, and
   optional if you want the belt-and-suspenders version later (needs the DB
   password from Project Settings → Database).
4. **Redirect URLs** — `localhost:5174` added to both the local
   `config.toml` and the hosted dashboard's Authentication → URL
   Configuration.
5. **Browser check** — done, no errors, stub pages as expected for Phase 2.
6. **Phase 3 auth flow verified for real** against the local stack by me:
   signup → `profiles` row via trigger → non-admin gets `FORBIDDEN` from an
   admin RPC → promoting by hand makes it succeed → a different account still
   can't self-promote. 8/8, over the real Auth + REST API, not mocked.
7. **`.env` pointed at the hosted project** (`tyrubexqizwtxmdtopro`) — this
   machine has no Docker, so local Supabase was never an option here; you
   grabbed the Project URL and publishable key from the dashboard yourself.
8. **Migration `0010_realtime.sql` pushed to hosted** via
   `npx supabase login && npx supabase link --project-ref tyrubexqizwtxmdtopro
   && npx supabase db push`.
9. **The full Phase 5 checkout gate, walked by hand against hosted**: guest
   COD checkout → order landed `PROCESSING` → stock decremented → the
   confirmation link worked and a tampered token was rejected →
   double-clicking "Place order" produced exactly one order → the
   bKash/Nagad path (submit TrxID → `AWAITING_VERIFICATION` → approved by
   hand in SQL → the signed-in `/account/orders/:id` page updated live via
   the new Realtime subscription, no refresh needed).
10. **Real bKash/Nagad merchant numbers set** in `store_settings`, replacing
   the `+8801XXXXXXXXX` placeholders.

Nothing is currently blocking Phase 6.

---

## Needed before Phase 6 can be called done

Phase 6 (the admin panel) got built and typechecked/linted/tested the same
way Phase 5 was, but **nothing here has round-tripped through Supabase yet**.
The good news: unlike Phase 5, this needs no new `.env` change and no new
`db push` — `.env` already points at hosted from Phase 5, and every table
the admin panel writes to already exists there. This is purely a "click
through it as the admin account" pass:

1. **Products** (`/admin/products/new`): create one with two variants and
   two images, set it `ACTIVE`, confirm it shows up on `/shop` and its
   gallery order matches what you set. Delete an image and confirm it's
   actually gone from Storage, not just the product row.
2. **MFS queue** (`/admin/mfs-queue`): approve or reject one of the pending
   submissions from your own Phase 5 testing and confirm the customer-side
   `/account/orders/:id` page updates live.
3. **Orders** (`/admin/orders`): walk one order `PROCESSING → SHIPPED →
   DELIVERED` with a tracking code; separately, cancel a `PROCESSING` order
   and confirm stock is restored in `product_variants` — then try cancelling
   it again and confirm nothing double-restores.
4. **Collections / drops / articles / discount codes**: one create-edit-delete
   pass each, confirming cover/featured images actually upload, and that a
   drop's "Grant access" actually lets that customer in early.
5. **Customers**: promote a second account to admin from the Customers page,
   sign in as it and confirm `/admin` is reachable, then demote it back.
6. **curl the admin RPCs as a non-admin JWT** and confirm `FORBIDDEN` from
   `grant_drop_access` and `admin_dashboard_stats` specifically — CLAUDE.md's
   explicit Phase 6 gate line, and the two RPCs Phase 6 added that Phase 4's
   `rest_check.sh` pattern doesn't cover yet (`verify_mfs_transaction` and
   `admin_update_order_status` were already exercised there).

Tell me what you find and I'll fix anything that doesn't work — I just can't
click through the browser myself.

## Optional, whenever it's convenient

- **Run `verify_phase1.sql` on the hosted SQL Editor or via `psql`** for the
  belt-and-suspenders confirmation mentioned in item 3 of the section above
  the fold. Needs the database password (Project Settings → Database →
  Connection string).

---

## What's next

Phase 5 (cart + checkout) is done and verified against hosted. Phase 6 (the
admin panel) is built but unverified — see the section above. Once that's
confirmed working for real, Phase 7 (polish: skeletons, error boundaries,
SEO, Lighthouse, a11y, bundle size) is next.
