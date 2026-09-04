-- Tracks when a member last viewed Early Access, so the nav can show an
-- unread dot when something newer has been posted since. Low-stakes value
-- a member can only affect for their own row, so it's fine to add straight
-- to the existing self-service update grant from 0003_security_hardening.sql.
alter table profiles add column early_access_seen_at timestamptz;
grant update (early_access_seen_at) on profiles to authenticated;
