-- Lets a member attach a reference photo and/or one of their own Look Book
-- collections to a new booking, so the studio knows what they're going for.
-- Idempotent: safe to re-run.
alter table appointments add column if not exists reference_photo_url text;
alter table appointments add column if not exists reference_collection_id uuid references collections (id) on delete set null;

-- Inserted via the service role alongside the rest of the appointment row
-- (see book/actions.ts), same as price_cents/status/etc — no member-facing
-- column grant needed for these two.

-- Collections are otherwise private to their owner ("collections: manage
-- own"), but a tagged collection needs to be visible to the studio too, so
-- admins can actually see what a client referenced.
drop policy if exists "collections: admins read all" on collections;
create policy "collections: admins read all" on collections
  for select using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

drop policy if exists "collection_photos: admins read all" on collection_photos;
create policy "collection_photos: admins read all" on collection_photos
  for select using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- Storage bucket for the reference photo upload, uploaded client-side to
-- `${user_id}/${filename}` before the appointment row exists yet (unlike
-- visit-photos, which is keyed by an appointment id that's already real).
insert into storage.buckets (id, name, public)
values ('appointment-references', 'appointment-references', true)
on conflict (id) do nothing;

drop policy if exists "reference photos are publicly accessible" on storage.objects;
create policy "reference photos are publicly accessible" on storage.objects
  for select using (bucket_id = 'appointment-references');

drop policy if exists "users can upload their own reference photos" on storage.objects;
create policy "users can upload their own reference photos" on storage.objects
  for insert with check (
    bucket_id = 'appointment-references' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can delete their own reference photos" on storage.objects;
create policy "users can delete their own reference photos" on storage.objects
  for delete using (
    bucket_id = 'appointment-references' and (storage.foldername(name))[1] = auth.uid()::text
  );
