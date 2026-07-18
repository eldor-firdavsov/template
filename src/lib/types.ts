export interface Barber {
  id: string;
  full_name: string;
  photo_url: string | null;
  telegram_user_id: number | null;
  role: "barber" | "admin";
  is_active: boolean;
  bio: string | null;
  sort_order: number;
  phone: string | null;
  telegram_chat_id: number | null;
  onboarding_completed: boolean;
  location_id: string | null;
}

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface BarberService {
  barber_id: string;
  service_id: string;
  custom_duration_minutes: number | null;
}

export interface WorkingHours {
  id: string;
  barber_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface TimeOff {
  id: string;
  barber_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface Client {
  id: string;
  telegram_user_id: number;
  full_name: string;
  phone: string;
  first_seen_at: string;
  is_blocked: boolean;
}

export interface Booking {
  id: string;
  barber_id: string;
  service_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  price_at_booking: number;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: "client" | "barber" | "admin" | null;
}

export interface BookingWithDetails extends Booking {
  barber?: Barber;
  service?: Service;
}

export interface TimeRange {
  start: string;
  end: string;
}

export type Step =
  | "service"
  | "barber"
  | "time"
  | "confirm"
  | "success"
  | "bookings";

export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface VerificationCode {
  id: string;
  phone: string;
  code_hash: string;
  expires_at: string;
  consumed: boolean;
  created_at: string;
}
