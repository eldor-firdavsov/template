-- ============================================================
-- Barbershop Sample Seed Data (Uzbek)
-- ============================================================
-- Run AFTER all migrations.
-- This file inserts example services, a barbershop location, barbers,
-- barber↔service links, and full working hours.
--
-- IMPORTANT: All identifiers are fixed UUIDs so the seed is idempotent.
-- Re-running will upsert the same rows without creating duplicates.
-- ============================================================

-- -----------------------------------------------------------
-- 1. Sample location (single barbershop)
-- -----------------------------------------------------------
insert into locations (id, name, address, phone, is_active)
values (
  '11111111-1111-1111-1111-111111111111',
  'Asaka Sartaroshxona',
  'Bunyodkor Shoh Ko''chasi 15, Chilonzor, Toshkent, Uzbekistan',
  '+998 71 200 00 00',
  true
)
on conflict (id) do update set
  name = excluded.name,
  address = excluded.address,
  phone = excluded.phone;

-- -----------------------------------------------------------
-- 2. Sample services
-- -----------------------------------------------------------
insert into services (id, name, duration_minutes, price, category, is_active, sort_order) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sochni klassik olish',     30, 50000,  'Soch',     true, 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Sochni mashina bilan olish', 20, 35000,  'Soch',     true, 2),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Soqol olish',              30, 40000,  'Soqol',    true, 3),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Soch + Soqol',             60, 80000,  'Kombo',    true, 4),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Bolalar sochi',            30, 40000,  'Bolalar',  true, 5),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Sochni bo''yash',          90, 150000, 'Soch',     true, 6),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Yuz parvarishi',           45, 100000, 'Yuz',      true, 7),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Sochni turmaklash',        60, 120000, 'Soch',     true, 8)
on conflict (id) do update set
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price = excluded.price,
  category = excluded.category,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;


