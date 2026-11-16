-- Trace: a lightbox tool for tracing nail designs onto clear tips. The
-- designs come from the studio's Figma file through Admin > Trace > "Sync
-- from Figma"; nothing here is edited by hand. Idempotent: safe to re-run.
--
-- Only admins and techs can read any of it. Every write goes through the
-- admin's sync (service role), so the policies below only govern reads.

-- === Sets =====================================================================

-- One row per Figma section on a "Sets - …" page, e.g. "X01 · Candy Cane Lane".
create table if not exists trace_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  -- From the page name: "Sets - Christmas" -> "Christmas".
  collection text not null,
  description text,
  -- [{ "name": "Christmas Red", "hex": "#c8102e" }, ...] from the Color Ref page.
  palette jsonb not null default '[]'::jsonb,
  -- Per finger: { "L-Thumb": { "tip": "French", "tipColor": "#ffffff", "design": "Pine + white French" }, ... }
  fingers jsonb not null default '{}'::jsonb,
  -- The set's "Hero" nail, used as its thumbnail.
  hero_finger text,
  sort_order integer not null default 0,
  figma_node_id text,
  -- Hidden sets stay synced but only admins see them.
  hidden boolean not null default false,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists trace_sets_collection_idx on trace_sets (collection, sort_order);

-- === Art ======================================================================

-- One SVG per finger per mode, exported from the set's "Art Masters" frame.
-- A finger with nothing drawn in a mode (e.g. a plain colored nail has no
-- tracing lines) has a row with a null storage_path.
create table if not exists trace_art (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references trace_sets (id) on delete cascade,
  finger text not null check (
    finger in ('L-Thumb', 'L-Index', 'L-Middle', 'L-Ring', 'L-Pinky',
               'R-Thumb', 'R-Index', 'R-Middle', 'R-Ring', 'R-Pinky')
  ),
  mode text not null check (mode in ('color', 'line')),
  storage_path text,
  figma_node_id text,
  content_hash text,
  -- Set while a sync is in progress: Figma's temporary export link for this
  -- file, waiting to be downloaded into storage.
  pending_url text,
  updated_at timestamptz not null default now(),
  unique (set_id, finger, mode)
);

alter table trace_art add column if not exists pending_url text;

-- === Nail shapes ==============================================================

-- From the Figma "Nail Library" component set. Geometry is in Figma points at
-- the reference size (M · Middle); every size of a shape is the same outline
-- scaled to its width. sizes holds the real sizes in millimetres:
-- { "S": { "Thumb": [15, 22.5], ... }, "M": {...}, "L": {...} }.
create table if not exists trace_shapes (
  shape text primary key,
  sort_order integer not null default 0,
  geometry jsonb not null,
  sizes jsonb not null,
  synced_at timestamptz not null default now()
);

-- === Sync status ==============================================================

create table if not exists trace_sync (
  id boolean primary key default true check (id),
  file_version text,
  file_name text,
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into trace_sync (id) values (true) on conflict (id) do nothing;

-- === Read access (RLS) ========================================================

-- Same helpers as 0017 (recreated here so this file stands on its own).
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

create or replace function private.is_tech()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_tech from profiles where id = auth.uid()), false);
$$;

alter table trace_sets enable row level security;
alter table trace_art enable row level security;
alter table trace_shapes enable row level security;
alter table trace_sync enable row level security;

drop policy if exists "trace_sets: admins read all" on trace_sets;
create policy "trace_sets: admins read all" on trace_sets
  for select using (private.is_admin());

drop policy if exists "trace_sets: techs read visible" on trace_sets;
create policy "trace_sets: techs read visible" on trace_sets
  for select using (private.is_tech() and not hidden);

drop policy if exists "trace_art: admins and techs read" on trace_art;
create policy "trace_art: admins and techs read" on trace_art
  for select using (
    private.is_admin()
    or (private.is_tech() and exists (select 1 from trace_sets s where s.id = set_id and not s.hidden))
  );

drop policy if exists "trace_shapes: admins and techs read" on trace_shapes;
create policy "trace_shapes: admins and techs read" on trace_shapes
  for select using (private.is_admin() or private.is_tech());

drop policy if exists "trace_sync: admins read" on trace_sync;
create policy "trace_sync: admins read" on trace_sync
  for select using (private.is_admin());

revoke insert, update, delete on trace_sets, trace_art, trace_shapes, trace_sync from anon, authenticated;

-- === Storage ==================================================================

-- Private: the app hands out short-lived signed URLs to admins and techs.
-- No storage policies are needed because only the service role reads or
-- writes this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trace', 'trace', false, 1048576, array['image/svg+xml'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
