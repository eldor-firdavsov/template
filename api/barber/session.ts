import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Resolve the current Supabase Auth session and the matching barbers row.
//
// POST /api/barber/session
// Body: { access_token }
//
// Returns: { barber } or { barber: null } if no matching row exists.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { access_token } = req.body as { access_token?: string };
  if (!access_token) {
    return res.status(400).json({ error: "Missing access_token" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Server misconfigured (Supabase env)" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Verify the JWT by getting the user from the access token.
  const { data: userRes, error: userErr } = await admin.auth.getUser(access_token);
  if (userErr || !userRes?.user) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const email = (userRes.user.email ?? "").toLowerCase();
  if (!email) {
    return res.json({ barber: null });
  }

  // 2. Look up the barbers row by email.
  const { data: barber, error: barberErr } = await admin
    .from("barbers")
    .select("id, email, full_name, role, is_active, photo_url, bio, sort_order, location_id")
    .ilike("email", email)
    .maybeSingle();

  if (barberErr) {
    return res.status(500).json({ error: "Failed to look up barber" });
  }

  return res.json({ barber: barber ?? null });
}
