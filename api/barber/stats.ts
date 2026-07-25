import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin";

// Aggregated stats for the stats page.
//
// GET /api/barber/stats?access_token=...&from=YYYY-MM-DD&to=YYYY-MM-DD&scope=mine|shop[&barber_id=...]
//   -> {
//        summary: { bookings_count, completed_count, no_show_count, cancelled_count,
//                   completed_revenue, no_show_rate },
//        busiest: { by_hour: [{ hour, count }], by_day: [{ weekday, count }] },
//        services: [{ service_id, service_name, count, revenue }]
//      }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { access_token, from, to, scope, barber_id } = req.query as {
    access_token?: string;
    from?: string;
    to?: string;
    scope?: string;
    barber_id?: string;
  };

  if (!access_token) {
    return res.status(400).json({ error: "Missing access_token" });
  }
  if (!from || !to) {
    return res.status(400).json({ error: "Missing from/to dates" });
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

  // Per-barber breakdown: admin can request a specific barber_id (still must be active).
  let scopedBarberId: string | null = null;
  if (useScope === "mine") {
    scopedBarberId = caller.id;
  } else if (barber_id) {
    scopedBarberId = barber_id;
  }

  // 2. Fetch bookings in the range.
  let bookingsQuery = supabaseAdmin
    .from("bookings")
    .select("id, barber_id, service_id, starts_at, status, price_at_booking, services(name)")
    .gte("starts_at", `${from}T00:00:00Z`)
    .lte("starts_at", `${to}T23:59:59Z`);

  if (scopedBarberId) {
    bookingsQuery = bookingsQuery.eq("barber_id", scopedBarberId);
  }

  const { data: bookings, error: bookingsErr } = await bookingsQuery;
  if (bookingsErr) {
    return res.status(500).json({ error: "Failed to load bookings" });
  }

  // 3. Aggregate.
  let bookingsCount = 0;
  let completedCount = 0;
  let noShowCount = 0;
  let cancelledCount = 0;
  let completedRevenue = 0;
  const byHour = new Map<number, number>();
  const byWeekday = new Map<number, number>();
  const byService = new Map<string, { name: string; count: number; revenue: number }>();

  for (const b of bookings ?? []) {
    bookingsCount += 1;
    const status = b.status as string;
    const price = Number(b.price_at_booking ?? 0);
    if (status === "completed") {
      completedCount += 1;
      completedRevenue += price;
    } else if (status === "no_show") {
      noShowCount += 1;
    } else if (status === "cancelled") {
      cancelledCount += 1;
    }
    // Skip confirmed from completed metrics; but include in time-of-day
    // so the heatmap reflects demand.

    const dt = new Date(b.starts_at as string);
    const hour = dt.getUTCHours();
    const weekday = dt.getUTCDay();
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + 1);

    // Supabase typing for the joined `services(name)` select is an array of
    // { name: any }; the runtime value is an object, so go through unknown
    // to satisfy strict TS while keeping the read at runtime.
    const rawService = (b as { services: unknown }).services;
    const serviceName =
      Array.isArray(rawService) && rawService.length > 0 && typeof rawService[0] === "object" && rawService[0] !== null
        ? (rawService[0] as { name?: string }).name ?? "—"
        : (rawService as { name?: string } | null)?.name ?? "—";
    const serviceId = b.service_id as string;



    const cur = byService.get(serviceId) ?? {
      name: serviceName,
      count: 0,
      revenue: 0,
    };

    cur.count += 1;
    if (status === "completed") {
      cur.revenue += price;
    }
    byService.set(serviceId, cur);
  }

  const totalRelevant = completedCount + noShowCount;
  const noShowRate = totalRelevant > 0 ? noShowCount / totalRelevant : 0;

  const busiestByHour = Array.from(byHour.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count);
  const busiestByDay = Array.from(byWeekday.entries())
    .map(([weekday, count]) => ({ weekday, count }))
    .sort((a, b) => b.count - a.count);
  const servicesTop = Array.from(byService.entries())
    .map(([id, v]) => ({
      service_id: id,
      service_name: v.name,
      count: v.count,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.count - a.count);

  return res.json({
    summary: {
      bookings_count: bookingsCount,
      completed_count: completedCount,
      no_show_count: noShowCount,
      cancelled_count: cancelledCount,
      completed_revenue: completedRevenue,
      no_show_rate: noShowRate,
    },
    busiest: {
      by_hour: busiestByHour,
      by_day: busiestByDay,
    },
    services: servicesTop,
  });
}


