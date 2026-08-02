import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Safely access req.body inside try-catch to prevent @vercel/node getter from crashing the process on invalid JSON
  let body: any = {};
  try {
    body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body payload" });
  }

  if (!body || typeof body !== "object") {
    body = {};
  }

  const {
    access_token,
    fullname,
    phone,
    shopName,
    address,
    shopPhone,
    latitude,
    longitude,
    startTime,
    endTime,
    services,
  } = body as {
    access_token?: string;
    fullname?: string;
    phone?: string;
    shopName?: string;
    address?: string;
    shopPhone?: string;
    latitude?: number;
    longitude?: number;
    startTime?: string;
    endTime?: string;
    services?: Array<{ name: string; category: string; duration: string | number; price: string | number }>;
  };

  if (!access_token) {
    return res.status(400).json({ error: "Missing access_token" });
  }
  if (!fullname || !phone || !shopName || !address) {
    return res.status(400).json({ error: "Missing required fields for owner onboarding" });
  }

  try {
    // 1. Verify access_token to resolve user credentials
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(access_token);
    if (userErr || !userRes?.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const email = (userRes.user.email ?? "").toLowerCase();
    const authUserId = userRes.user.id;

    // Check if profile exists already (safely query by auth_user_id first, then email)
    let existingBarber = null;
    if (authUserId) {
      const { data } = await supabaseAdmin
        .from("barbers")
        .select("id, auth_user_id, email")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      existingBarber = data;
    }
    if (!existingBarber && email) {
      const { data } = await supabaseAdmin
        .from("barbers")
        .select("id, auth_user_id, email")
        .ilike("email", email)
        .maybeSingle();
      existingBarber = data;
    }

    if (existingBarber && existingBarber.auth_user_id && existingBarber.auth_user_id !== authUserId) {
      return res.status(400).json({ error: "A barber profile is already associated with this account" });
    }

    // 2. Resolve & Update or Create the Single Shop Location
    let resolvedLocationId: string;
    const { data: existingLoc } = await supabaseAdmin
      .from("locations")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existingLoc) {
      // Update existing single locations row
      const { data: updatedLoc, error: locErr } = await supabaseAdmin
        .from("locations")
        .update({
          name: shopName.trim(),
          address: address.trim(),
          phone: shopPhone?.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          is_active: true,
        })
        .eq("id", existingLoc.id)
        .select("id")
        .single();

      if (locErr) {
        console.error("Failed to update location details:", locErr);
        return res.status(500).json({ error: `Failed to update shop location: ${locErr.message}` });
      }
      resolvedLocationId = updatedLoc.id;
    } else {
      // Create a brand new locations row
      const { data: newLoc, error: locErr } = await supabaseAdmin
        .from("locations")
        .insert({
          name: shopName.trim(),
          address: address.trim(),
          phone: shopPhone?.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          is_active: true,
        })
        .select("id")
        .single();

      if (locErr) {
        console.error("Failed to create location details:", locErr);
        return res.status(500).json({ error: `Failed to create shop location: ${locErr.message}` });
      }
      resolvedLocationId = newLoc.id;
    }

    // 3. Insert or update the Owner Barber row as 'admin'
    let barberId: string;
    let barberData: any;

    if (existingBarber) {
      const { data: updatedBarber, error: barberErr } = await supabaseAdmin
        .from("barbers")
        .update({
          full_name: fullname.trim(),
          phone: phone.trim(),
          email: email,
          auth_user_id: authUserId,
          role: "admin",
          location_id: resolvedLocationId,
          is_active: true,
        })
        .eq("id", existingBarber.id)
        .select()
        .single();

      if (barberErr) {
        console.error("Failed to link owner profile:", barberErr);
        return res.status(500).json({ error: `Failed to update profile record: ${barberErr.message}` });
      }
      barberData = updatedBarber;
      barberId = updatedBarber.id;
    } else {
      const { data: newBarber, error: barberErr } = await supabaseAdmin
        .from("barbers")
        .insert({
          full_name: fullname.trim(),
          phone: phone.trim(),
          email,
          auth_user_id: authUserId,
          role: "admin",
          location_id: resolvedLocationId,
          is_active: true,
        })
        .select()
        .single();

      if (barberErr) {
        console.error("Failed to create owner profile:", barberErr);
        return res.status(500).json({ error: `Failed to create owner record: ${barberErr.message}` });
      }
      barberData = newBarber;
      barberId = newBarber.id;
    }

    // 4. Handle Services Creation (Clear and create anew for fresh onboarding configuration)
    if (services && Array.isArray(services) && services.length > 0) {
      // Clear existing service mappings first
      await supabaseAdmin.from("barber_services").delete().eq("barber_id", barberId);

      for (const svc of services) {
        if (!svc.name.trim() || !svc.price) continue;

        // Create the new service
        const { data: newSvc, error: createSvcErr } = await supabaseAdmin
          .from("services")
          .insert({
            name: svc.name.trim(),
            category: svc.category?.trim() || "Boshqa",
            duration_minutes: Number(svc.duration) || 30,
            price: Number(svc.price) || 0,
            is_active: true,
          })
          .select("id")
          .single();

        if (createSvcErr) {
          console.error("Failed to create service:", svc.name, createSvcErr);
          continue;
        }

        // Map service to this barber
        const { error: bsErr } = await supabaseAdmin
          .from("barber_services")
          .insert({
            barber_id: barberId,
            service_id: newSvc.id,
          });

        if (bsErr) {
          console.error("Failed to map service to barber:", bsErr);
        }
      }
    }

    // 5. Handle Working Hours Mapping
    await supabaseAdmin.from("working_hours").delete().eq("barber_id", barberId);

    const start = startTime || "09:00:00";
    const end = endTime || "20:00:00";
    
    const formatTime = (t: string) => {
      if (t.split(":").length === 2) return `${t}:00`;
      return t;
    };

    const workingHours = [];
    for (let wd = 1; wd <= 6; wd++) {
      workingHours.push({
        barber_id: barberId,
        weekday: wd,
        start_time: formatTime(start),
        end_time: formatTime(end),
      });
    }

    const { error: whErr } = await supabaseAdmin.from("working_hours").insert(workingHours);
    if (whErr) {
      console.error("Failed to insert default working hours:", whErr);
    }

    return res.status(200).json({
      success: true,
      barber: barberData,
    });
  } catch (error: any) {
    console.error("Onboarding server error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
