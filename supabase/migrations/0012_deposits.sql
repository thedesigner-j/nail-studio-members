-- Booking deposits via Stripe. Members pay a percentage of the service
-- price up front to confirm a booking; the rest is collected in person and
-- recorded the same way payments already are (admin marks the visit paid
-- & completed). Deposit is refunded on advance cancellation, forfeited on
-- no-show or late cancellation.

-- === Reset (safe to re-run from any partial state, see 0011 for why) =========

drop table if exists booking_settings cascade;
alter table appointments drop column if exists deposit_status;
alter table appointments drop column if exists deposit_amount_cents;
alter table appointments drop column if exists stripe_payment_intent_id;
alter table appointments drop constraint if exists appointments_status_check;

-- === Settings (single row) ===================================================

create table booking_settings (
  id boolean primary key default true check (id),
  deposit_percent numeric(5, 2) not null default 20,
  -- Cancelling at least this many hours before the appointment refunds the
  -- deposit; cancelling within this window forfeits it (same as a no-show).
  cancellation_refund_hours integer not null default 24
);

insert into booking_settings (id) values (true) on conflict (id) do nothing;

alter table booking_settings enable row level security;

create policy "booking_settings: readable by authenticated" on booking_settings
  for select using (auth.role() = 'authenticated');

-- No insert/update policy for `authenticated` — admin-only, via service role.

-- === Appointments: deposit tracking ============================================

alter table appointments add column deposit_status text not null default 'none'
  check (deposit_status in ('none', 'pending', 'paid', 'refunded', 'forfeited'));
alter table appointments add column deposit_amount_cents integer not null default 0
  check (deposit_amount_cents >= 0);
-- Needed to issue a refund later (Stripe's refund API takes a payment
-- intent or charge id, not the checkout session id).
alter table appointments add column stripe_payment_intent_id text;

-- 'pending_payment' is new: the appointment row is created (holding the
-- slot) as soon as a deposit checkout starts, before Stripe confirms
-- payment. See expire_stale_pending_appointments() below for cleanup if
-- the member abandons checkout.
alter table appointments add constraint appointments_status_check
  check (status in ('pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show'));

-- === Fix: session credit should count the full ticket, not just one payment ===

-- award_session_credit previously read "the most recent paid payment" for
-- an appointment, which was fine when there was only ever one payment row
-- per visit. With a deposit charged at booking and the remaining balance
-- recorded separately at completion, that undercounted the 8%-back credit
-- to just whichever payment happened to be most recent. Sum instead.
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

  select coalesce(sum(amount_cents), 0) into v_paid_cents
  from payments
  where appointment_id = p_appointment_id and status = 'paid';

  if v_paid_cents <= 0 then
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

-- === Cleanup for abandoned checkouts ===========================================

-- Scheduled every ~10-15 minutes (see README) — a pending_payment
-- appointment holds its slot, so an abandoned Stripe checkout shouldn't be
-- allowed to block it indefinitely.
create or replace function public.expire_stale_pending_appointments()
returns void
language sql
security definer
set search_path = public
as $$
  update appointments
  set status = 'cancelled'
  where status = 'pending_payment' and created_at < now() - interval '30 minutes';
$$;

revoke all on function public.expire_stale_pending_appointments() from public;
grant execute on function public.expire_stale_pending_appointments() to service_role;
