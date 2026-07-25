import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";

// Admin-only: manage services and the barber_services matrix.
// This is a single-shop template, so there is one locations row and
// "all active barbers" is the relevant pool for assignments.
//
// GET  /api/barber/services-admin?access_token=...
//   -> { services: [...], barbers: [...], assignments: [{ barber_id, service_id }] }
//
// POST /api/barber/services-admin
//   body: { access_token, action: "create_service", ... }
//        | { action: "update_service", id, ... }
//        | { action: "toggle_assignment", barber_id, service_id, assigned }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
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
    const [servicesRes, barbersRes, assignmentsRes] = await Promise.all([
      supabaseAdmin
        .from("services")
        .select("id, name, duration_minutes, price, category, is_active, sort_order")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("barbers")
        .select("id, full_name, is_active, role")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabaseAdmin.from("barber_services").select("barber_id, service_id"),
    ]);

    if (servicesRes.error) return res.status(500).json({ error: "Failed to load services" });
    if (barbersRes.error) return res.status(500).json({ error: "Failed to load barbers" });
    if (assignmentsRes.error)
      return res.status(500).json({ error: "Failed to load assignments" });

    return res.json({
      services: servicesRes.data ?? [],
      barbers: barbersRes.data ?? [],
      assignments: assignmentsRes.data ?? [],
    });
  }

  // POST actions
  const body = req.body as {
    action?: string;
    id?: string;
    name?: string;
    category?: string | null;
    duration_minutes?: number;
    price?: number;
    is_active?: boolean;
    sort_order?: number;
    barber_id?: string;
    service_id?: string;
    assigned?: boolean;
  };

  switch (body.action) {
    case "create_service": {
      if (!body.name || !body.duration_minutes || body.price === undefined) {
        return res
          .status(400)
          .json({ error: "name, duration_minutes, price are required" });
      }
      const { data, error } = await supabaseAdmin
        .from("services")
        .insert({
          name: body.name,
          category: body.category ?? null,
          duration_minutes: body.duration_minutes,
          price: body.price,
          is_active: body.is_active ?? true,
          sort_order: body.sort_order ?? 0,
        })
        .select()
        .single();
      if (error || !data) {
        return res.status(500).json({ error: error?.message ?? "Failed to create service" });
      }
      return res.status(201).json({ service: data });
    }
    case "update_service": {
      if (!body.id) return res.status(400).json({ error: "id is required" });
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.category !== undefined) updates.category = body.category;
      if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes;
      if (body.price !== undefined) updates.price = body.price;
      if (body.is_active !== undefined) updates.is_active = body.is_active;
      if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

      const { data, error } = await supabaseAdmin
        .from("services")
        .update(updates)
        .eq("id", body.id)
        .select()
        .single();
      if (error || !data) {
        return res.status(500).json({ error: error?.message ?? "Failed to update service" });
      }
      return res.json({ service: data });
    }
    case "toggle_assignment": {
      if (!body.barber_id || !body.service_id) {
        return res.status(400).json({ error: "barber_id and service_id are required" });
      }
      if (body.assigned) {
        const { error } = await supabaseAdmin
          .from("barber_services")
          .upsert(
            { barber_id: body.barber_id, service_id: body.service_id, custom_duration_minutes: null },
            { onConflict: "barber_id,service_id" },
          );
        if (error) {
          return res.status(500).json({ error: error.message ?? "Failed to assign" });
        }
      } else {
        const { error } = await supabaseAdmin
          .from("barber_services")
          .delete()
          .eq("barber_id", body.barber_id)
          .eq("service_id", body.service_id);
        if (error) {
          return res.status(500).json({ error: error.message ?? "Failed to unassign" });
        }
      }
      return res.json({ success: true });
    }
    default:
      return res.status(400).json({ error: "Unknown action" });
  }
}
