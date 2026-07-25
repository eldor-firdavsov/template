import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";

// List clients with summary stats, plus per-client history.
//
// GET /api/barber/clients?access_token=...&scope=mine|shop
//   -> { clients: [{ id, full_name, phone, visit_count, last_visit_at }] }
//
// GET /api/barber/clients?access_token=...&id=<client_id>&scope=mine|shop
//   -> { client, history: [{ id, starts_at, ends_at, status, price_at_booking, service_name, barber_name }] }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { access_token, scope, id: clientId } = req.query as {
    access_token?: string;
    scope?: string;
    id?: string;
  };

  if (!access_token) {
    return res.status(400).json({ error: "Missing access_token" });
  }

  // 1. Authenticate caller.
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
  const useScope = scope ?? "mine";
  if (useScope === "shop" && !isAdmin) {
    return res.status(403).json({ error: "Only admins can view shop-wide data" });
  }

  // Per-client history drilldown
  if (clientId) {
    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, first_seen_at")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr) {
      return res.status(500).json({ error: "Failed to load client" });
    }
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    let historyQuery = supabaseAdmin
      .from("bookings")
      .select(
        "id, starts_at, ends_at, status, price_at_booking, barber_id, services(name), barbers!bookings_barber_id_fkey(full_name)",
      )
      .eq("client_id", clientId)
      .order("starts_at", { ascending: false })
      .limit(200);

    if (useScope === "mine") {
      historyQuery = historyQuery.eq("barber_id", caller.id);
    }

    const { data: history, error: histErr } = await historyQuery;
    if (histErr) {
      return res.status(500).json({ error: "Failed to load history" });
    }

    const historyFormatted = (history ?? []).map((h: Record<string, unknown>) => {
      const service = h.services as { name: string } | null;
      const barber = h.barbers as { full_name: string } | null;
      return {
        id: h.id,
        starts_at: h.starts_at,
        ends_at: h.ends_at,
        status: h.status,
        price_at_booking: h.price_at_booking,
        service_name: service?.name ?? null,
        barber_name: barber?.full_name ?? null,
      };
    });

    return res.json({ client, history: historyFormatted });
  }

  // List with summary stats
  // Get all bookings scoped, then aggregate per-client in JS. For higher scale
  // this would be a SQL view, but the per-shop volume here is small.
  let bookingsQuery = supabaseAdmin
    .from("bookings")
    .select("id, client_id, starts_at, status")
    .order("starts_at", { ascending: false })
    .limit(2000);

  if (useScope === "mine") {
    bookingsQuery = bookingsQuery.eq("barber_id", caller.id);
  }

  const { data: bookings, error: bookingsErr } = await bookingsQuery;
  if (bookingsErr) {
    return res.status(500).json({ error: "Failed to load bookings" });
  }

  const stats = new Map<string, { visit_count: number; last_visit_at: string }>();
  for (const b of bookings ?? []) {
    const cid = b.client_id as string;
    if (!cid) continue;
    const cur = stats.get(cid) ?? { visit_count: 0, last_visit_at: "" };
    cur.visit_count += 1;
    if (!cur.last_visit_at || (b.starts_at as string) > cur.last_visit_at) {
      cur.last_visit_at = b.starts_at as string;
    }
    stats.set(cid, cur);
  }

  if (stats.size === 0) {
    return res.json({ clients: [] });
  }

  const { data: clients, error: clientsErr } = await supabaseAdmin
    .from("clients")
    .select("id, full_name, phone, first_seen_at")
    .in("id", Array.from(stats.keys()))
    .order("full_name", { ascending: true });
  if (clientsErr) {
    return res.status(500).json({ error: "Failed to load clients" });
  }

  const result = (clients ?? []).map((c) => {
    const s = stats.get(c.id) ?? { visit_count: 0, last_visit_at: null };
    return {
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      first_seen_at: c.first_seen_at,
      visit_count: s.visit_count,
      last_visit_at: s.last_visit_at,
    };
  });

  // Sort by last_visit_at desc
  result.sort((a, b) => {
    if (!a.last_visit_at) return 1;
    if (!b.last_visit_at) return -1;
    return b.last_visit_at.localeCompare(a.last_visit_at);
  });

  return res.json({ clients: result });
}
