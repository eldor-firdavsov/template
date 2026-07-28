import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, parseBody } from "../_lib/supabase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const {
    access_token,
    email,
    password,
    fullname,
    phone,
    bio,
    photo_url,
    services,
    workingHours,
  } = body as {
    access_token?: string;
    email?: string;
    password?: string;
    fullname?: string;
    phone?: string;
    bio?: string;
    photo_url?: string;
    services?: string[];
    workingHours?: Array<{ weekday: number; start_time: string; end_time: string }>;
  };

  if (!access_token) {
    return res.status(400).json({ error: "Missing access_token" });
  }
  if (!email || !password || !fullname || !phone) {
    return res.status(400).json({ error: "Missing required fields (email, password, fullname, phone)" });
  }

  try {
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

    // 2. Create the Auth User for staff
    const { data: authUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true,
    });

    if (createAuthErr || !authUser?.user) {
      console.error("Auth creation failed:", createAuthErr);
      return res.status(400).json({ error: createAuthErr?.message || "Failed to create authentication user" });
    }

    // 3. Create the Barber Profile row
    const { data: newBarber, error: barberErr } = await supabaseAdmin
      .from("barbers")
      .insert({
        email: email.trim().toLowerCase(),
        full_name: fullname.trim(),
        phone: phone.trim(),
        bio: bio?.trim() || null,
        photo_url: photo_url?.trim() || null,
        role: "barber",
        is_active: true,
        location_id: requesterBarber.location_id,
        auth_user_id: authUser.user.id,
      })
      .select()
      .single();

    if (barberErr) {
      console.error("Barber row insert failed:", barberErr);
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return res.status(500).json({ error: "Failed to create barber profile" });
    }

    // 4. Map Services
    if (services && Array.isArray(services) && services.length > 0) {
      const mappings = services.map((serviceId) => ({
        barber_id: newBarber.id,
        service_id: serviceId,
      }));
      const { error: mapErr } = await supabaseAdmin.from("barber_services").insert(mappings);
      if (mapErr) {
        console.error("Failed to map services:", mapErr);
      }
    }

    // 5. Map Working Hours Schedule
    if (workingHours && Array.isArray(workingHours) && workingHours.length > 0) {
      const schedule = workingHours.map((wh) => ({
        barber_id: newBarber.id,
        weekday: wh.weekday,
        start_time: wh.start_time,
        end_time: wh.end_time,
      }));
      const { error: whErr } = await supabaseAdmin.from("working_hours").insert(schedule);
      if (whErr) {
        console.error("Failed to insert working hours schedule:", whErr);
      }
    }

    return res.status(200).json({
      success: true,
      barber: newBarber,
    });
  } catch (error: any) {
    console.error("Create staff server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
