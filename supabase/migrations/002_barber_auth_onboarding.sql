-- Barber Dashboard: Auth, Onboarding & Multi-Location Support
-- Run this as a Supabase migration

-- ============================================================
-- New Tables
-- ============================================================

-- Locations table for multi-location support
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Verification codes table for Telegram OTP
create table if not exists verification_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Alter existing tables
-- ============================================================

-- Add new columns to barbers table
alter table barbers 
  add column if not exists phone text unique,
  add column if not exists telegram_chat_id bigint unique,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists location_id uuid references locations(id);

-- Update role column if it exists (from 001 migration)
-- The 001 migration already has role, so we just ensure the check constraint exists
do $$
begin
    if exists (select 1 from information_schema.columns where table_name = 'barbers' and column_name = 'role') then
        -- Role column exists, ensure check constraint
        alter table barbers drop constraint if exists barbers_role_check;
        alter table barbers add constraint barbers_role_check check (role in ('barber','admin'));
    else
        -- Role column doesn't exist, add it
        alter table barbers add column role text not null default 'barber' check (role in ('barber','admin'));
    end if;
end $$;

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists idx_verification_codes_phone on verification_codes(phone);
create index if not exists idx_verification_codes_expires on verification_codes(expires_at);
create index if not exists idx_barbers_location on barbers(location_id);

-- ============================================================
-- RLS Policies
-- ============================================================

-- Enable RLS on new tables
alter table locations enable row level security;
alter table verification_codes enable row level security;

-- Drop existing policies that might conflict
drop policy if exists "Public read locations" on locations;
drop policy if exists "Admins can insert locations" on locations;
drop policy if exists "Admins can update locations" on locations;

drop policy if exists "Barbers can read own profile" on barbers;
drop policy if exists "Barbers can update own profile" on barbers;
drop policy if exists "Admins can read location barbers" on barbers;
drop policy if exists "Admins can update location barbers" on barbers;

-- Locations: public read, authenticated write (for admins)
create policy "Public read locations"
  on locations for select
  using (is_active = true);

create policy "Admins can insert locations"
  on locations for insert
  with check (
    exists (
      select 1 from barbers me
      where me.id = auth.uid() 
      and me.role = 'admin'
    )
  );

create policy "Admins can update locations"
  on locations for update
  using (
    exists (
      select 1 from barbers me
      where me.id = auth.uid() 
      and me.role = 'admin'
    )
  );

-- Verification codes: service role only (no direct client access)
-- All operations go through server-side API routes

-- ============================================================
-- Update existing barber policies for new columns
-- ============================================================

-- Barbers can read their own full data
create policy "Barbers can read own profile"
  on barbers for select
  using (id = auth.uid());

-- Barbers can update their own profile
-- Note: Field-level restrictions are enforced server-side via API
create policy "Barbers can update own profile"
  on barbers for update
  using (id = auth.uid());

-- Admins can read all barbers in their location
create policy "Admins can read location barbers"
  on barbers for select
  using (
    exists (
      select 1 from barbers me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.location_id = barbers.location_id
    )
  );

-- Admins can update barbers in their location
create policy "Admins can update location barbers"
  on barbers for update
  using (
    exists (
      select 1 from barbers me
      where me.id = auth.uid()
        and me.role = 'admin'
        and me.location_id = barbers.location_id
    )
  );

-- ============================================================
-- Function to check if user is admin
-- ============================================================

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from barbers 
    where id = auth.uid() and role = 'admin'
  );
$$;
