-- 0002_profiles_rbac.sql
-- Profiles, the role model, and the admin predicate.
--
-- Replaces the old ADMIN_EMAILS env allowlist (lib/admin.ts), which had no
-- database representation at all and failed closed for every user when the
-- variable was empty. Admin is now a column, checked in the database.

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      citext not null,
  full_name  text,
  phone      text,
  avatar_url text,
  role       user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column profiles.role is
  'Never client-writable. The profiles UPDATE policy pins this value; only an
   admin-scoped policy may change it. Promote the first admin by hand.';

-- SECURITY DEFINER so that policies *on* profiles can call this without
-- recursing through profiles'' own RLS. STABLE so the planner evaluates it
-- once per statement rather than once per row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Granted to anon as well: RLS policies that apply to the anon role reference
-- is_admin(), and a policy cannot call a function the role may not execute.
-- For anon it short-circuits to false, since auth.uid() is null.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Mirror every auth.users row into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Keep updated_at honest. Reused by every table that has the column.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on profiles
  for each row
  execute function public.touch_updated_at();

-- Pin `role` against self-promotion.
--
-- The obvious approach -- a WITH CHECK on the UPDATE policy comparing to
-- `(select role from profiles where id = auth.uid())` -- is a trap: that
-- subquery is itself subject to profiles'' RLS and recurses. WITH CHECK also
-- cannot see OLD. A BEFORE UPDATE trigger sees both rows, covers every write
-- path (policy, RPC, dashboard), and cannot recurse.
-- Deliberately NOT security definer: the guard needs to see which role is
-- actually driving the write. Inside a definer function current_user is always
-- the owner, which would make the check below vacuous. is_admin() is definer
-- in its own right, so it still reads profiles fine from here.
--
-- Only anon and authenticated are restricted -- those are the two roles a
-- browser-side key can reach. A service_role or superuser session (the SQL
-- editor, the seed script) is the deliberate bootstrap path for promoting the
-- first admin, since there is no other way to create one.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated')
     and not is_admin() then
    raise exception 'ROLE_CHANGE_FORBIDDEN';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on profiles
  for each row
  execute function public.guard_profile_role();

-- Single-row store configuration. shipping_for() reads this, so the free
-- shipping threshold is never hardcoded in the UI the way the old
-- "Free shipping on orders over $300" marketing copy was.
create table store_settings (
  id                            boolean primary key default true check (id),
  free_shipping_threshold_minor integer not null default 300000 check (free_shipping_threshold_minor >= 0),
  flat_shipping_minor           integer not null default 6000   check (flat_shipping_minor >= 0),
  bkash_number                  text,
  nagad_number                  text,
  support_email                 citext,
  support_phone                 text,
  announcement                  text,
  updated_at                    timestamptz not null default now()
);

insert into store_settings (id) values (true) on conflict do nothing;

create trigger store_settings_touch_updated_at
  before update on store_settings
  for each row
  execute function public.touch_updated_at();
