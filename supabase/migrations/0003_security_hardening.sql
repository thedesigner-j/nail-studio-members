-- Row Level Security only restricts which rows a user can touch, not which
-- columns. Without this, a member could call the Supabase REST API directly
-- (using their own valid session) and set their own loyalty_points, or
-- change the price_cents on their own appointment. Lock those columns down
-- with column-level privileges and route sensitive writes through
-- SECURITY DEFINER functions callable only by the server's service role.

revoke update on profiles from authenticated;
grant update (full_name, avatar_url, phone) on profiles to authenticated;

revoke insert on appointments from authenticated;
grant insert (user_id, service_id, starts_at, ends_at, price_cents, notes) on appointments to authenticated;

revoke update on appointments from authenticated;
grant update (status, notes) on appointments to authenticated;

create or replace function public.increment_loyalty_points(p_user_id uuid, p_points integer)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set loyalty_points = loyalty_points + p_points where id = p_user_id;
$$;

revoke all on function public.increment_loyalty_points(uuid, integer) from public;
grant execute on function public.increment_loyalty_points(uuid, integer) to service_role;
