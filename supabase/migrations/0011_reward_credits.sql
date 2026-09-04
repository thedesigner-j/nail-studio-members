-- Dollar-credit loyalty ledger, replacing the old points-based
-- loyalty_points/rewards/reward_redemptions system and the old signup-code
-- referral system entirely (both are dropped below). Members earn dollar
-- credit lines (not points) for five actions; each line has its own 1-year
-- expiration and can be spent (in whole or in part) at checkout.
--
-- Lives under "loyalty" (member page /loyalty, admin section /admin/loyalty).

-- === Remove the old points/rewards/referral-code system ======================

drop function if exists public.redeem_reward(uuid, uuid);
drop function if exists public.increment_loyalty_points(uuid, integer);
drop function if exists public.apply_referral(text, uuid, text);

drop table if exists reward_redemptions;
drop table if exists rewards;
drop table if exists referrals;

alter table profiles drop column if exists loyalty_points;
alter table profiles drop column if exists referral_code;
alter table profiles drop column if exists referred_by;
alter table services drop column if exists loyalty_points;

-- === Reset (makes this migration safe to re-run from any partial state) ======
-- Supabase's SQL editor runs a pasted script as one transaction, so a
-- failure partway through normally rolls everything back — but if you're
-- seeing "already exists" errors, some earlier attempt did commit. These
-- drops make every create/alter below idempotent regardless of how far a
-- previous run got, without you having to figure out exactly where it
-- stopped. `cascade` on the table drops also removes their own policies
-- and indexes automatically.

drop policy if exists "appointments: admins read all" on appointments;

drop table if exists reward_credit_applications cascade;
drop table if exists reward_credits cascade;
drop table if exists reward_settings cascade;
drop table if exists referral_invites cascade;
drop table if exists repost_submissions cascade;
drop table if exists review_submissions cascade;
drop table if exists review_platforms cascade;

alter table announcements drop column if exists is_shareable;
alter table announcements drop column if exists shareable_starts_at;
alter table announcements drop column if exists shareable_ends_at;

drop policy if exists "users can upload their own review proof" on storage.objects;
drop policy if exists "users can read their own review proof" on storage.objects;
drop policy if exists "admins can read all review proof" on storage.objects;

-- === Admin appointment visibility =============================================

-- appointments only ever had a "read own" policy — no admin carve-out —
-- because nothing before this needed admins to see other members'
-- appointments. The new "mark paid & completed" admin action (which
-- triggers award_session_credit and confirm_referral) needs a list of
-- confirmed appointments across all members.
create policy "appointments: admins read all" on appointments
  for select using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- === Settings (single row) ===================================================

-- `id boolean primary key default true check (id)` is a standard Postgres
-- trick to enforce exactly one row: only `true` can ever satisfy the check,
-- and it's the primary key, so a second insert always violates uniqueness.
create table reward_settings (
  id boolean primary key default true check (id),
  session_credit_percent numeric(5, 2) not null default 8,
  account_creation_credit numeric(10, 2) not null default 20,
  referral_credit numeric(10, 2) not null default 15,
  repost_credit numeric(10, 2) not null default 5,
  review_credit numeric(10, 2) not null default 15,
  credit_expiration_days integer not null default 365,
  referral_link_expiration_days integer not null default 90
);

insert into reward_settings (id) values (true) on conflict (id) do nothing;

alter table reward_settings enable row level security;

create policy "reward_settings: readable by authenticated" on reward_settings
  for select using (auth.role() = 'authenticated');

-- No insert/update policy for `authenticated` — only admins change this,
-- via the service role from an admin server action.

-- === Credit ledger =============================================================

create table reward_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  -- 'manual' isn't in the original spec's source_type list — added for the
  -- admin manual-adjustment tool ("issue a credit with a reason").
  source_type text not null check (source_type in ('account_creation', 'session', 'referral', 'repost', 'review', 'manual')),
  amount numeric(10, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'redeemed', 'expired', 'rejected')),
  -- Informational pointer to the appointment/referral/submission that
  -- earned this credit. No FK: it points into different tables depending
  -- on source_type, so referential integrity is enforced in the functions
  -- below rather than in the schema.
  reference_id uuid,
  earned_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Not in the original column list — added so a credit line can be spent
  -- partially. Dollar amounts rarely divide evenly across credit-line
  -- boundaries; without this, FIFO redemption would have to consume whole
  -- lines only and strand leftover value on a partially-useful line.
  redeemed_amount numeric(10, 2) not null default 0 check (redeemed_amount >= 0 and redeemed_amount <= amount),
  redeemed_at timestamptz,
  created_by uuid references profiles (id),
  -- Free-text context for manual adjustments (the "reason" the admin tool
  -- asks for) and rejection reasons.
  notes text
);

