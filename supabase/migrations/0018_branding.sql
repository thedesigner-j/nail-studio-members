-- Studio branding the admin can change from Admin > Branding: the name and
-- logo shown in the app's headers, the login screen (including the Webflow
-- embed), the browser tab, emails, referral messages and calendar events.
-- Idempotent: safe to re-run.

-- Exactly one row (same trick as booking_settings / reward_settings).
create table if not exists branding (
  id boolean primary key default true check (id),
  business_name text not null default 'Nail Studio' check (length(trim(business_name)) between 1 and 60),
  logo_url text,
  -- Off for a wordmark logo that already spells out the name.
  show_name_with_logo boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into branding (id) values (true) on conflict (id) do nothing;

-- Only the server reads this (with the service role, since the login page
-- needs it before anyone is signed in), and only the admin action writes it.
alter table branding enable row level security;
revoke all on branding from anon, authenticated;

-- Logos have to show on the login page to signed-out visitors, so this
-- bucket is public. Only admins can upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Same helper 0017 defines, repeated so this file also works on its own.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

drop policy if exists "branding: admins upload logos" on storage.objects;
create policy "branding: admins upload logos" on storage.objects
  for insert with check (bucket_id = 'branding' and private.is_admin());

drop policy if exists "branding: admins delete logos" on storage.objects;
create policy "branding: admins delete logos" on storage.objects
  for delete using (bucket_id = 'branding' and private.is_admin());
