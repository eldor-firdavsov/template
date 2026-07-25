import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin";

// Admin-only: read and update the single locations row that represents the shop.
// (Single-shop template: there is exactly one active row, never inserted from
// here — that would be a multi-shop feature.)
//
// GET /api/barber/shop?access_token=...
//   -> { shop: { id, name, address, phone, photo_url, ... } | null }
//
// PUT /api/barber/shop
//   body: { access_token, name, address, phone, photo_url }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const access_token = (req.method === "GET" ? req.query.access_token : req.body.access_token) as
    | string
    | undefined;
  if (!access_token) {
    return res.status(400).json({ error: "Missing access_token" });
  }

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
  if (!caller || !caller.is_active || caller.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  if (req.method === "GET") {
    // Pick the first active location (single-shop template).
    const { data, error } = await supabaseAdmin
      .from("locations")
      .select("id, name, address, phone, photo_url, is_active, created_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: "Failed to load shop" });
    return res.json({ shop: data ?? null });
  }

  // PUT
  const body = req.body as {
    name?: string;
    address?: string;
    phone?: string | null;
    photo_url?: string | null;
  };
  if (!body.name || !body.address) {
    return res.status(400).json({ error: "name and address are required" });
  }

  // Get the existing row id, or fail clearly if seed never ran.
  const { data: existing, error: existErr } = await supabaseAdmin
    .from("locations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existErr) return res.status(500).json({ error: "Failed to look up shop" });
  if (!existing) {
    return res
      .status(404)
      .json({ error: "No shop row exists. Run the supabase/seed.sql seed first." });
  }

  const { data, error } = await supabaseAdmin
    .from("locations")
    .update({
      name: body.name,
      address: body.address,
      phone: body.phone ?? null,
      photo_url: body.photo_url ?? null,
    })
    .eq("id", existing.id)
    .select()
    .single();
  if (error || !data) {
    return res.status(500).json({ error: error?.message ?? "Failed to update shop" });
  }
  return res.json({ shop: data });
}