create index reward_credits_user_id_idx on reward_credits (user_id);

-- Idempotency safety nets beyond the functions' own checks, in case of a
-- concurrent double-call: at most one account-creation credit per user,
-- and at most one session credit per appointment.
create unique index reward_credits_one_account_creation_per_user on reward_credits (user_id)
  where source_type = 'account_creation';
create unique index reward_credits_one_session_credit_per_appointment on reward_credits (reference_id)
  where source_type = 'session';

alter table reward_credits enable row level security;

create policy "reward_credits: read own" on reward_credits
  for select using (auth.uid() = user_id);

create policy "reward_credits: admins read all" on reward_credits
  for select using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- No insert/update/delete policy for `authenticated` at all: every write to
-- this table goes through a SECURITY DEFINER function below, callable only
-- by the service role.

-- Logs exactly how much of a credit line was applied to which appointment.
-- Needed because FIFO pooled redemption (see redeem_credit_balance) can
-- draw partial amounts from several lines in one booking; without this, a
-- line's cumulative redeemed_amount can't be attributed to a specific visit.
create table reward_credit_applications (
  id uuid primary key default gen_random_uuid(),
  reward_credit_id uuid not null references reward_credits (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table reward_credit_applications enable row level security;

create policy "reward_credit_applications: read own" on reward_credit_applications
  for select using (
    exists (
      select 1 from reward_credits
      where reward_credits.id = reward_credit_id and reward_credits.user_id = auth.uid()
    )
  );

create policy "reward_credit_applications: admins read all" on reward_credit_applications
  for select using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- === Referral invites (SMS flow) ==============================================

-- Named `referral_invites`, not `referrals` — this app already has a
-- `referrals` table (signup-time referral code, instant points reward,
-- see 0005_phase2_schema.sql) with an incompatible schema and lifecycle.
-- The two referral mechanisms coexist rather than one replacing the other.
create table referral_invites (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles (id) on delete cascade,
  referred_id uuid references profiles (id) on delete set null,
  -- md5(random()...) rather than pgcrypto's gen_random_bytes: this app's
  -- Postgres doesn't have pgcrypto on a search path SECURITY DEFINER
  -- functions can see, and md5 needs no extension at all.
  referral_token text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  -- The friend's phone number, kept for admin visibility into what was
  -- sent — not in the original spec's column list but implied by the SMS
  -- flow needing somewhere to record it.
  phone text,
  status text not null default 'sent' check (status in ('sent', 'clicked', 'signed_up', 'confirmed', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);

create index referral_invites_referrer_id_idx on referral_invites (referrer_id);
create index referral_invites_token_idx on referral_invites (referral_token);

alter table referral_invites enable row level security;

create policy "referral_invites: read own as referrer" on referral_invites
  for select using (auth.uid() = referrer_id);

create policy "referral_invites: admins read all" on referral_invites
  for select using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- === Shareable posts (repost credit eligibility) ==============================

-- Merged into the existing `announcements` table as extra columns instead
-- of a separate `shareable_posts` join table: the spec describes this as
-- "links to your existing posts/announcements table," and the relationship
-- is strictly one-to-one, so a join table would just add an extra hop.
alter table announcements add column is_shareable boolean not null default false;
alter table announcements add column shareable_starts_at timestamptz;
alter table announcements add column shareable_ends_at timestamptz;

-- === Review platforms + submissions ===========================================

create table review_platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table review_platforms enable row level security;

create policy "review_platforms: readable by authenticated" on review_platforms
  for select using (auth.role() = 'authenticated');

create table review_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  platform_id uuid not null references review_platforms (id),
  proof_url text,
  proof_link text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (proof_url is not null or proof_link is not null)
);

-- "Once per review platform" blocks a second pending-or-approved
-- submission, but deliberately allows resubmitting after a rejection —
-- permanently locking someone out after one rejected attempt (e.g. a bad
-- screenshot) reads like an unintended trap rather than the actual intent.
create unique index review_submissions_one_active_per_platform
  on review_submissions (user_id, platform_id)
  where status <> 'rejected';

alter table review_submissions enable row level security;

create policy "review_submissions: read own" on review_submissions
  for select using (auth.uid() = user_id);

create policy "review_submissions: admins read all" on review_submissions
  for select using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy "review_submissions: insert own pending" on review_submissions
  for insert with check (auth.uid() = user_id and status = 'pending');

-- === Repost submissions ========================================================

create table repost_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  announcement_id uuid not null references announcements (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Same resubmit-after-rejection allowance as review_submissions above.
create unique index repost_submissions_one_active_per_post
  on repost_submissions (user_id, announcement_id)
  where status <> 'rejected';

alter table repost_submissions enable row level security;

create policy "repost_submissions: read own" on repost_submissions
  for select using (auth.uid() = user_id);

create policy "repost_submissions: admins read all" on repost_submissions
  for select using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy "repost_submissions: insert own pending" on repost_submissions
  for insert with check (auth.uid() = user_id and status = 'pending');

-- Private bucket (unlike the app's existing public avatars/visit-photos/
-- announcements buckets): review proof screenshots should only be visible
-- to the member who uploaded them and to admins reviewing the queue, so
-- they're served via signed URLs rather than public URLs.
insert into storage.buckets (id, name, public)
values ('review-proofs', 'review-proofs', false)
on conflict (id) do nothing;

create policy "users can upload their own review proof" on storage.objects
  for insert with check (
    bucket_id = 'review-proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can read their own review proof" on storage.objects
  for select using (
    bucket_id = 'review-proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins can read all review proof" on storage.objects
  for select using (
    bucket_id = 'review-proofs'
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

-- === SECURITY DEFINER functions ================================================
-- Every function below is callable only by the service role — called from
-- server actions that have already authenticated the user (and, where
-- relevant, verified admin status) via the normal cookie-based client.

create or replace function public.award_account_creation_credit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
  v_expiration_days integer;
begin
  -- Idempotent: the partial unique index above is the real guarantee under
  -- concurrency, this is just an early, cheap exit.
  if exists (select 1 from reward_credits where user_id = p_user_id and source_type = 'account_creation') then
    return;
  end if;

  select account_creation_credit, credit_expiration_days
  into v_amount, v_expiration_days
  from reward_settings;

  insert into reward_credits (user_id, source_type, amount, status, expires_at)
  values (p_user_id, 'account_creation', v_amount, 'confirmed', now() + (v_expiration_days || ' days')::interval)
  on conflict do nothing;
end;
$$;

revoke all on function public.award_account_creation_credit(uuid) from public;
grant execute on function public.award_account_creation_credit(uuid) to service_role;

-- Reads the amount actually charged from the `payments` table (the most
-- recent paid payment for this appointment), not the appointment's
-- pre-discount price_cents — "ticket total" means what the client paid.
create or replace function public.award_session_credit(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_paid_cents integer;
  v_percent numeric;
  v_expiration_days integer;
  v_amount numeric;
begin
  if exists (select 1 from reward_credits where reference_id = p_appointment_id and source_type = 'session') then
    return;
  end if;

  select user_id into v_user_id from appointments where id = p_appointment_id;
  if v_user_id is null then
    raise exception 'Appointment not found';
  end if;

  select amount_cents into v_paid_cents
  from payments
  where appointment_id = p_appointment_id and status = 'paid'
  order by paid_at desc
  limit 1;

  if v_paid_cents is null then
    raise exception 'No paid payment found for this appointment yet';
  end if;

  select session_credit_percent, credit_expiration_days into v_percent, v_expiration_days from reward_settings;

  v_amount := round((v_paid_cents / 100.0) * (v_percent / 100.0), 2);
  if v_amount <= 0 then
    return;
  end if;

  insert into reward_credits (user_id, source_type, amount, status, reference_id, expires_at)
  values (v_user_id, 'session', v_amount, 'confirmed', p_appointment_id, now() + (v_expiration_days || ' days')::interval)
  on conflict do nothing;
end;
$$;

revoke all on function public.award_session_credit(uuid) from public;
grant execute on function public.award_session_credit(uuid) to service_role;

-- p_phone isn't in the spec's literal signature — added so the invite row
-- can record who it was sent to, for admin visibility.
--
-- The token is "{first-name-slug}-{8 hex chars}" (e.g. "javon-4f2a9c1e")
-- rather than a raw random string, so the resulting /join-<token> link
-- reads as a personal invite instead of an opaque tracking link. The hex
-- suffix still guarantees uniqueness even if two members share a name or
-- one member generates several links.
create or replace function public.create_referral_link(p_referrer_id uuid, p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_expiration_days integer;
  v_slug text;
begin
  select referral_link_expiration_days into v_expiration_days from reward_settings;

  select lower(regexp_replace(split_part(coalesce(full_name, ''), ' ', 1), '[^a-zA-Z0-9]', '', 'g'))
  into v_slug
  from profiles
  where id = p_referrer_id;

  if v_slug is null or v_slug = '' then
    v_slug := 'friend';
  end if;

  v_token := v_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

  insert into referral_invites (referrer_id, phone, referral_token, expires_at)
  values (p_referrer_id, p_phone, v_token, now() + (v_expiration_days || ' days')::interval);

  return v_token;
end;
$$;

revoke all on function public.create_referral_link(uuid, text) from public;
grant execute on function public.create_referral_link(uuid, text) to service_role;

-- Silently no-ops on an invalid/expired/already-claimed token rather than
-- raising — a stale referral link shouldn't be able to fail someone's
-- account signup.
create or replace function public.claim_referral(p_token text, p_new_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update referral_invites
  set referred_id = p_new_user_id, status = 'signed_up'
  where referral_token = p_token
    and status in ('sent', 'clicked')
    and referred_id is null
    and expires_at > now();
end;
$$;

revoke all on function public.claim_referral(text, uuid) from public;
grant execute on function public.claim_referral(text, uuid) to service_role;

-- Idempotent: only fires once per referral_invites row (guarded by the
-- status = 'signed_up' condition — already-confirmed rows won't match).
create or replace function public.confirm_referral(p_referred_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id uuid;
  v_referrer_id uuid;
  v_amount numeric;
  v_expiration_days integer;
begin
  select id, referrer_id into v_invite_id, v_referrer_id
  from referral_invites
  where referred_id = p_referred_user_id and status = 'signed_up'
  limit 1;

  if v_invite_id is null then
    return;
  end if;

  update referral_invites set status = 'confirmed', confirmed_at = now() where id = v_invite_id;

  select referral_credit, credit_expiration_days into v_amount, v_expiration_days from reward_settings;

  insert into reward_credits (user_id, source_type, amount, status, reference_id, expires_at)
  values (v_referrer_id, 'referral', v_amount, 'confirmed', v_invite_id, now() + (v_expiration_days || ' days')::interval);
end;
$$;

revoke all on function public.confirm_referral(uuid) from public;
grant execute on function public.confirm_referral(uuid) to service_role;

-- p_admin_id is passed explicitly rather than read from auth.uid(): a
-- SECURITY DEFINER function invoked via the service role has no JWT
-- session, so auth.uid() is null inside it. The calling server action
-- already verified the caller is an admin (via requireAdmin()) and knows
-- their id, so it passes it through here for the reviewed_by audit trail.
create or replace function public.approve_repost(p_submission_id uuid, p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_amount numeric;
  v_expiration_days integer;
begin
  select user_id into v_user_id from repost_submissions where id = p_submission_id and status = 'pending';
  if v_user_id is null then
    return;
  end if;

  update repost_submissions
  set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now()
  where id = p_submission_id;

  select repost_credit, credit_expiration_days into v_amount, v_expiration_days from reward_settings;

  insert into reward_credits (user_id, source_type, amount, status, reference_id, expires_at)
  values (v_user_id, 'repost', v_amount, 'confirmed', p_submission_id, now() + (v_expiration_days || ' days')::interval);
end;
$$;

revoke all on function public.approve_repost(uuid, uuid) from public;
grant execute on function public.approve_repost(uuid, uuid) to service_role;

create or replace function public.reject_repost(p_submission_id uuid, p_admin_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update repost_submissions
  set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(), notes = p_reason
  where id = p_submission_id and status = 'pending';
end;
$$;

revoke all on function public.reject_repost(uuid, uuid, text) from public;
grant execute on function public.reject_repost(uuid, uuid, text) to service_role;

create or replace function public.approve_review(p_submission_id uuid, p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_amount numeric;
  v_expiration_days integer;
begin
  select user_id into v_user_id from review_submissions where id = p_submission_id and status = 'pending';
  if v_user_id is null then
    return;
  end if;

  update review_submissions
  set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now()
  where id = p_submission_id;

  select review_credit, credit_expiration_days into v_amount, v_expiration_days from reward_settings;

  insert into reward_credits (user_id, source_type, amount, status, reference_id, expires_at)
  values (v_user_id, 'review', v_amount, 'confirmed', p_submission_id, now() + (v_expiration_days || ' days')::interval);
end;
$$;

revoke all on function public.approve_review(uuid, uuid) from public;
grant execute on function public.approve_review(uuid, uuid) to service_role;

create or replace function public.reject_review(p_submission_id uuid, p_admin_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update review_submissions
  set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(), notes = p_reason
  where id = p_submission_id and status = 'pending';
end;
$$;

revoke all on function public.reject_review(uuid, uuid, text) from public;
grant execute on function public.reject_review(uuid, uuid, text) to service_role;

-- Pooled-balance FIFO redemption: consumes the oldest confirmed,
-- unexpired, not-fully-spent credit lines first, partially consuming a
-- line if needed, until p_amount is covered or the balance runs out.
-- Returns the amount actually applied (<= p_amount). Row-locks each line
-- it touches (`for update`) so two concurrent bookings can't both spend
-- the same dollars.
create or replace function public.redeem_credit_balance(p_user_id uuid, p_amount numeric, p_appointment_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining numeric := p_amount;
  v_row record;
  v_take numeric;
  v_total_applied numeric := 0;
begin
  if p_amount is null or p_amount <= 0 then
    return 0;
  end if;

  for v_row in
    select id, amount, redeemed_amount
    from reward_credits
    where user_id = p_user_id
      and status = 'confirmed'
      and expires_at > now()
      and redeemed_amount < amount
    order by earned_at asc
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(v_remaining, v_row.amount - v_row.redeemed_amount);

    update reward_credits
    set redeemed_amount = redeemed_amount + v_take,
        status = case when redeemed_amount + v_take >= amount then 'redeemed' else status end,
        redeemed_at = case when redeemed_amount + v_take >= amount then now() else redeemed_at end
    where id = v_row.id;

    insert into reward_credit_applications (reward_credit_id, appointment_id, amount)
    values (v_row.id, p_appointment_id, v_take);

    v_remaining := v_remaining - v_take;
    v_total_applied := v_total_applied + v_take;
  end loop;

  return v_total_applied;
end;
$$;

revoke all on function public.redeem_credit_balance(uuid, numeric, uuid) from public;
grant execute on function public.redeem_credit_balance(uuid, numeric, uuid) to service_role;

-- Scheduled daily (see the pg_cron pattern in 0004_reminder_schedule.sql —
-- wire this up the same way once you're ready to enable it).
create or replace function public.expire_credits()
returns void
language sql
security definer
set search_path = public
as $$
  update reward_credits
  set status = 'expired'
  where status = 'confirmed' and expires_at < now() and redeemed_amount < amount;
$$;

revoke all on function public.expire_credits() from public;
grant execute on function public.expire_credits() to service_role;

-- Manual adjustment tool. "Revoke" sets status to 'rejected' rather than
-- inserting a negative-amount row, since amount is constrained to be
-- positive (issuing and revoking are both just status/row operations, not
-- a running ledger with negative entries).
create or replace function public.admin_issue_credit(p_admin_id uuid, p_user_id uuid, p_amount numeric, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expiration_days integer;
  v_credit_id uuid;
begin
  select credit_expiration_days into v_expiration_days from reward_settings;

  insert into reward_credits (user_id, source_type, amount, status, expires_at, created_by, notes)
  values (p_user_id, 'manual', p_amount, 'confirmed', now() + (v_expiration_days || ' days')::interval, p_admin_id, p_reason)
  returning id into v_credit_id;

  return v_credit_id;
end;
$$;

revoke all on function public.admin_issue_credit(uuid, uuid, numeric, text) from public;
grant execute on function public.admin_issue_credit(uuid, uuid, numeric, text) to service_role;

create or replace function public.admin_revoke_credit(p_admin_id uuid, p_credit_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update reward_credits
  set status = 'rejected',
      notes = coalesce(notes || ' | ', '')
        || 'Revoked by admin ' || p_admin_id::text || ': ' || coalesce(p_reason, '(no reason given)')
  where id = p_credit_id and status in ('pending', 'confirmed');
end;
$$;

revoke all on function public.admin_revoke_credit(uuid, uuid, text) from public;
grant execute on function public.admin_revoke_credit(uuid, uuid, text) to service_role;
