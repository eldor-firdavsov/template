import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin";

// Working hours + time off for the signed-in barber.
// (Even admin edits their own schedule here. Shop admin is the locations row,
// not other barbers' schedules.)
//
// GET  /api/barber/schedule?access_token=...
//   -> { working_hours: [...], time_off: [...] }
//
// PUT  /api/barber/schedule
//   body: { access_token, working_hours: [...], time_off: [...] }
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
  if (!caller || !caller.is_active) {
    return res.status(403).json({ error: "Not an active barber" });
  }

  if (req.method === "GET") {
    const [wh, to] = await Promise.all([
      supabaseAdmin
        .from("working_hours")
        .select("id, weekday, start_time, end_time")
        .eq("barber_id", caller.id)
        .order("weekday", { ascending: true }),
      supabaseAdmin
        .from("time_off")
        .select("id, date, start_time, end_time, reason")
        .eq("barber_id", caller.id)
        .order("date", { ascending: true }),
    ]);
    if (wh.error) return res.status(500).json({ error: "Failed to load working hours" });
    if (to.error) return res.status(500).json({ error: "Failed to load time off" });
    return res.json({
      working_hours: wh.data ?? [],
      time_off: to.data ?? [],
    });
  }

  // PUT — replace
  const body = req.body as {
    working_hours?: Array<{
      weekday: number;
      start_time?: string;
      end_time?: string;
      closed?: boolean;
    }>;
    time_off?: Array<{
      id?: string;
      date: string;
      start_time?: string | null;
      end_time?: string | null;
      reason?: string | null;
    }>;
  };

  // 1. Replace working hours: delete then insert non-closed rows.
  const { error: delWhErr } = await supabaseAdmin
    .from("working_hours")
    .delete()
    .eq("barber_id", caller.id);
  if (delWhErr) {
    return res.status(500).json({ error: "Failed to clear working hours" });
  }

  const whInsert = (body.working_hours ?? [])
    .filter((r) => !r.closed && r.start_time && r.end_time)
    .map((r) => ({
      barber_id: caller.id,
      weekday: r.weekday,
      start_time: r.start_time,
      end_time: r.end_time,
    }));

  if (whInsert.length > 0) {
    const { error: insWhErr } = await supabaseAdmin.from("working_hours").insert(whInsert);
    if (insWhErr) {
      return res.status(500).json({ error: "Failed to save working hours" });
    }
  }

  // 2. Replace time_off: delete then insert.
  const { error: delToErr } = await supabaseAdmin
    .from("time_off")
    .delete()
    .eq("barber_id", caller.id);
  if (delToErr) {
    return res.status(500).json({ error: "Failed to clear time off" });
  }

  const toInsert = (body.time_off ?? []).map((r) => ({
    barber_id: caller.id,
    date: r.date,
    start_time: r.start_time ?? null,
    end_time: r.end_time ?? null,
    reason: r.reason ?? null,
  }));

  if (toInsert.length > 0) {
    const { error: insToErr } = await supabaseAdmin.from("time_off").insert(toInsert);
    if (insToErr) {
      return res.status(500).json({ error: "Failed to save time off" });
    }
  }

  return res.json({ success: true });
}
