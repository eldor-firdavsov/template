import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: "Phone and code are required" });
  }

  // Normalize phone number
  const normalizedPhone = phone.replace(/\D/g, "");

  try {
    // Find valid, unconsumed verification code
    const { data: verificationData, error: verificationError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("code", code)
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (verificationError || !verificationData) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    // Mark code as consumed
    await supabase
      .from("verification_codes")
      .update({ consumed: true })
      .eq("id", verificationData.id);

    // Check if barber exists
    const { data: existingBarber } = await supabase
      .from("barbers")
      .select("*")
      .eq("phone", normalizedPhone)
      .single();

    if (existingBarber) {
      // Returning barber - create session
      // For now, return barber data (in production, create JWT session)
      return res.json({
        success: true,
        isNewUser: false,
        barber: existingBarber,
        requiresOnboarding: !existingBarber.onboarding_completed,
      });
    } else {
      // New barber - create draft record
      const { data: newBarber, error: createError } = await supabase
        .from("barbers")
        .insert({
          phone: normalizedPhone,
          full_name: "", // Will be filled in onboarding
          role: "barber",
          is_active: true,
          onboarding_completed: false,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating barber:", createError);
        return res.status(500).json({ error: "Failed to create barber account" });
      }

      return res.json({
        success: true,
        isNewUser: true,
        barber: newBarber,
        requiresOnboarding: true,
      });
    }
  } catch (error) {
    console.error("Verify code error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
