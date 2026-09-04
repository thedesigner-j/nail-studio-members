-- Early access: members-only sale/product/event announcements, managed by
-- admins. There's no insert/update/delete policy for `authenticated` here —
-- writes go through the service role from admin server actions, same
-- pattern as services and business_hours.
create table announcements (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'announcement' check (category in ('announcement', 'sale', 'product', 'event')),
  title text not null,
  description text,
  image_url text,
  link_url text,
  event_at timestamptz,
  ends_at timestamptz,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index announcements_created_at_idx on announcements (created_at desc);

alter table announcements enable row level security;

create policy "announcements: members see published, admins see all" on announcements
  for select using (
    published = true
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

insert into storage.buckets (id, name, public)
values ('announcements', 'announcements', true)
on conflict (id) do nothing;

create policy "announcement images are publicly accessible" on storage.objects
  for select using (bucket_id = 'announcements');

create policy "admins can manage announcement images" on storage.objects
  for all using (
    bucket_id = 'announcements'
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  )
  with check (
    bucket_id = 'announcements'
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );
