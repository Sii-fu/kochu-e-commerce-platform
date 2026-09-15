-- 0005_content.sql
-- Editorial articles and early-access signups.

create table articles (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  abstract       text not null,
  content        text not null,      -- markdown
  featured_image text,
  collection_id  uuid references collections(id) on delete set null,
  author_id      uuid references auth.users(id) on delete set null,
  is_published   boolean not null default false,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint articles_published_has_date
    check (not is_published or published_at is not null)
);

create trigger articles_touch_updated_at
  before update on articles
  for each row
  execute function public.touch_updated_at();

-- The old early_access table was write-only: no admin view, no export, and
-- nothing ever read it. drop_id lets a signup be attributed to a campaign.
create table early_access (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null unique,
  drop_id    uuid references drops(id) on delete set null,
  source     text,
  created_at timestamptz not null default now()
);
