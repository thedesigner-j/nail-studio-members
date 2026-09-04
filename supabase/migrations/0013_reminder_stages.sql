-- Splits the single reminder_sent_at flag into two independently-tracked
-- reminder stages (48h-out and day-of), so a member gets one reminder a
-- couple days ahead and another the same day, instead of just one at ~24h.
-- Idempotent: safe to re-run.
alter table appointments drop column if exists reminder_sent_at;
alter table appointments add column if not exists reminder_48h_sent_at timestamptz;
alter table appointments add column if not exists reminder_dayof_sent_at timestamptz;
