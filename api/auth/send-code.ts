import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "testforeldorbot";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  // Normalize phone number
  const normalizedPhone = phone.replace(/\D/g, "");

  if (normalizedPhone.length < 10) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    // Check if barber already exists with this phone
    const { data: existingBarber } = await supabase
      .from("barbers")
      .select("id, telegram_chat_id, onboarding_completed")
      .eq("phone", normalizedPhone)
      .single();

    // Generate 6-digit code
    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store verification code
    const { data: verificationData, error: verificationError } = await supabase
      .from("verification_codes")
      .insert({
        phone: normalizedPhone,
        code: code, // In production, hash this
        code_hash: code, // TODO: Implement proper hashing
        expires_at: expiresAt.toISOString(),
        consumed: false,
      })
      .select("id")
      .single();

    if (verificationError) {
      console.error("Error creating verification code:", verificationError);
      return res.status(500).json({ error: "Failed to create verification code" });
    }

    // Check if barber has linked Telegram
    if (existingBarber?.telegram_chat_id) {
      // Send code via Telegram (would need edge function or direct API call)
      // For now, we'll return that they need to check Telegram
      return res.json({
        success: true,
        requiresTelegramLink: false,
        verificationId: verificationData.id,
        message: "Verification code sent to your Telegram",
      });
    } else {
      // New barber or not linked - provide deep link
      const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${verificationData.id}`;
      return res.json({
        success: true,
        requiresTelegramLink: true,
        verificationId: verificationData.id,
        telegramLink: deepLink,
        message: "Please open the Telegram link to receive your verification code",
      });
    }
  } catch (error) {
    console.error("Send code error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
