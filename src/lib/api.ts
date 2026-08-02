import type { Barber } from "./types";
import { supabase } from "./supabase";
import {
  getAvailableSlots,
  mergeSlotMaps,
} from "./availability";

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

/** Compute available slots directly from Supabase when the API route is unavailable. */
export async function fetchAvailableSlotsDirect(
  serviceId: string,
  barberId: string | null,
  fromDate: string,
  toDate: string,
): Promise<Record<string, string[]>> {
  const { data: service, error: svcErr } = await supabase
    .from("services")
    .select("id, duration_minutes")
    .eq("id", serviceId)
    .single();

  if (svcErr || !service) {
    throw new Error("Service not found");
  }

  let barberIds: string[] = [];
  if (barberId) {
    barberIds = [barberId];
  } else {
    const { data: bsData } = await supabase
      .from("barber_services")
      .select("barber_id")
      .eq("service_id", serviceId);

    if (bsData && bsData.length > 0) {
      const ids = bsData.map((bs) => bs.barber_id);
      const { data: active } = await supabase
        .from("barbers")
        .select("id")
        .in("id", ids)
        .eq("is_active", true);
      barberIds = active?.map((b) => b.id) ?? [];
    }

    if (barberIds.length === 0) {
      const { data: allActive } = await supabase
        .from("barbers")
        .select("id")
        .eq("is_active", true);
      barberIds = allActive?.map((b) => b.id) ?? [];
    }
  }

  if (barberIds.length === 0) return {};

  const [whRes, toRes, bookingRes, bsRes] = await Promise.all([
    supabase
      .from("working_hours")
      .select("barber_id, weekday, start_time, end_time")
      .in("barber_id", barberIds),
    supabase
      .from("time_off")
      .select("barber_id, date, start_time, end_time")
      .in("barber_id", barberIds)
      .gte("date", fromDate)
      .lte("date", toDate),
    supabase
      .from("bookings")
      .select("barber_id, starts_at, ends_at, status")
      .in("barber_id", barberIds)
      .in("status", ["confirmed", "pending"])
      .gte("starts_at", `${fromDate}T00:00:00Z`)
      .lte("starts_at", `${toDate}T23:59:59Z`),
    supabase
      .from("barber_services")
      .select("barber_id, service_id, custom_duration_minutes")
      .in("barber_id", barberIds)
      .eq("service_id", serviceId),
  ]);

  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  const maps = barberIds.map((bid) => {
    let workingHours = (whRes.data ?? []).filter((wh) => wh.barber_id === bid);
    if (workingHours.length === 0) {
      workingHours = [1, 2, 3, 4, 5, 6].map((weekday) => ({
        barber_id: bid,
        weekday,
        start_time: "09:00:00",
        end_time: "20:00:00",
      }));
    }

    const match = (bsRes.data ?? []).find((bs) => bs.barber_id === bid);
    const duration =
      Number(match?.custom_duration_minutes ?? service.duration_minutes) || 30;

    return getAvailableSlots(
      {
        barberId: bid,
        serviceId,
        durationMinutes: duration,
        workingHours: workingHours.map((wh) => ({
          weekday: wh.weekday,
          start_time: wh.start_time,
          end_time: wh.end_time,
        })),
        timeOff: (toRes.data ?? [])
          .filter((t) => t.barber_id === bid)
          .map((t) => ({
            date: t.date,
            start_time: t.start_time,
            end_time: t.end_time,
          })),
        bookings: (bookingRes.data ?? []).filter((b) => b.barber_id === bid),
      },
      from,
      to,
      30,
    );
  });

  const merged = mergeSlotMaps(maps);
  const result: Record<string, string[]> = {};
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    const dStr = cur.toISOString().substring(0, 10);
    result[dStr] = merged.get(dStr) ?? [];
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
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

  try {
    return await apiRequest<Record<string, string[]>>(
      `${API_BASE}/bookings/available-slots?${params}`,
    );
  } catch (err) {
    console.warn("available-slots API failed, using direct Supabase fallback:", err);
    return fetchAvailableSlotsDirect(serviceId, barberId, fromDate, toDate);
  }
}

export interface CreateBookingPayload {
  service_id: string;
  barber_id: string | null;
  starts_at: string;
  client_id: string;
  client_note?: string;
}

export interface CreateBookingResult {
  booking_id: string;
  status: "confirmed";
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
