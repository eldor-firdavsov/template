# Barbershop Booking System — Implementation Summary

A complete barbershop booking system with a customer-facing app and a barber dashboard. **Everything is in Uzbek**, mobile-first, and built as a template you can fork for any service-business project.

## What was built

### Database (Supabase / PostgreSQL)
- **Migration `003_booking_status_walkins.sql`** extends the schema with:
  - `pending` booking status (new client requests that the barber must confirm)
  - `confirmed_by` / `confirmed_at` audit columns
  - `client_note` for special requests
  - `is_walkin` flag on bookings
  - `barber_preferences` table for per-barber slot granularity (15 / 30 / 60 min)
  - `walkins` table for offline customers
  - RLS policies for the new tables

### Seed data (`supabase/seed.sql`)
- 1 sample location
- 8 services in Uzbek with categories
- 4 barbers (1 admin + 3 barbers)
- All barber↔service links
- Full Mon–Sat 09:00–20:00 working hours
- 30-minute slot granularity for all barbers

### Server API (Vercel Functions, `api/`)
- **`bookings/create.ts`** — creates a `pending` booking (not auto-confirmed)
- **`bookings/available-slots.ts`** — respects per-barber granularity, excludes walk-ins & pending bookings
- **`bookings/list.ts`** — exposes the new `client_note` / `is_walkin` / `confirmed_at` fields
- **`bookings/cancel.ts`** — allows cancelling pending bookings freely
- **`barber/pending.ts`** — lists pending requests for a barber
- **`barber/confirm.ts`** — confirm or reject a pending booking (with conflict re-check)
- **`barber/timeline.ts`** — full day timeline: working hours, bookings, walk-ins, free slots
- **`barber/walkin.ts`** — insert a walk-in (in-person customer) with conflict check
- **`barber/granularity.ts`** — get/set the barber's preferred slot granularity

### Customer app (Vite + React, `src/`)
- Full Uzbek localization (`src/lib/uz.ts`)
- Mobile-first modern styling with the warm amber accent
- Booking flow: **Service → Barber → Time → Confirm** (status `pending`) → **Success** (with "kuting" state)
- `StepConfirm` lets the client attach an optional note
- `MyBookings` shows pending/confirmed/cancelled/completed statuses in Uzbek
- All inputs use `+998 90 ...` style placeholders
- Prices shown as `50 000 so'm`
- Service step is grouped by category in Uzbek
- The 30-min granularity selected by the barber is automatically respected (no changes needed in the client)

### Barber dashboard (Vite + React, `barber-dashboard/`)
- New `src/lib/uz.ts` with full Uzbek strings
- New `DashboardLayout` component (responsive sidebar on desktop, bottom nav on mobile)
- **`TimelinePage`** — full day timeline with colored rows for free / pending / confirmed / walk-in, plus the "Walk-in qo'shish" button
- **`PendingPage`** — list of pending client requests with confirm / reject buttons, auto-refreshes every 15s
- **`WalkinModal`** — quick form to insert a walk-in (name, phone, service, time, note)
- `DashboardHome` — shows pending-count banner, stat cards, quick-action grid

## How to use as a template

1. **Rename the brand** in:
   - `index.html` (title, theme-color)
   - `src/lib/uz.ts` (`app.title`, `app.tagline`)
   - `barber-dashboard/src/lib/uz.ts` (`app.title`, `app.tagline`)
2. **Change services / prices / barbers / hours**: edit `supabase/seed.sql` and re-run it (idempotent upserts).
3. **Change the visual accent**: edit the `--color-accent` and `--color-accent-hover` values in `src/index.css` (and optionally `barber-dashboard/src/index.css` if you tweak the dashboard palette).
4. **Change slot granularity default**: change the `30` in the seed file and in `barber_preferences` default.

## To run locally

```sh
# 1. Apply the migrations to your Supabase project (in order)
#    001_initial_schema.sql
#    002_barber_auth_onboarding.sql
#    003_booking_status_walkins.sql
#    seed.sql

# 2. Customer app
npm install
npm run dev          # http://localhost:5173

# 3. Barber dashboard (in a second terminal)
cd barber-dashboard
npm install
npm run dev          # http://localhost:5174

# 4. API (Vercel) — set env vars in .env.local:
#    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN
```

## Build status
- ✅ Customer app builds (`npm run build`)
- ✅ Barber dashboard builds (`npm run build`)
- ✅ All new TypeScript types compile
