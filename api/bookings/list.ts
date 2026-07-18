import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { client_id } = req.query as { client_id?: string };
  if (!client_id) {
    return res.status(400).json({ error: "Missing client_id query param" });
  }

  // Fetch bookings with barber and service details
  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      id, barber_id, service_id, client_id, starts_at, ends_at,
      status, price_at_booking, created_at, cancelled_at, cancelled_by,
      barbers(full_name, photo_url),
      services(name, duration_minutes)
    `)
    .eq("client_id", client_id)
    .order("starts_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }

  const result = (bookings ?? []).map((b: Record<string, unknown>) => {
    const barber = b.barbers as { full_name: string; photo_url: string | null } | null;
    const service = b.services as { name: string; duration_minutes: number } | null;
    return {
      id: b.id,
      barber_id: b.barber_id,
      service_id: b.service_id,
      client_id: b.client_id,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      status: b.status,
      price_at_booking: b.price_at_booking,
      created_at: b.created_at,
      cancelled_at: b.cancelled_at,
      cancelled_by: b.cancelled_by,
      barber_name: barber?.full_name ?? null,
      barber_photo: barber?.photo_url ?? null,
      service_name: service?.name ?? null,
      service_duration: service?.duration_minutes ?? null,
    };
  });

  return res.json(result);
}
