import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";

// Day timetable with bookings.
// Admin can request a specific barber_id or omit to see shop-wide.
//
// GET /api/barber/timetable?access_token=...&date=YYYY-MM-DD[&barber_id=...]
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { access_token, date, barber_id } = req.query as {
    access_token?: string;
    date?: string;
    barber_id?: string;
  };

  if (!access_token || !date) {
    return res.status(400).json({ error: "Missing access_token or date" });
  }

  // 1. Authenticate.
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(access_token);
  if (userErr || !userRes?.user) {
    return res.status(401).json({ error: "Invalid session" });
  }
  const callerEmail = (userRes.user.email ?? "").toLowerCase();

  const { data: caller, error: callerErr } = await supabaseAdmin
    .from("barbers")
    .select("id, role, is_active")
    .ilike("email", callerEmail)
    .maybeSingle();
  if (callerErr) {
    return res.status(500).json({ error: "Failed to identify caller" });
  }
  if (!caller || !caller.is_active) {
    return res.status(403).json({ error: "Not an active barber" });
  }

  const isAdmin = caller.role === "admin";

  // If barber_id is omitted:
  //   - admin: shop-wide
  //   - barber: their own
  const targetBarberId: string | null = barber_id ?? (isAdmin ? null : caller.id);

  // If non-admin asks for someone else's view, forbid
  if (targetBarberId && targetBarberId !== caller.id && !isAdmin) {
    return res.status(403).json({ error: "Cannot view another barber's timetable" });
  }

  const startISO = `${date}T00:00:00Z`;
  const endISO = `${date}T23:59:59Z`;

  // 2. Bookings (confirmed, completed — not cancelled).
  let bookingsQuery = supabaseAdmin
    .from("bookings")
    .select(
      "id, barber_id, service_id, client_id, starts_at, ends_at, status, price_at_booking, clients(full_name, phone), services(name, duration_minutes), barbers!bookings_barber_id_fkey(full_name)",
    )
    .in("status", ["confirmed", "completed"])
    .gte("starts_at", startISO)
    .lte("starts_at", endISO)
    .order("starts_at", { ascending: true });

  if (targetBarberId) {
    bookingsQuery = bookingsQuery.eq("barber_id", targetBarberId);
  }

  const { data: bookings, error: bookErr } = await bookingsQuery;
  if (bookErr) {
    return res.status(500).json({ error: "Failed to load bookings" });
  }

  // 3. Format
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };

  const bookingRows = (bookings ?? []).map((b: Record<string, unknown>) => {
    const client = b.clients as { full_name: string; phone: string } | null;
    const service = b.services as { name: string; duration_minutes: number } | null;
    const barber = b.barbers as { full_name: string } | null;
    return {
      id: b.id,
      type: "booking" as const,
      status: b.status,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      start_time: fmtTime(b.starts_at as string),
      end_time: fmtTime(b.ends_at as string),
      price: b.price_at_booking,
      client_name: client?.full_name ?? null,
      client_phone: client?.phone ?? null,
      service_name: service?.name ?? null,
      service_duration: service?.duration_minutes ?? null,
      barber_id: b.barber_id,
      barber_name: barber?.full_name ?? null,
    };
  });

  return res.json({
    date,
    scope: targetBarberId ? "single" : "shop",
    target_barber_id: targetBarberId,
    bookings: bookingRows,
  });
}
