-- Barbershop Client Bot — Initial Schema
-- Run this as a Supabase migration

-- ============================================================
-- Tables
-- ============================================================

create table barbers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  photo_url text,
  telegram_user_id bigint unique,
  role text not null default 'barber' check (role in ('barber','admin')),
  is_active boolean not null default true,
  bio text,
  sort_order int not null default 0
);

create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes int not null,
  price numeric not null,
  category text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table barber_services (
  barber_id uuid references barbers(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  custom_duration_minutes int,
  primary key (barber_id, service_id)
);

create table working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references barbers(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null
);

create table time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references barbers(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  reason text
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique not null,
  full_name text not null,
  phone text not null,
  first_seen_at timestamptz not null default now(),
  is_blocked boolean not null default false
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references barbers(id) not null,
  service_id uuid references services(id) not null,
  client_id uuid references clients(id) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','cancelled','completed','no_show')),
  price_at_booking numeric not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('client','barber','admin'))
);

create index idx_bookings_barber_starts on bookings (barber_id, starts_at);
create index idx_bookings_client on bookings (client_id);

-- ============================================================
-- RLS Policies
-- ============================================================

alter table barbers enable row level security;
alter table services enable row level security;
alter table barber_services enable row level security;
alter table working_hours enable row level security;
alter table time_off enable row level security;
alter table clients enable row level security;
alter table bookings enable row level security;

-- Public read for reference tables (barbers, services, barber_services, working_hours)
-- These are needed for the client to browse options.
-- Time_off is also read publicly (no sensitive data).
-- All mutations go through server-side API routes with service role key.

create policy "Public read barbers"
  on barbers for select
  using (true);

create policy "Public read services"
  on services for select
  using (true);

create policy "Public read barber_services"
  on barber_services for select
  using (true);

create policy "Public read working_hours"
  on working_hours for select
  using (true);

create policy "Public read time_off"
  on time_off for select
  using (true);

-- Clients: no direct client access via RLS.
-- All client row operations go through server-side API routes
-- using the service role key. This prevents clients from reading
-- other clients' phone numbers or personal data.

-- Bookings: no direct client access via RLS.
-- All booking operations go through server-side API routes
-- using the service role key.
