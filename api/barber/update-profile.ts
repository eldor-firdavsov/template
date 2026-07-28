import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, parseBody } from "../_lib/supabase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const { access_token, full_name, phone, bio, photo_url } = body as {
    access_token?: string;
    full_name?: string;
    phone?: string;
    bio?: string;
    photo_url?: string;
  };

  if (!access_token) {
    return res.status(400).json({ error: "Missing access_token" });
  }

  try {
    // 1. Verify access_token to resolve the user
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(access_token);
    if (userErr || !userRes?.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const email = (userRes.user.email ?? "").toLowerCase();

    // 2. Build the update payload
    const updateData: Record<string, any> = {};
    if (full_name !== undefined) updateData.full_name = full_name.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (photo_url !== undefined) updateData.photo_url = photo_url.trim();

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // 3. Update the barbers row by email
    const { data: barber, error: updateErr } = await supabaseAdmin
      .from("barbers")
      .update(updateData)
      .ilike("email", email)
      .select()
      .single();

    if (updateErr) {
      console.error("Failed to update barber profile:", updateErr);
      return res.status(500).json({ error: "Failed to update profile record" });
    }

    return res.status(200).json({
      success: true,
      barber,
    });
  } catch (error: any) {
    console.error("Profile update server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
