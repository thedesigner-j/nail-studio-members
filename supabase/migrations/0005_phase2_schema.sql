-- Phase 2: referrals, messages, payment history, visit photo feed.

-- === Referrals ===============================================================

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles (id) on delete cascade,
  referred_id uuid references profiles (id) on delete set null,
  referred_email text not null,
  status text not null default 'rewarded' check (status in ('pending', 'joined', 'rewarded')),
  points_awarded integer not null default 0,
  created_at timestamptz not null default now()
);

create index referrals_referrer_id_idx on referrals (referrer_id);

alter table referrals enable row level security;

create policy "referrals: read own as referrer" on referrals
  for select using (auth.uid() = referrer_id);

-- Applies a referral code at signup: links the new member to their
-- referrer and awards points to both sides. Only the server (service role)
-- calls this, right after auth.signUp succeeds, so it is not exposed to
-- clients directly.
create or replace function public.apply_referral(
  p_code text,
  p_new_user_id uuid,
  p_new_user_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referrer_points constant integer := 50;
  v_referred_welcome_points constant integer := 25;
begin
  select id into v_referrer_id from profiles where referral_code = p_code;

  if v_referrer_id is null or v_referrer_id = p_new_user_id then
    return;
  end if;

  update profiles set referred_by = v_referrer_id where id = p_new_user_id;

  insert into referrals (referrer_id, referred_id, referred_email, status, points_awarded)
  values (v_referrer_id, p_new_user_id, p_new_user_email, 'rewarded', v_referrer_points);

  update profiles set loyalty_points = loyalty_points + v_referrer_points where id = v_referrer_id;
  update profiles set loyalty_points = loyalty_points + v_referred_welcome_points where id = p_new_user_id;
end;
$$;

revoke all on function public.apply_referral(text, uuid, text) from public;
grant execute on function public.apply_referral(text, uuid, text) to service_role;

-- === Payment history (simple ledger, no online checkout) ====================

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  method text not null default 'in_person' check (method in ('in_person', 'card', 'cash', 'other')),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  paid_at timestamptz not null default now()
);

create index payments_user_id_idx on payments (user_id);

alter table payments enable row level security;

create policy "payments: read own" on payments
  for select using (auth.uid() = user_id);

-- Payment rows are recorded by the business (service role), not members, so
-- there is no insert/update policy for `authenticated` here.

-- === Messages (one thread per member with the business) =====================

create table messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  sender text not null check (sender in ('member', 'business')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_user_id_idx on messages (user_id, created_at);

alter table messages enable row level security;

create policy "messages: read own thread" on messages
  for select using (auth.uid() = user_id);

create policy "messages: send as self" on messages
  for insert with check (auth.uid() = user_id and sender = 'member');

alter publication supabase_realtime add table messages;

-- profiles RLS only lets a member read their own row, so joining straight to
-- `profiles` for photo authorship in the shared feed would always come back
-- null for everyone else. This view exposes just the non-sensitive columns
-- and, being owned by the migration role (not a regular authenticated user),
-- runs with definer-style privileges that read every row regardless of the
-- caller's RLS — the standard Supabase pattern for a "public profile" view.
-- It deliberately excludes phone, loyalty_points, referral_code, etc.
create view public_profiles with (security_invoker = false) as
  select id, full_name, avatar_url from profiles;

grant select on public_profiles to authenticated;

-- === Visit photo feed: uploads, likes, collections ===========================

create table visit_photos (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index visit_photos_appointment_id_idx on visit_photos (appointment_id);
create index visit_photos_created_at_idx on visit_photos (created_at desc);

alter table visit_photos enable row level security;

create policy "visit_photos: readable by all members" on visit_photos
  for select using (auth.role() = 'authenticated');

create policy "visit_photos: insert on own appointment" on visit_photos
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from appointments
      where appointments.id = appointment_id and appointments.user_id = auth.uid()
    )
  );

create policy "visit_photos: delete own" on visit_photos
  for delete using (auth.uid() = user_id);

create table photo_likes (
  photo_id uuid not null references visit_photos (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

alter table photo_likes enable row level security;

create policy "photo_likes: readable by all members" on photo_likes
  for select using (auth.role() = 'authenticated');

create policy "photo_likes: like as self" on photo_likes
  for insert with check (auth.uid() = user_id);

create policy "photo_likes: unlike own" on photo_likes
  for delete using (auth.uid() = user_id);

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

alter table collections enable row level security;

create policy "collections: manage own" on collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table collection_photos (
  collection_id uuid not null references collections (id) on delete cascade,
  photo_id uuid not null references visit_photos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, photo_id)
);

alter table collection_photos enable row level security;

create policy "collection_photos: manage via own collection" on collection_photos
  for all using (
    exists (
      select 1 from collections
      where collections.id = collection_id and collections.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from collections
      where collections.id = collection_id and collections.user_id = auth.uid()
    )
  );

-- Storage bucket for visit photos, uploaded to `${user_id}/${appointment_id}/${filename}`.
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', true)
on conflict (id) do nothing;

create policy "visit photos are publicly accessible" on storage.objects
  for select using (bucket_id = 'visit-photos');

create policy "users can upload their own visit photos" on storage.objects
  for insert with check (
    bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own visit photos" on storage.objects
  for delete using (
    bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
