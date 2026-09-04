-- Core schema for the members app: profiles, services, appointments, calendar sync.
create extension if not exists pgcrypto;

-- One row per authenticated user, extending auth.users.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  referral_code text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  referred_by uuid references profiles (id) on delete set null,
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now()
);

-- Services the business offers (e.g. "Gel Manicure").
create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  loyalty_points integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Weekly recurring business hours used to compute open booking slots.
create table business_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  service_id uuid not null references services (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'completed', 'cancelled', 'no_show')),
  price_cents integer not null,
  notes text,
  google_calendar_event_id text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index appointments_user_id_idx on appointments (user_id);
create index appointments_starts_at_idx on appointments (starts_at);

-- One Google Calendar OAuth connection per member.
create table calendar_connections (
  user_id uuid primary key references profiles (id) on delete cascade,
  provider text not null default 'google',
  access_token text not null,
  refresh_token text not null,
  expiry_date bigint not null,
  calendar_id text not null default 'primary',
  connected_at timestamptz not null default now()
);

-- Keep profiles.updated automatically when an auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table profiles enable row level security;
alter table services enable row level security;
alter table business_hours enable row level security;
alter table appointments enable row level security;
alter table calendar_connections enable row level security;

create policy "profiles: read own" on profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on profiles
  for update using (auth.uid() = id);

create policy "services: readable by authenticated" on services
  for select using (auth.role() = 'authenticated');

create policy "business_hours: readable by authenticated" on business_hours
  for select using (auth.role() = 'authenticated');

create policy "appointments: read own" on appointments
  for select using (auth.uid() = user_id);
create policy "appointments: insert own" on appointments
  for insert with check (auth.uid() = user_id);
create policy "appointments: update own" on appointments
  for update using (auth.uid() = user_id);

create policy "calendar_connections: manage own" on calendar_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for profile pictures.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "users can upload their own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update their own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
