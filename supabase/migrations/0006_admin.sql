-- Marks a profile as a studio admin. Deliberately not editable by
-- `authenticated` (see the column-level grants in 0003_security_hardening.sql
-- — profiles' update grant only covers full_name/avatar_url/phone) so a
-- member can never promote themselves. Flip this on for the business
-- owner's account directly in the Supabase Table Editor.
alter table profiles add column is_admin boolean not null default false;
