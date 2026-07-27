-- Migration 010: Allow web/anon clients to insert and read clients & bookings, and restore client_note

-- 1. Ensure client_note column exists on bookings table
alter table bookings add column if not exists client_note text;

-- 2. Allow public/anon read, insert, and update on clients table
create policy "Public insert clients"
  on clients for insert
  with check (true);

create policy "Public select clients"
  on clients for select
  using (true);

create policy "Public update clients"
  on clients for update
  using (true);

-- 3. Allow public/anon read, insert, and update on bookings table
create policy "Public insert bookings"
  on bookings for insert
  with check (true);

create policy "Public select bookings"
  on bookings for select
  using (true);

create policy "Public update bookings"
  on bookings for update
  using (true);
