import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";

// Mark a past confirmed booking as "completed" or "no_show".
// Feeds the stats page's no-show rate and completed-revenue numbers.
//
// POST /api/barber/booking-status
// Body: { booking_id, status: "completed" | "no_show", access_token }
//
// The caller must be the barber that owns the booking (or an admin).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { booking_id, status, access_token } = req.body as {
    booking_id?: string;
    status?: "completed" | "no_show";
    access_token?: string;
  };

  if (!booking_id || !access_token) {
    return res.status(400).json({ error: "Missing booking_id or access_token" });
  }
  if (status !== "completed" && status !== "no_show") {
    return res.status(400).json({ error: "status must be 'completed' or 'no_show'" });
  }

  // 1. Authenticate the caller.
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(access_token);
  if (userErr || !userRes?.user) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const callerEmail = (userRes.user.email ?? "").toLowerCase();
  if (!callerEmail) {
    return res.status(403).json({ error: "No email on session" });
  }

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

  // 2. Look up the booking.
  const { data: booking, error: bookErr } = await supabaseAdmin
    .from("bookings")
    .select("id, barber_id, status, starts_at, ends_at")
    .eq("id", booking_id)
    .single();
  if (bookErr || !booking) {
    return res.status(404).json({ error: "Booking not found" });
  }

  // 3. Authorization: caller must own the booking or be admin.
  if (caller.role !== "admin" && booking.barber_id !== caller.id) {
    return res.status(403).json({ error: "Not your booking" });
  }

  // 4. Only confirmed bookings can be marked complete/no_show.
  if (booking.status !== "confirmed") {
    return res
      .status(400)
      .json({ error: `Booking is not confirmed (current: ${booking.status})` });
  }

  // 5. Update status.
  const { error: updateErr } = await supabaseAdmin
    .from("bookings")
    .update({ status })
    .eq("id", booking_id);

  if (updateErr) {
    return res.status(500).json({ error: "Failed to update booking" });
  }

  return res.json({ success: true, status });
}
