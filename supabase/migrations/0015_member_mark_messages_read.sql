-- Lets a member mark the business's messages in their own thread as read
-- (drives the unread badge in the nav), without opening up the ability to
-- rewrite message body/sender — same column-scoped grant pattern used for
-- appointments in 0003_security_hardening.sql. Idempotent: safe to re-run.
revoke update on messages from authenticated;
grant update (read_at) on messages to authenticated;

drop policy if exists "messages: member mark own thread read" on messages;
create policy "messages: member mark own thread read" on messages
  for update using (auth.uid() = user_id);
