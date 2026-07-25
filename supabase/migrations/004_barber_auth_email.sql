-- ============================================================
-- Barbershop Client Bot — Supabase Auth (email + password) for barbers
-- Replaces the earlier phone + Telegram OTP path (reversed).
-- Run AFTER migrations 001, 002, 003.
-- ============================================================

-- ============================================================
-- 1. Add email + auth_user_id to barbers
--    - `email` is unique so a Supabase Auth user maps to exactly one barber row
--    - `auth_user_id` is the optional cached link to auth.users(id) (helpful for
--      admin lookups; auth lookup still uses email for signup/login).
--    - `role` already exists with the (barber|admin) check from 001/002 — keep it.
-- ============================================================
alter table barbers
  add column if not exists email text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

-- The new uniqueness constraint. NOTE: the seed inserts all four barbers with
-- NULL email, so this constraint is created with NULLS DISTINCT (Postgres 15+)
-- behavior — a uniqueness index using IS NOT NULL. We use a partial index to
-- avoid the "duplicate NULL" trap on seeded rows.
create unique index if not exists barbers_email_unique_idx
  on barbers (lower(email))
  where email is not null;

create index if not exists barbers_auth_user_id_idx
  on barbers (auth_user_id);

-- ============================================================
-- 2. Drop the old phone + Telegram scaffolding
--    Reverses anything added for the phone+OTP/Telegram flow.
-- ============================================================

-- 2a. Drop telegram-only columns from barbers
alter table barbers
  drop column if exists telegram_user_id,
  drop column if exists telegram_chat_id,
  drop column if exists phone,
  drop column if exists onboarding_completed;

-- 2b. Drop the verification_codes table (Telegram OTP)
drop table if exists verification_codes;

-- 2c. Drop the barbers.phone unique index if it was created in 002
drop index if exists barbers_phone_key;

-- ============================================================
-- 3. Tighten RLS for the new auth model
--    The barber row is matched to the Supabase Auth session by email, not by
--    row id == auth.uid(). That means the dashboard uses the service-role
--    API endpoints to read/update barbers (same pattern as clients).
-- ============================================================

-- Drop the old "barbers can read/update own row by id = auth.uid()" policies
-- from migration 002. They no longer apply: the dashboard uses email lookup.
drop policy if exists "Barbers can read own profile" on barbers;
drop policy if exists "Barbers can update own profile" on barbers;
drop policy if exists "Admins can read location barbers" on barbers;
drop policy if exists "Admins can update location barbers" on barbers;

-- Public-read policies for reference data already exist from 001/002. Keep them.

-- Drop the old is_admin() helper (it was keyed off id = auth.uid())
drop function if exists is_admin();

-- New helper: look up the barber row by the signed-in auth user's email.
-- Returns the barbers row, or NULL.
create or replace function current_barber()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  is_active boolean,
  photo_url text,
  bio text,
  sort_order int,
  location_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    b.id, b.email, b.full_name, b.role, b.is_active,
    b.photo_url, b.bio, b.sort_order, b.location_id
  from barbers b
  where b.email = auth.jwt() ->> 'email'
  limit 1;
$$;

grant execute on function current_barber() to authenticated;

-- A logged-in barber can read their own row via the helper
create policy "Barbers can read own row via email"
  on barbers for select
  to authenticated
  using (email = auth.jwt() ->> 'email');

-- Drop the old location-admin helper, since admins now match on email not auth.uid()
drop function if exists is_location_admin(uuid);

-- ============================================================
-- 4. Update the locations RLS — admin can update the one shop row by email match
-- ============================================================
drop policy if exists "Admins can insert locations" on locations;
drop policy if exists "Admins can update locations" on locations;

-- No insert policy: this is a single-shop template, the seeded row is enough.
create policy "Admins can update the shop"
  on locations for update
  to authenticated
  using (
    exists (
      select 1 from barbers me
      where me.email = auth.jwt() ->> 'email'
        and me.role = 'admin'
        and me.is_active = true
    )
  );

-- ============================================================
-- 5. Booking status: nothing structural changes. The new "complete" and
--    "no_show" actions are written by the dashboard via the new API
--    endpoint (api/barber/booking-status.ts) using the service role.
-- ============================================================
