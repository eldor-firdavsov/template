# BarberUp Barber Dashboard

A standalone React dashboard for barbers to manage their profile, services, and shop settings. This dashboard shares the same Supabase backend with the client booking website.

## Features

- **Telegram OTP Authentication**: Secure login using phone number + 6-digit verification code delivered via Telegram
- **Multi-step Onboarding**: Guided setup for new barbers (profile, location, working hours, services)
- **Profile Management**: Edit personal info, bio, photo, and working hours
- **Service Management**: Toggle which services to offer with custom duration overrides
- **Admin Shop Settings** (admin only):
  - Manage shop-wide services and prices
  - Manage multiple locations
  - Manage barbers (activate/deactivate)
  - Generate invite links for new barbers
- **Real-time Dashboard**: View stats and upcoming appointments

## Architecture

This is a separate React application from the client booking website, but both share the same Supabase backend. The dashboard is designed for barbers/admins, while the client site is for customers booking appointments.

## Setup

### Prerequisites

- Node.js 18+
- Supabase project with the required migrations applied
- Telegram bot token (for OTP delivery)

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TELEGRAM_BOT_USERNAME=testforeldorbot
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The dashboard will run on `http://localhost:3001` and proxy API requests to the main server at `http://localhost:3000`.

### Build

```bash
npm run build
```

## Database Setup

Apply the migration `supabase/migrations/002_barber_auth_onboarding.sql` to your Supabase project. This adds:

- `verification_codes` table for OTP storage
- `locations` table for multi-location support
- New columns to `barbers` table: `phone`, `telegram_chat_id`, `onboarding_completed`, `role`, `location_id`

## Telegram Bot Setup

The Telegram webhook is deployed as a Supabase Edge Function at `supabase/functions/telegram-webhook/index.ts`.

### Environment Variables for Edge Function

Set these in your Supabase project:

```
TELEGRAM_BOT_TOKEN=8795588771:AAGX1CRqhzbExtPTjNoQkwkr5-n4q_NRwFA
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Webhook Setup

Set the webhook for your Telegram bot:

```bash
curl -X POST "https://api.telegram.org/bot8795588771:AAGX1CRqhzbExtPTjNoQkwkr5-n4q_NRwFA/setWebhook?url=https://your-project.supabase.co/functions/v1/telegram-webhook"
```

## API Endpoints

The dashboard uses the following API endpoints (hosted on the main server):

### Auth
- `POST /api/auth/send-code` - Send verification code to phone
- `POST /api/auth/verify-code` - Verify code and authenticate

### Resources
- `GET/POST /api/locations` - Manage locations
- `GET/POST/PATCH /api/services` - Manage services
- `GET/POST/PATCH/DELETE /api/working-hours` - Manage working hours
- `GET/POST/DELETE /api/barber-services` - Link barbers to services
- `GET/PATCH /api/barbers/:id` - Manage barber profiles

## User Roles

- **Admin**: First barber to register for a location. Can manage shop settings, services, locations, and other barbers.
- **Barber**: Invited by an admin. Can only manage their own profile, services, and working hours.

## Onboarding Flow

1. **Profile**: Enter name, bio, and photo
2. **Location**: Create shop/location (for first barber) or join existing
3. **Working Hours**: Set weekly schedule
4. **Services**: Add services offered
5. **Complete**: Redirect to dashboard

## Invite Flow

Admins can generate invite links that pre-fill the `location_id` for new barbers. When a barber registers using an invite link:
- They skip location/service setup (already exists)
- They only complete profile + working hours onboarding
- They're assigned the `barber` role automatically

## Deployment

### Vercel

1. Connect your Git repository
2. Set environment variables in Vercel dashboard
3. Deploy

The dashboard should be deployed to a separate subdomain (e.g., `dashboard.barberup.com`) from the client site.

## Security Notes

- OTP codes are stored with 5-minute expiry
- Codes are marked as consumed after use
- Phone changes require re-verification
- Admin-only routes are protected by role checks
- All API mutations use service role key (server-side)

## Future Enhancements

- Real-time appointment stream via Supabase subscriptions
- Calendar view for appointments
- Revenue analytics and reporting
- Time-off management
- Client communication tools
