import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body: any = {};
  try {
    body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body payload" });
  }

  const { email, password } = (body || {}) as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email va parol kiritilishi shart" });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Check if a main barber (admin) already exists in the system
    const { data: existingAdmin } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (existingAdmin) {
      return res.status(403).json({
        error: "Sartaroshxona allaqachon ro'yxatdan o'tgan. Tizimga kirish uchun asosiy sartaroshingiz (admin) yaratib bergan hisobdan foydalaning.",
      });
    }

    // Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u: any) => (u.email ?? "").toLowerCase() === cleanEmail
    );

    if (existing) {
      // Update password & auto-confirm email so sign-in works cleanly
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: password,
        email_confirm: true,
      });
      return res.status(200).json({ success: true, isExisting: true });
    }

    // Create user with email_confirm: true to bypass email rate limits & verification blocks
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
    });

    if (createErr) {
      return res.status(400).json({ error: createErr.message });
    }

    return res.status(200).json({ success: true, user: newUser.user });
  } catch (error: any) {
    console.error("Register endpoint error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
