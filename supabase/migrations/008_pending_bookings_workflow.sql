-- Migration 008: Support Pending Bookings Workflow
alter table bookings drop constraint if exists bookings_status_check;

alter table bookings add constraint bookings_status_check
  check (status in ('pending','confirmed','declined','cancelled','completed','no_show'));

alter table bookings alter column status set default 'pending';

alter table bookings add column if not exists responded_at timestamptz;
alter table bookings add column if not exists responded_by uuid references barbers(id);
