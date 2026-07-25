# Barbershop Booking System — Implementation Tracker

## Done in this iteration (v2 refactor)

- [x] Architecture: drop the phone + Telegram OTP path; pivot to Supabase Auth (email + password).
- [x] Migration `004_barber_auth_email.sql`:
  - `barbers.email` (unique via partial index, NULLs allowed for seeded rows).
  - `barbers.auth_user_id` (FK to auth.users).
  - `role` already enforced as (`barber` | `admin`).
  - Drops `telegram_user_id`, `telegram_chat_id`, `phone`, `onboarding_completed`, and the `verification_codes` table.
  - New `current_barber()` helper + RLS that match by `auth.jwt() ->> 'email'`.
- [x] `api/barber/auth/signup.ts` — creates Supabase Auth user via service role, then inserts the `barbers` row. First signup on a fresh install becomes `admin`; everyone else is `barber`.
- [x] `api/barber/session.ts` — resolves the signed-in Supabase user to a `barbers` row by email.
- [x] `api/barber/booking-status.ts` — `completed` / `no_show` for past `confirmed` bookings (feeds the stats page).
- [x] `api/barber/clients.ts` — list + per-client history; `mine` / `shop` scope, admin-gated.
- [x] `api/barber/stats.ts` — bookings count, completed count, no-show count, completed revenue, no-show rate, busiest hour/day, top services.
- [x] `api/barber/timetable.ts` — day view for the logged-in barber, or shop-wide for admins.
- [x] `api/barber/schedule.ts` — read+replace own `working_hours` and `time_off`.
- [x] `api/barber/services-admin.ts` — admin-only: services + barber × service assignment matrix.
- [x] `api/barber/shop.ts` — admin-only: edit the single `locations` row.
- [x] Removed `api/auth/send-code.ts` and `api/auth/verify-code.ts` (the old phone + Telegram path).
- [x] Dashboard auth (Supabase Auth): `/barber/login` + `/barber/signup`, no more multi-step onboarding wizard.
- [x] `/barber/timetable` — day timeline with **Supabase Realtime** subscription, complete / no-show actions.
- [x] `/barber/clients` — client list with visit counts, drilldown history.
- [x] `/barber/schedule` — own `working_hours` + `time_off` editor.
- [x] `/barber/services` (admin) — services + barber × service matrix.
- [x] `/barber/shop` (admin) — edit the one shop row.
- [x] `/barber/stats` — date range, scope (mine/shop), per-barber filter (admin), top services, busiest times.
- [x] `lib/uz.ts` (English) + `styles.css` reusing the same design tokens as the client app.
- [x] Dropped Tailwind from the dashboard (plain CSS with design tokens). Dropped obsolete dashboard pages.
- [x] Both apps type-check (`tsc --noEmit` passes) and the dashboard `vite build` succeeds (~482 KB JS / ~136 KB gzip).

## Still TODO

- [ ] **Ask the user before running migration 004 if any existing rows in `barbers.email` would conflict with the new `unique` constraint.** The seed inserts 4 barbers with `email = NULL`, so the partial unique index (`WHERE email IS NOT NULL`) lets that through cleanly. If a fresh install has any non-NULL emails, the constraint will fail.
- [ ] Deploy: the dashboard builds into `barber-dashboard/dist`; the API routes in `api/barber/*` need to be wired into the Vercel project (already covered by `vercel.json`'s `api/**/*.ts` build).
- [ ] If you want production-grade auth flow, swap `email_confirm: true` in the signup endpoint for an email-redirect confirmation and run `supabase.auth.signInWithOtp` from the client.
- [ ] Add a Playwright/Vitest smoke for the dashboard pages once Supabase env is set.
- [ ] Wire the client app's `src/index.css` `--color-bg` etc. tokens directly into the dashboard's `styles.css` (already done in spirit; can extract to a shared package later).
