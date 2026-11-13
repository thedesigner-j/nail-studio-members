-- LOCAL DEVELOPMENT ONLY.
--
-- `supabase start` and `supabase db reset` run this file against the local
-- database after the migrations. It is never applied to a hosted project by
-- the normal migration workflow (`supabase db push` skips seed files unless
-- you pass --include-seed, which you should not do for production).

-- No Stripe keys locally, so skip the deposit step: bookings confirm
-- straight away instead of sending the member to Stripe checkout. Set it back
-- in the Table Editor (booking_settings) if you add Stripe test keys.
update public.booking_settings set deposit_percent = 0;

-- 0004 schedules an hourly call to the reminder edge function on a hosted
-- project (<project-ref> placeholder). Locally that URL doesn't exist, so
-- turn the job off rather than let it fail every hour.
select cron.unschedule('send-appointment-reminders-hourly');

-- A ready-made admin account so there's something to sign in with after
-- every reset:  admin@example.com / password123
-- The on_auth_user_created trigger creates the matching profiles row.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000a0a0',
  'authenticated', 'authenticated',
  'admin@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Studio Admin"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  '00000000-0000-0000-0000-00000000a0a0',
  '00000000-0000-0000-0000-00000000a0a0',
  '00000000-0000-0000-0000-00000000a0a0',
  'email',
  '{"sub": "00000000-0000-0000-0000-00000000a0a0", "email": "admin@example.com", "email_verified": true}',
  now(), now(), now()
);

update public.profiles set is_admin = true
where id = '00000000-0000-0000-0000-00000000a0a0';

-- A nail tech account for trying Skill Projects:  tech@example.com / password123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000b0b0',
  'authenticated', 'authenticated',
  'tech@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Nail Tech"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  '00000000-0000-0000-0000-00000000b0b0',
  '00000000-0000-0000-0000-00000000b0b0',
  '00000000-0000-0000-0000-00000000b0b0',
  'email',
  '{"sub": "00000000-0000-0000-0000-00000000b0b0", "email": "tech@example.com", "email_verified": true}',
  now(), now(), now()
);

update public.profiles set is_tech = true
where id = '00000000-0000-0000-0000-00000000b0b0';
