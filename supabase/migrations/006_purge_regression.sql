-- ============================================================
-- Migration 006: Purge Telegram/OTP/Pending Regression
-- Brings the live DB to the canonical schema. Idempotent.
-- ============================================================

-- 1. Drop legacy tables that should not exist
drop table if exists verification_codes cascade;
drop table if exists notifications cascade;
drop table if exists walkins cascade;
drop table if exists barber_preferences cascade;

-- 2. Drop walkin/preference RLS policies (safe if tables already gone)
-- (CASCADE on DROP TABLE handles policies, but be explicit for clarity)

-- 3. Drop legacy columns from barbers (idempotent)
alter table barbers drop column if exists telegram_user_id;
alter table barbers drop column if exists telegram_chat_id;
alter table barbers drop column if exists phone;
alter table barbers drop column if exists onboarding_completed;

-- Drop the old phone unique index if it survived
drop index if exists barbers_phone_key;

-- 4. Drop legacy columns from bookings
alter table bookings drop column if exists confirmed_at;
alter table bookings drop column if exists confirmed_by;
alter table bookings drop column if exists client_note;
alter table bookings drop column if exists is_walkin;

-- 5. Migrate any pending bookings to confirmed before tightening the constraint
update bookings set status = 'confirmed' where status = 'pending';

-- 6. Rewrite the status check constraint — no more 'pending'
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings
  add constraint bookings_status_check
  check (status in ('confirmed', 'cancelled', 'completed', 'no_show'));

-- 7. Drop legacy helper functions
drop function if exists is_admin();
drop function if exists is_location_admin(uuid);

-- 8. Drop legacy indexes that referenced removed tables
drop index if exists idx_verification_codes_phone;
drop index if exists idx_verification_codes_expires;
drop index if exists idx_walkins_barber_starts;

-- 9. Drop legacy booking indexes from migration 003
drop index if exists idx_bookings_status;
drop index if exists idx_bookings_starts_status;

-- ============================================================
-- Final state verification (these should all exist already):
-- locations, barbers, services, barber_services,
-- working_hours, time_off, clients, bookings
-- No: verification_codes, notifications, walkins, barber_preferences
-- ============================================================
