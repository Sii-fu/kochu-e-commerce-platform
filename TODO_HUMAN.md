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

Once seeded, sign up through the app (once Phase 3 auth exists) **or** create
the user directly in the Supabase dashboard: **Authentication → Users → Add
user**. Use your real email.

Then, in the hosted project's **SQL Editor**, run:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

(Swap in the email you actually signed up with.)

**Tell me:** the email you used, so I know which account to expect as admin
when building the admin panel.

---

## 3. Run the Phase 1 gate against the hosted database

This has only been verified against the *local* Docker stack so far, not the
real project. In the hosted **SQL Editor**, paste and run the contents of:

```
supabase/tests/verify_phase1.sql
```

It ends with either:

```
================================
 PHASE 1: ALL CHECKS PASSED
================================
```

...or a `FAIL` line with a specific check number.

**Tell me:** "hosted gate passed" — or paste whatever error/FAIL line you see.

---

## 4. Free up port 5173 (or accept 5174)

Something else on your machine is already running a dev server on port 5173,
so ours falls back to **5174**. This matters because Supabase's auth
redirects are allow-listed by URL — `supabase/config.toml` currently only
lists `5173`.

Pick one:

- **(a)** Stop whatever's using 5173 (check what it is before killing it —
  `netstat -ano | findstr :5173` on Windows, then `Get-Process -Id <PID>` in
  PowerShell), or
- **(b)** Tell me to add `http://localhost:5174` to the redirect allow-list —
  I can do this one myself, just flagging it so you know why sign-in might
  fail on the wrong port otherwise.

**Tell me:** which option, or just "leave it, add 5174" and I'll handle it.

---

## 5. Look at the app in an actual browser

I don't have browser automation in this environment, so nothing has been
*looked at* yet — only tested programmatically (route mounts, no console
errors, etc.).

```bash
npm run dev
```

Open whatever port it lands on (5173 or 5174), click around. Right now every
page is a placeholder ("This screen arrives in Phase N") — you're checking
that the header, mobile nav (resize the window or use dev tools' device mode),
footer links, and overall look feel right before more gets built on top.

**Tell me:** looks fine — or describe/screenshot anything that looks off.

---

## Not blocking, but your call later

- **bKash / Nagad merchant numbers** are placeholders (`+8801XXXXXXXXX`) in
  the seed data. Real numbers can go into `/admin/settings` once Phase 6
  exists — no code change needed, they live in the `store_settings` table.
- **Rotate the anon/publishable key** only if it ever leaks somewhere it
  shouldn't (it's meant to be public, so this is a low-priority note, not an
  urgent one).
