-- Cleanup/buffer time after a service, before the next appointment can
-- start (e.g. a 15-minute gap to reset the station after acrylics).
alter table services add column buffer_minutes integer not null default 0 check (buffer_minutes >= 0);
