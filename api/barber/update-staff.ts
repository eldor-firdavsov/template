import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, parseBody } from "../_lib/supabase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body: any = {};
    try {
      body = parseBody(req.body);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body payload" });
    }

    const {
      access_token,
      staffId,
      fullname,
      phone,
      bio,
      photo_url,
      is_active,
      services,
      workingHours,
    } = body as {
      access_token?: string;
      staffId?: string;
      fullname?: string;
      phone?: string;
      bio?: string;
      photo_url?: string;
      is_active?: boolean;
      services?: string[];
      workingHours?: Array<{ weekday: number; start_time: string; end_time: string }>;
    };

    if (!access_token || !staffId) {
      return res.status(400).json({ error: "Missing access_token or staffId" });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not initialized" });
    }
    // 1. Verify requester is admin
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(access_token);
    if (userErr || !userRes?.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const requesterEmail = (userRes.user.email ?? "").toLowerCase();
    const { data: requesterBarber, error: reqBarberErr } = await supabaseAdmin
      .from("barbers")
      .select("role, location_id")
      .ilike("email", requesterEmail)
      .maybeSingle();

    if (reqBarberErr || !requesterBarber || requesterBarber.role !== "admin") {
      return res.status(403).json({ error: "Only admins are authorized to manage team members" });
    }

    // 2. Fetch the target staff barber to verify location match
    const { data: targetBarber, error: fetchErr } = await supabaseAdmin
      .from("barbers")
      .select("id, location_id")
      .eq("id", staffId)
      .maybeSingle();

    if (fetchErr || !targetBarber) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    if (targetBarber.location_id !== requesterBarber.location_id) {
      return res.status(403).json({ error: "Unauthorized cross-location updates" });
    }

    // 3. Perform profile update
    const updateData: Record<string, any> = {};
    if (fullname !== undefined) updateData.full_name = fullname.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (bio !== undefined) updateData.bio = bio?.trim() || null;
    if (photo_url !== undefined) updateData.photo_url = photo_url?.trim() || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from("barbers")
        .update(updateData)
        .eq("id", staffId);

      if (updateErr) {
        console.error("Failed to update staff profile:", updateErr);
        return res.status(500).json({ error: "Failed to update profile record" });
      }
    }

    // 4. Update Services Mapping (delete old and insert new)
    if (services !== undefined && Array.isArray(services)) {
      // Clear current mappings
      await supabaseAdmin.from("barber_services").delete().eq("barber_id", staffId);

      if (services.length > 0) {
        const mappings = services.map((serviceId) => ({
          barber_id: staffId,
          service_id: serviceId,
        }));
        const { error: mapErr } = await supabaseAdmin.from("barber_services").insert(mappings);
        if (mapErr) {
          console.error("Failed to insert updated services:", mapErr);
        }
      }
    }

    // 5. Update Working Hours (delete old and insert new)
    if (workingHours !== undefined && Array.isArray(workingHours)) {
      // Clear current hours
      await supabaseAdmin.from("working_hours").delete().eq("barber_id", staffId);

      if (workingHours.length > 0) {
        const schedule = workingHours.map((wh) => ({
          barber_id: staffId,
          weekday: wh.weekday,
          start_time: wh.start_time,
          end_time: wh.end_time,
        }));
        const { error: whErr } = await supabaseAdmin.from("working_hours").insert(schedule);
        if (whErr) {
          console.error("Failed to insert updated working hours:", whErr);
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Update staff server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
