import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, parseBody } from "../_lib/supabase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const { booking_id, client_id } = body as { booking_id?: string; client_id?: string };
  if (!booking_id || !client_id) {
    return res.status(400).json({ error: "Missing booking_id or client_id" });
  }

  // Verify the booking belongs to this client and is cancellable
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, starts_at, status, client_id")
    .eq("id", booking_id)
    .single();

  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }

  if (booking.client_id !== client_id) {
    return res.status(403).json({ error: "Not your booking" });
  }

  // Allow cancellation of pending (no time restriction) or confirmed (1hr window) bookings
  if (booking.status === "confirmed") {
    const startsAt = new Date(booking.starts_at);
    const now = new Date();
    const oneHourMs = 60 * 60 * 1000;
    if (startsAt.getTime() - now.getTime() <= oneHourMs) {
      return res.status(400).json({ error: "Cancellation window has passed (must be 1+ hour before appointment)" });
    }
  } else if (booking.status === "pending") {
    // Pending bookings can be cancelled at any time by the client
  } else {
    return res.status(400).json({ error: "Booking is not in a cancellable state" });
  }

  // Cancel the booking
  const { error: cancelErr } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_by: "client",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", booking_id);

  if (cancelErr) {
    return res.status(500).json({ error: "Failed to cancel booking" });
  }

  return res.json({ success: true });
}
