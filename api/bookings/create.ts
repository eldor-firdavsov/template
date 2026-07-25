import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { service_id, barber_id, starts_at, client_id } = req.body as {
    service_id?: string;
    barber_id?: string;
    starts_at?: string;
    client_id?: string;
  };

  if (!service_id || !barber_id || !starts_at || !client_id) {
    return res.status(400).json({ error: "Missing required fields: service_id, barber_id, starts_at, client_id" });
  }

  // Find client
  const { data: existingClient } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", client_id)
    .single();

  if (!existingClient) {
    return res.status(400).json({ error: "Client profile not found. Please register first." });
  }

  // Get service details for price snapshot and duration
  const { data: service } = await supabaseAdmin
    .from("services")
    .select("duration_minutes, price")
    .eq("id", service_id)
    .single();

  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }

  // Find all active barbers offering this service
  const { data: bsData } = await supabaseAdmin
    .from("barber_services")
    .select("barber_id, custom_duration_minutes")
    .eq("service_id", service_id);

  if (!bsData || bsData.length === 0) {
    return res.status(404).json({ error: "No barbers offering this service" });
  }

  const barberIds = bsData.map((bs) => bs.barber_id);

  const { data: activeBarbers, error: barbersErr } = await supabaseAdmin
    .from("barbers")
    .select("*")
    .in("id", barberIds)
    .eq("is_active", true);

  if (barbersErr || !activeBarbers || activeBarbers.length === 0) {
    return res.status(404).json({ error: "No active barbers found" });
  }

  let candidates = activeBarbers;
  if (barber_id !== "any") {
    candidates = activeBarbers.filter((b) => b.id === barber_id);
    if (candidates.length === 0) {
      return res.status(400).json({ error: "Barber is not available" });
    }
  }

  const startDt = new Date(starts_at);
  const dateStr = startDt.toISOString().substring(0, 10);
  const startWeekday = startDt.getUTCDay();

  // Fetch working hours, time off, and confirmed bookings
  const [whResult, toResult, bookingResult] = await Promise.all([
    supabaseAdmin
      .from("working_hours")
      .select("barber_id, weekday, start_time, end_time")
      .in("barber_id", candidates.map((c) => c.id))
      .eq("weekday", startWeekday),
    supabaseAdmin
      .from("time_off")
      .select("barber_id, date, start_time, end_time")
      .in("barber_id", candidates.map((c) => c.id))
      .eq("date", dateStr),
    supabaseAdmin
      .from("bookings")
      .select("barber_id, starts_at, ends_at, status")
      .in("barber_id", candidates.map((c) => c.id))
      .in("status", ["confirmed", "pending"])
      .gte("starts_at", `${dateStr}T00:00:00Z`)
      .lte("starts_at", `${dateStr}T23:59:59Z`),
  ]);

  interface AvailableCandidate {
    barber: typeof activeBarbers[0];
    duration: number;
    count: number;
  }

  const availableCandidates: AvailableCandidate[] = [];

  for (const c of candidates) {
    const match = bsData.find((bs) => bs.barber_id === c.id);
    const duration = match?.custom_duration_minutes ?? service.duration_minutes;
    const endDt = new Date(startDt.getTime() + duration * 60 * 1000);

    const startHour = String(startDt.getUTCHours()).padStart(2, "0");
    const startMin = String(startDt.getUTCMinutes()).padStart(2, "0");
    const startTimeStr = `${startHour}:${startMin}:00`;

    const endHour = String(endDt.getUTCHours()).padStart(2, "0");
    const endMin = String(endDt.getUTCMinutes()).padStart(2, "0");
    const endTimeStr = `${endHour}:${endMin}:00`;

    // 1. Check working hours
    const whs = (whResult.data ?? []).filter((w) => w.barber_id === c.id);
    const effectiveWhs =
      whs.length > 0
        ? whs
        : startWeekday >= 1 && startWeekday <= 6
        ? [{ barber_id: c.id, weekday: startWeekday, start_time: "09:00:00", end_time: "20:00:00" }]
        : [];
    const isWorking = effectiveWhs.some((w) => w.start_time <= startTimeStr && w.end_time >= endTimeStr);
    if (!isWorking) continue;

    // 2. Check time off
    const tos = (toResult.data ?? []).filter((t) => t.barber_id === c.id);
    const isOff = tos.some((t) => !t.start_time && !t.end_time || (t.start_time! < endTimeStr && t.end_time! > startTimeStr));
    if (isOff) continue;

    // 3. Check booking conflicts (confirmed only)
    const barberBookings = (bookingResult.data ?? []).filter((b) => b.barber_id === c.id);
    const hasConflict = barberBookings.some((b) => new Date(b.starts_at) < endDt && new Date(b.ends_at) > startDt);
    if (hasConflict) continue;

    // 4. Count daily bookings
    const dailyCount = barberBookings.length;

    availableCandidates.push({
      barber: c,
      duration,
      count: dailyCount,
    });
  }

  if (availableCandidates.length === 0) {
    return res.status(409).json({ error: "This time slot is no longer available" });
  }

  // Pick the candidate with fewest bookings (tie break on sort_order)
  availableCandidates.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    return (a.barber.sort_order ?? 0) - (b.barber.sort_order ?? 0);
  });

  const selectedCandidate = availableCandidates[0]!;
  const assignedBarber = selectedCandidate.barber;
  const assignedDuration = selectedCandidate.duration;
  const endDt = new Date(startDt.getTime() + assignedDuration * 60 * 1000);

  // Create the booking as PENDING
  const { data: booking, error: bookingErr } = await supabaseAdmin
    .from("bookings")
    .insert({
      barber_id: assignedBarber.id,
      service_id,
      client_id: existingClient.id,
      starts_at: startDt.toISOString(),
      ends_at: endDt.toISOString(),
      status: "pending",
      price_at_booking: service.price,
    })
    .select("id")
    .single();

  if (bookingErr || !booking) {
    console.error("Booking creation failed:", bookingErr);
    return res.status(500).json({ error: "Failed to create booking" });
  }

  return res.json({
    booking_id: booking.id,
    status: "pending",
    barber: {
      id: assignedBarber.id,
      full_name: assignedBarber.full_name,
      photo_url: assignedBarber.photo_url,
      role: assignedBarber.role,
      is_active: assignedBarber.is_active,
      bio: assignedBarber.bio,
      sort_order: assignedBarber.sort_order,
    },
  });
}
