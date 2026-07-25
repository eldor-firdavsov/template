-- Migration 005: Canonical Schema Alignment

-- Locations table
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Barbers table
create table if not exists barbers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  photo_url text,
  bio text,
  email text unique,
  auth_user_id uuid references auth.users(id) on delete set null,
  role text not null default 'barber' check (role in ('barber', 'admin')),
  location_id uuid references locations(id) on delete set null,
  is_active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);

-- Ensure columns on barbers table if it already existed
alter table barbers add column if not exists full_name text;
alter table barbers add column if not exists photo_url text;
alter table barbers add column if not exists bio text;
alter table barbers add column if not exists email text unique;
alter table barbers add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table barbers add column if not exists role text not null default 'barber';
alter table barbers add column if not exists location_id uuid references locations(id) on delete set null;
alter table barbers add column if not exists is_active boolean not null default true;
alter table barbers add column if not exists sort_order integer default 0;

-- Drop legacy barber columns if existing
alter table barbers drop column if exists phone;
alter table barbers drop column if exists telegram_chat_id;
alter table barbers drop column if exists onboarding_completed;

-- Services table
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text default 'General',
  duration_minutes integer not null default 30,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);

-- Barber Services junction table
create table if not exists barber_services (
  barber_id uuid references barbers(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  custom_duration_minutes integer,
  primary key (barber_id, service_id)
);

-- Working Hours table
create table if not exists working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references barbers(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null
);

-- Time Off table
create table if not exists time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references barbers(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now()
);

-- Clients table
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  full_name text not null,
  telegram_user_id bigint,
  first_seen_at timestamptz not null default now(),
  is_blocked boolean not null default false
);

alter table clients add column if not exists first_seen_at timestamptz not null default now();
alter table clients add column if not exists is_blocked boolean not null default false;

-- Bookings table
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references barbers(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  price_at_booking numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('client', 'barber', 'admin'))
);

-- Drop legacy tables
drop table if exists verification_codes cascade;
drop table if exists notifications cascade;
