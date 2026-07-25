import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin";

// Day timeline for a barber — bookings and free slots
// GET /api/barber/timeline?barber_id=...&date=YYYY-MM-DD
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { barber_id, date } = req.query as { barber_id?: string; date?: string };
  if (!barber_id || !date) {
    return res.status(400).json({ error: "Missing barber_id or date" });
  }

  // Fixed 30-minute granularity
  const granularity = 30;

  // Compute the weekday for the requested date
  const targetDate = new Date(date + "T00:00:00Z");
  const weekday = targetDate.getUTCDay();

  // Fetch data in parallel
  const [whResult, bookingResult] = await Promise.all([
    supabaseAdmin
      .from("working_hours")
      .select("weekday, start_time, end_time")
      .eq("barber_id", barber_id)
      .eq("weekday", weekday),
    supabaseAdmin
      .from("bookings")
      .select(`
        id, starts_at, ends_at, status, price_at_booking,
        clients(full_name, phone),
        services(name, duration_minutes)
      `)
      .eq("barber_id", barber_id)
      .in("status", ["confirmed", "completed"])
      .gte("starts_at", `${date}T00:00:00Z`)
      .lte("starts_at", `${date}T23:59:59Z`)
      .order("starts_at", { ascending: true }),
  ]);

  const workingHours = (whResult.data ?? []).map((w) => ({
    weekday: w.weekday,
    start_time: String(w.start_time).slice(0, 5),
    end_time: String(w.end_time).slice(0, 5),
  }));

  // Build a flat list of occupied time ranges
  type Range = { start: string; end: string; ref_id: string };
  const occupied: Range[] = [];

  for (const b of bookingResult.data ?? []) {
    const start = new Date(b.starts_at);
    const end = new Date(b.ends_at);
    occupied.push({
      start: `${String(start.getUTCHours()).padStart(2, "0")}:${String(start.getUTCMinutes()).padStart(2, "0")}`,
      end: `${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}`,
      ref_id: b.id,
    });
  }

  // Sort occupied by start
  occupied.sort((a, b) => a.start.localeCompare(b.start));

  // Compute free slots
  const freeSlots: string[] = [];
  for (const wh of workingHours) {
    let slotStart = timeToMinutes(wh.start_time);
    const rangeEnd = timeToMinutes(wh.end_time);

    while (slotStart < rangeEnd) {
      const slotEnd = slotStart + granularity;
      // Skip if this slot overlaps any occupied range
      const overlaps = occupied.some(
        (o) => timeToMinutes(o.start) < slotEnd && timeToMinutes(o.end) > slotStart,
      );
      if (!overlaps && slotEnd <= rangeEnd) {
        freeSlots.push(minutesToTime(slotStart));
      }
      slotStart += granularity;
    }
  }

  // Format bookings
  const bookings = (bookingResult.data ?? []).map((b: Record<string, unknown>) => {
    const client = b.clients as { full_name: string; phone: string } | null;
    const service = b.services as { name: string; duration_minutes: number } | null;
    const start = new Date(b.starts_at as string);
    const end = new Date(b.ends_at as string);
    return {
      id: b.id,
      type: "booking" as const,
      status: b.status,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      start_time: `${String(start.getUTCHours()).padStart(2, "0")}:${String(start.getUTCMinutes()).padStart(2, "0")}`,
      end_time: `${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}`,
      price: b.price_at_booking,
      client_name: client?.full_name ?? null,
      client_phone: client?.phone ?? null,
      service_name: service?.name ?? null,
      service_duration: service?.duration_minutes ?? null,
    };
  });

  return res.json({
    date,
    granularity_minutes: granularity,
    working_hours: workingHours,
    bookings,
    free_slots: freeSlots,
  });
}

function timeToMinutes(t: string): number {
  const parts = t.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
