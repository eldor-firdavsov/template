export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  photo_url: string | null;
  is_active: boolean;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
}

export interface Barber {
  id: string;
  full_name: string;
  photo_url: string | null;
  bio: string | null;
  email: string | null;
  phone?: string | null;
  auth_user_id: string | null;
  role: "barber" | "admin";
  location_id: string | null;
  is_active: boolean;
  sort_order: number;
  location?: Location;
}

export interface Service {
  id: string;
  name: string;
  category: string | null;
  duration_minutes: number;
  price: number;
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
  weekday: number; // 0=Sunday, 6=Saturday
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
  phone: string;
  full_name: string;
  telegram_user_id: number | null;
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
  status: "pending" | "confirmed" | "declined" | "cancelled" | "completed" | "no_show";
  price_at_booking: number;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: "client" | "barber" | "admin" | null;
  notes?: string | null;
  client_note?: string | null;
  responded_at?: string | null;
  responded_by?: string | null;
}

export interface BookingWithDetails extends Booking {
  barber?: Barber;
  service?: Service;
  client?: Client;
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
