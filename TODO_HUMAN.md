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

Nothing is currently blocking Phase 4.

---

## Optional, whenever it's convenient

- **Run `verify_phase1.sql` on the hosted SQL Editor or via `psql`** for the
  belt-and-suspenders confirmation mentioned in item 3 above. Needs the
  database password (Project Settings → Database → Connection string).
- **bKash / Nagad merchant numbers** are still placeholders
  (`+8801XXXXXXXXX`) in the seed data. They go into `/admin/settings` once
  Phase 6 exists — no code change needed, they live in the `store_settings`
  table.

---

## What's next

Phase 4 (storefront browsing) is done — 44 tests green, verified against the
real local database. Worth 5-10 minutes with `npm run dev` when you get a
chance: browse `/shop`, filter by category/price, open a product, check
`/drops`, `/collections`, `/articles`. Nothing's blocking Phase 5 (cart +
checkout — the first real transaction) either way; I'll start it now.
