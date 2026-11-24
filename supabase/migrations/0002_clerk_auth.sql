-- Auth moved from Supabase Auth to Clerk (+ Clerk Organizations for
-- staff signup/invite). Nothing in this app ever holds a Supabase session
-- now — every query goes through the service-role client, authorized in
-- application code by a Clerk session/org check. Run after 0001_init.sql.

-- created_by held a profiles.id uuid; it now holds a Clerk user id (text),
-- same as status_events.created_by already did. Drop the FK before the
-- table it points to, else Postgres refuses the drop below.
alter table shipments
  drop constraint if exists shipments_created_by_fkey;
alter table shipments
  alter column created_by type text using created_by::text;

-- profiles mirrored Supabase Auth users; Clerk's org membership (name,
-- email, admin/member role) replaces it entirely.
drop table if exists profiles;

-- The staff_all policies from 0001 keyed off auth.uid(), which is always
-- null now (no Supabase-authenticated session exists). They're dead code,
-- not a hole: the service-role client bypasses RLS regardless, and every
-- staff-facing query/action is gated by a Clerk check in code instead.
