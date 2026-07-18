import type { Barber } from "./types";

const API_BASE = "/api";

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = new URL(path, window.location.origin);

  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `API error ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

export async function fetchAvailableSlots(
  serviceId: string,
  barberId: string | null,
  fromDate: string,
  toDate: string,
): Promise<Record<string, string[]>> {
  const params = new URLSearchParams({
    service_id: serviceId,
    from_date: fromDate,
    to_date: toDate,
  });
  if (barberId) params.set("barber_id", barberId);

  return apiRequest<Record<string, string[]>>(
    `${API_BASE}/bookings/available-slots?${params}`,
  );
}

export interface CreateBookingPayload {
  service_id: string;
  barber_id: string | null;
  starts_at: string;
  client_id: string;
}

export interface CreateBookingResult {
  booking_id: string;
  barber: Barber;
}

export async function createBooking(
  payload: CreateBookingPayload,
): Promise<CreateBookingResult> {
  return apiRequest<CreateBookingResult>(`${API_BASE}/bookings/create`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ApiBooking {
  id: string;
  barber_id: string;
  service_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_at_booking: number;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  barber_name: string;
  barber_photo: string | null;
  service_name: string;
  service_duration: number;
}

export async function listBookings(clientId: string): Promise<ApiBooking[]> {
  const params = new URLSearchParams({ client_id: clientId });
  return apiRequest<ApiBooking[]>(`${API_BASE}/bookings/list?${params}`);
}

export async function cancelBooking(
  bookingId: string,
  clientId: string,
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`${API_BASE}/bookings/cancel`, {
    method: "POST",
    body: JSON.stringify({ booking_id: bookingId, client_id: clientId }),
  });
}

export async function ensureClient(payload: {
  full_name: string;
  phone: string;
}): Promise<{ client_id: string; is_new: boolean }> {
  return apiRequest<{ client_id: string; is_new: boolean }>(
    `${API_BASE}/client/ensure`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
