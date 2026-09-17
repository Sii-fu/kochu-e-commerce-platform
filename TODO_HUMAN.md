# Things only you can do

These need your hands — a dashboard login, a password, a key I'm not allowed
to see, or a browser. Everything else I can keep doing on my own. Work through
this top to bottom; each numbered task says what to tell me when it's done.

---

## 1. Seed the hosted database

The hosted project (`tyrubexqizwtxmdtopro`) has the schema pushed, but no
data and no admin account yet.

**Create a new file** at the repo root named `.env.seed` (note: no `.local`,
different from anything else you may have). Do not paste this file's contents
into chat with me — I never need to see the secret key.

```
SUPABASE_URL=https://tyrubexqizwtxmdtopro.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

Get the secret key from the Supabase dashboard: **Project Settings → API →
Project API keys → `secret` / `service_role`**. It's the one the dashboard
warns you not to expose — that's correct, this file is gitignored specifically
for it.

Then run:

```bash
npm run db:seed
```

**Tell me:** "seeded" — or paste the terminal output if it errors.

---

## 2. Create your admin account

⚠️ **Still not done** — the SQL you ran used the literal placeholder text
`you@example.com`, which matched zero rows (no such profile exists), so
nothing was promoted.

Also worth knowing, confirmed by testing just now: the **hosted** project
validates signup emails against real DNS and enforces email rate limits
(unlike the local stack, which accepts anything). So this has to be a real
email address you can receive mail at — no `@example.com`, no made-up domain.

Easiest path — the dashboard, no auth UI needed yet:
**Authentication → Users → Add user**, use your real email.

Then, in the hosted project's **SQL Editor**, run the same statement but with
*that* email:

```sql
update profiles set role = 'admin' where email = 'your-real-email@...';
```

**Tell me:** the email you actually used, so I know which account to expect
as admin when building the admin panel.

---

## 3. Run the Phase 1 gate against the hosted database

✅ **Partly done, by me.** `verify_phase1.sql` needs a direct Postgres
connection (the DB password) to run its `do $$ ... $$` blocks, which I don't
have and won't ask you for over chat. But most of what it checks is also
reachable through the public REST API, so I ran that version myself against
the real hosted project instead of waiting: catalog reads, RLS denial on
`orders`/`discount_codes`/`profiles`, a hidden VIP-drop product, stock not
writable, and the full guest-checkout security core (`create_order` ignoring
a client-sent price, idempotency replay via `guest_token`, right/wrong token
access). **10/10 passed**, then I deleted the one test order it created.

What that couldn't cover: the admin-only RPCs (needs #2 done first) and a
couple of internal checks that only `verify_phase1.sql` exercises directly
(concurrent-order locking, the role-self-promotion guard). Those are already
proven on the *local* stack against the same migrations, so this is
low-risk — but if you want the belt-and-suspenders version:

You'll need the database password (**Project Settings → Database →
Connection string**, or reset it there if you don't have it saved) to open a
direct SQL session — either the dashboard's **SQL Editor**, or `psql`. Paste
and run:

```
supabase/tests/verify_phase1.sql
```

It reports via `RAISE NOTICE`, which shows in the **Messages/Logs** panel
below the results grid, not as query rows — that's why your last run showed
"Success. No rows returned." with no other signal either way. Ends in:

```
================================
 PHASE 1: ALL CHECKS PASSED
================================
```

...or a `FAIL` line naming a specific check.

**Tell me:** nothing required here — treat this one as optional now.

---

## 4. Free up port 5173 (or accept 5174)

Something else on your machine is already running a dev server on port 5173,
so ours falls back to **5174**. This matters because Supabase's auth
redirects are allow-listed by URL — `supabase/config.toml` currently only
lists `5173`.

✅ Picked **(b)** — I added `http://localhost:5174` to
`supabase/config.toml`'s `additional_redirect_urls`, so the **local** stack
now accepts either port.

⚠️ **One step is still yours.** `config.toml` only governs the local Docker
stack — it's not something `supabase db push` or any CLI command syncs to the
hosted project's auth settings. For the **hosted** project, add it by hand:
**Authentication → URL Configuration → Redirect URLs**, add
`http://localhost:5174`. Needed before sign-in against the hosted project
will work from the port we're actually running on.

**Tell me:** "done" once added — or if you'd rather free up 5173 instead
(check what's using it first: `netstat -ano | findstr :5173`, then
`Get-Process -Id <PID>` in PowerShell), that works too and needs no dashboard
change.

---

## 5. Look at the app in an actual browser

✅ **Done, thanks.** No console errors, and "This screen arrives in Phase N"
on almost every page is exactly the expected state right now — Phase 2 only
built the shell (header, mobile nav, footer, router, design tokens), not the
actual screens. Those stub pages get replaced one phase at a time from here.

---

## Not blocking, but your call later

- **bKash / Nagad merchant numbers** are placeholders (`+8801XXXXXXXXX`) in
  the seed data. Real numbers can go into `/admin/settings` once Phase 6
  exists — no code change needed, they live in the `store_settings` table.
- **Rotate the anon/publishable key** only if it ever leaks somewhere it
  shouldn't (it's meant to be public, so this is a low-priority note, not an
  urgent one).
