-- Replaces Clerk Organizations with our own membership/invite model.
-- "The company" is still just the single company_settings row from
-- 0001 (its id is a boolean primary key, so there can only ever be
-- one) — /create-company fills in its name instead of a separate
-- companies table. Run after 0002_clerk_auth.sql.

create table memberships (
  clerk_user_id text primary key,
  email text not null,
  full_name text,
  role text not null default 'dispatcher' check (role in ('admin', 'dispatcher')),
  created_at timestamptz not null default now()
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'dispatcher' check (role in ('admin', 'dispatcher')),
  token text not null unique default encode(gen_random_bytes(24), 'base64url'),
  invited_by text not null, -- clerk_user_id
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

create index invites_email_idx on invites (email) where status = 'pending';

alter table memberships enable row level security;
alter table invites enable row level security;
-- No policies: every access to these tables goes through the service-role
-- client, authorized in code by a Clerk session check — same pattern as
-- every other table since 0002.
