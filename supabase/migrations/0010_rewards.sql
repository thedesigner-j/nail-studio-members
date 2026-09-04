-- Points redemption: admins define rewards; members spend points to get a
-- redemption "voucher" they can apply toward a booking's price.

create table rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  points_cost integer not null check (points_cost > 0),
  discount_type text not null check (discount_type in ('fixed_cents', 'percent')),
  discount_value integer not null check (discount_value > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table rewards enable row level security;

create policy "rewards: readable by authenticated" on rewards
  for select using (auth.role() = 'authenticated');

-- Snapshots points_spent/discount at redemption time so changing or
-- deactivating a reward later doesn't affect vouchers already redeemed.
create table reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  reward_id uuid references rewards (id) on delete set null,
  points_spent integer not null,
  discount_type text not null check (discount_type in ('fixed_cents', 'percent')),
  discount_value integer not null,
  status text not null default 'available' check (status in ('available', 'used')),
  appointment_id uuid references appointments (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index reward_redemptions_user_id_idx on reward_redemptions (user_id);

alter table reward_redemptions enable row level security;

create policy "reward_redemptions: read own" on reward_redemptions
  for select using (auth.uid() = user_id);

-- No insert/update policy for `authenticated`: redeeming goes through
-- redeem_reward() below, and marking a voucher used-on-booking goes through
-- the service role from the booking server action (both server-only).

-- Atomically checks the member's balance, deducts points, and creates the
-- redemption row — avoids a race where two rapid clicks both pass a client
-- side balance check before either deduction lands.
create or replace function public.redeem_reward(p_user_id uuid, p_reward_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points_cost integer;
  v_discount_type text;
  v_discount_value integer;
  v_current_points integer;
  v_redemption_id uuid;
begin
  select points_cost, discount_type, discount_value
  into v_points_cost, v_discount_type, v_discount_value
  from rewards
  where id = p_reward_id and active = true;

  if v_points_cost is null then
    raise exception 'Reward not found or inactive';
  end if;

  select loyalty_points into v_current_points from profiles where id = p_user_id for update;

  if v_current_points is null or v_current_points < v_points_cost then
    raise exception 'Not enough points';
  end if;

  update profiles set loyalty_points = loyalty_points - v_points_cost where id = p_user_id;

  insert into reward_redemptions (user_id, reward_id, points_spent, discount_type, discount_value)
  values (p_user_id, p_reward_id, v_points_cost, v_discount_type, v_discount_value)
  returning id into v_redemption_id;

  return v_redemption_id;
end;
$$;

revoke all on function public.redeem_reward(uuid, uuid) from public;
grant execute on function public.redeem_reward(uuid, uuid) to service_role;
