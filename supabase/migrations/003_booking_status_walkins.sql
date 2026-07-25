-- ============================================================
-- Barbershop Client Bot — Booking Status (pending/confirmed) & Walk-ins
-- Run as a Supabase migration
-- ============================================================

-- ============================================================
-- Extend booking status check
-- ============================================================
-- Original statuses: 'confirmed','cancelled','completed','no_show'
-- We add 'pending' — a new client booking that the barber must confirm.

alter table bookings drop constraint if exists bookings_status_check;
alter table bookings
  add constraint bookings_status_check
  check (status in ('pending','confirmed','cancelled','completed','no_show'));

-- Track who/when confirmed
alter table bookings
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references barbers(id),
  add column if not exists client_note text,
  add column if not exists is_walkin boolean not null default false;

create index if not exists idx_bookings_status on bookings (status);
create index if not exists idx_bookings_starts_status on bookings (starts_at, status);

-- ============================================================
-- Barber preferences (slot granularity chosen at onboarding)
-- ============================================================
create table if not exists barber_preferences (
  barber_id uuid primary key references barbers(id) on delete cascade,
  slot_granularity_minutes int not null default 30
    check (slot_granularity_minutes in (15, 30, 60)),
  updated_at timestamptz not null default now()
);

alter table barber_preferences enable row level security;

create policy "Public read barber preferences"
  on barber_preferences for select
  using (true);

create policy "Barbers can update own preferences"
  on barber_preferences for update
  using (id = auth.uid());

create policy "Barbers can insert own preferences"
  on barber_preferences for insert
  with check (id = auth.uid());

-- ============================================================
-- Walk-in customers (in-person, no online client record required)
-- ============================================================
create table if not exists walkins (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references barbers(id) not null,
  service_id uuid references services(id) not null,
  client_name text not null,
  client_phone text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_walkins_barber_starts on walkins (barber_id, starts_at);

alter table walkins enable row level security;

-- Public read so client-side availability check can include walk-ins
create policy "Public read walkins"
  on walkins for select
  using (true);

-- ============================================================
-- Helper: check admin by location
-- ============================================================
create or replace function is_location_admin(p_location_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from barbers
    where id = auth.uid() and role = 'admin' and location_id = p_location_id
  );
$$;
