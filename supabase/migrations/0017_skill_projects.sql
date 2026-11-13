-- Skill Projects: practice projects the admin assigns to a nail tech. The
-- tech studies a reference and tutorial links, submits photos (and links to
-- videos hosted elsewhere), and the admin approves or sends it back with
-- feedback. Idempotent: safe to re-run.
--
-- Like the rest of the app, every write goes through a server action that
-- checks the caller first and then writes with the service role. The RLS
-- policies below only govern reads, so a signed-in user calling the data API
-- directly can see what their role allows and can change nothing.

-- === Tech role ===============================================================

-- Same pattern as is_admin (0006): not in the member-facing column grants
-- from 0003, so nobody can make themselves a tech. Admins toggle it from the
-- Clients page. An account can be both admin and tech (a solo studio owner).
alter table profiles add column if not exists is_tech boolean not null default false;

-- === Projects ================================================================

create table if not exists skill_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  skill_types text[] not null check (
    cardinality(skill_types) > 0
    and skill_types <@ array['nails', 'photography', 'video', 'social_graphics']
  ),
  assigned_to uuid not null references profiles (id) on delete cascade,
  created_by uuid references profiles (id) on delete set null,

  -- Exactly one kind of reference. A Look Book reference points at the
  -- photo rather than copying it: if the member deletes it, the id goes null
  -- and the project shows "Reference removed".
  reference_type text not null check (reference_type in ('lookbook', 'upload', 'link')),
  reference_lookbook_photo_id uuid references visit_photos (id) on delete set null,
  reference_storage_path text,
  reference_url text,
  check (
    (reference_type = 'upload' and reference_storage_path is not null)
    or (reference_type = 'link' and reference_url is not null)
    or reference_type = 'lookbook'
  ),

  instructions text,
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'assigned' check (
    status in ('assigned', 'in_progress', 'submitted', 'needs_another_try', 'approved')
  ),
  linked_service_id uuid references services (id) on delete set null,

  -- Archiving keeps the status it had, so a project can be restored as-is.
  archived_at timestamptz,
  -- Not used until "Publish to members" ships; members can already read
  -- published projects (policy below) so that feature needs no migration.
  published_at timestamptz,

  -- In-app notification for the tech: set when something happens they
  -- should see (assigned, sent back, approved); cleared by opening it.
  tech_attention_at timestamptz not null default now(),
  tech_seen_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skill_projects_assigned_to_idx on skill_projects (assigned_to);
create index if not exists skill_projects_status_idx on skill_projects (status) where archived_at is null;

create table if not exists skill_project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references skill_projects (id) on delete cascade,
  url text not null,
  label text,
  sort_order integer not null default 0
);

create index if not exists skill_project_links_project_id_idx on skill_project_links (project_id);

create table if not exists skill_project_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references skill_projects (id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  sort_order integer not null default 0
);

create index if not exists skill_project_goals_project_id_idx on skill_project_goals (project_id);

-- One row per attempt. A project sent back gets a new attempt, and earlier
-- ones stay so progress can be compared.
create table if not exists skill_project_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references skill_projects (id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  note text,
  goals_checked uuid[] not null default '{}',
  submitted_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'sent_back')),
  feedback text,
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  unique (project_id, attempt_number)
);

-- Photos are uploaded to the private bucket below. Videos are links to
-- wherever the tech posted them (YouTube, Instagram, Drive...), so they never
-- use the studio's file storage.
create table if not exists skill_project_media (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references skill_project_submissions (id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video_link')),
  storage_path text,
  url text,
  sort_order integer not null default 0,
  check (
    (media_type = 'photo' and storage_path is not null)
    or (media_type = 'video_link' and url is not null)
  )
);

create index if not exists skill_project_media_submission_id_idx on skill_project_media (submission_id);

-- === Read access (RLS) =======================================================

-- Role checks for the policies below. They live in a schema the data API
-- doesn't expose, so they can't be called directly to ask whether some other
-- account is an admin or tech; security definer lets them read profiles
-- regardless of the caller's own access to that table.
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

alter table skill_projects enable row level security;
alter table skill_project_links enable row level security;
alter table skill_project_goals enable row level security;
alter table skill_project_submissions enable row level security;
alter table skill_project_media enable row level security;

drop policy if exists "skill_projects: admins read all" on skill_projects;
create policy "skill_projects: admins read all" on skill_projects
  for select using (private.is_admin());

drop policy if exists "skill_projects: techs read own" on skill_projects;
create policy "skill_projects: techs read own" on skill_projects
  for select using (assigned_to = auth.uid() and private.is_tech() and archived_at is null);

drop policy if exists "skill_projects: members read published" on skill_projects;
create policy "skill_projects: members read published" on skill_projects
  for select using (auth.role() = 'authenticated' and published_at is not null and archived_at is null);

-- Child tables follow whatever the caller can see of the parent project.
drop policy if exists "skill_project_links: follow project" on skill_project_links;
create policy "skill_project_links: follow project" on skill_project_links
  for select using (exists (select 1 from skill_projects p where p.id = project_id));

drop policy if exists "skill_project_goals: follow project" on skill_project_goals;
create policy "skill_project_goals: follow project" on skill_project_goals
  for select using (exists (select 1 from skill_projects p where p.id = project_id));

-- Members only ever see published work, never attempts or feedback.
drop policy if exists "skill_project_submissions: admins and assigned tech" on skill_project_submissions;
create policy "skill_project_submissions: admins and assigned tech" on skill_project_submissions
  for select using (
    private.is_admin()
    or exists (
      select 1 from skill_projects p
      where p.id = project_id and p.assigned_to = auth.uid() and private.is_tech()
    )
  );

drop policy if exists "skill_project_media: follow submission" on skill_project_media;
create policy "skill_project_media: follow submission" on skill_project_media
  for select using (exists (select 1 from skill_project_submissions s where s.id = submission_id));

-- No insert/update/delete policies: writes happen only in server actions.
revoke insert, update, delete on skill_projects, skill_project_links, skill_project_goals,
  skill_project_submissions, skill_project_media from anon, authenticated;

-- === Private file storage ====================================================

-- Private (unlike the Look Book's visit-photos bucket): files are only ever
-- shown through short-lived signed URLs the server creates after checking
-- who's asking. Paths:
--   references/<admin id>/<file>              reference images uploaded by an admin
--   submissions/<tech id>/<project id>/<file> photos uploaded by the tech
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('skill-projects', 'skill-projects', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "skill-projects: admins upload references" on storage.objects;
create policy "skill-projects: admins upload references" on storage.objects
  for insert with check (
    bucket_id = 'skill-projects'
    and (storage.foldername(name))[1] = 'references'
    and (storage.foldername(name))[2] = auth.uid()::text
    and private.is_admin()
  );

drop policy if exists "skill-projects: techs upload own submissions" on storage.objects;
create policy "skill-projects: techs upload own submissions" on storage.objects
  for insert with check (
    bucket_id = 'skill-projects'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
    and private.is_tech()
  );

-- Lets an uploader remove a photo they just added before submitting.
drop policy if exists "skill-projects: uploaders delete own files" on storage.objects;
create policy "skill-projects: uploaders delete own files" on storage.objects
  for delete using (
    bucket_id = 'skill-projects'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
