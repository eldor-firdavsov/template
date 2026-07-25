import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { access_token, staffId, password } = req.body as {
    access_token?: string;
    staffId?: string;
    password?: string;
  };

  if (!access_token || !staffId || !password) {
    return res.status(400).json({ error: "Missing access_token, staffId, or password" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
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
      return res.status(403).json({ error: "Only admins are authorized to reset passwords" });
    }

    // 2. Fetch target barber details (including auth_user_id)
    const { data: targetBarber, error: fetchErr } = await supabaseAdmin
      .from("barbers")
      .select("auth_user_id, location_id")
      .eq("id", staffId)
      .maybeSingle();

    if (fetchErr || !targetBarber) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    if (targetBarber.location_id !== requesterBarber.location_id) {
      return res.status(403).json({ error: "Unauthorized cross-location password reset" });
    }
    if (!targetBarber.auth_user_id) {
      return res.status(400).json({ error: "This staff member does not have an active login account" });
    }

    // 3. Update auth password
    const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetBarber.auth_user_id,
      { password: password }
    );

    if (resetErr) {
      console.error("Password reset failed:", resetErr);
      return res.status(500).json({ error: resetErr.message || "Failed to update staff member password" });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Reset staff password server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
