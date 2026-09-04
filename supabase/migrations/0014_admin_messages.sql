-- Lets admins read every member's message thread and reply as the business,
-- so the studio has an in-app reply UI instead of inserting rows by hand in
-- the table editor. Idempotent: safe to re-run.
drop policy if exists "messages: admins read all" on messages;
create policy "messages: admins read all" on messages
  for select using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

drop policy if exists "messages: admins send as business" on messages;
create policy "messages: admins send as business" on messages
  for insert with check (
    sender = 'business'
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

drop policy if exists "messages: admins mark read" on messages;
create policy "messages: admins mark read" on messages
  for update using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));
