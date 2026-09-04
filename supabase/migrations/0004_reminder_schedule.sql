-- Calls the send-appointment-reminders edge function every hour so members
-- get a reminder about a day before their appointment. Requires the
-- pg_cron and pg_net extensions, available on Supabase's hosted Postgres.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Replace project-ref and the two secrets below with real values (Project
-- Settings > API for the ref/anon-adjacent URL, and a CRON_SECRET you also
-- set as an edge function secret) before running this migration, or set
-- them via `supabase secrets set` and reference vault.decrypted_secrets
-- instead of hardcoding.
select cron.schedule(
  'send-appointment-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    )
  );
  $$
);
