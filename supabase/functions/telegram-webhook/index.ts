import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
}

interface TelegramMessage {
  chat_id: number;
  text: string;
  parse_mode?: string;
}

async function sendTelegramMessage(message: TelegramMessage): Promise<void> {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error:", error);
    throw new Error(`Failed to send Telegram message: ${error}`);
  }
}

async function getVerificationCode(phone: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("verification_codes")
    .select("code_hash, id")
    .eq("phone", phone)
    .eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  // In production, you'd decrypt/hash compare. For now, return the actual code
  // The code should be stored as a hash, but for MVP we'll store it plain
  // TODO: Implement proper hashing with bcrypt
  const { data: codeData } = await supabase
    .from("verification_codes")
    .select("code")
    .eq("id", data.id)
    .single();

  return codeData?.code || null;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const update: TelegramUpdate = await req.json();

    if (!update.message?.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;
    const userId = update.message.from.id;

    console.log(`Received message from chat ${chatId}: ${text}`);

    // Handle /start command with verification token
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const verificationId = parts[1];

      if (!verificationId) {
        await sendTelegramMessage({
          chat_id: chatId,
          text: "Welcome to BarberUp verification! Please use the link from the registration page to receive your verification code.",
        });
        return new Response("OK", { status: 200 });
      }

      // Look up verification code by ID
      const { data: verificationData, error: verificationError } = await supabase
        .from("verification_codes")
        .select("phone, code")
        .eq("id", verificationId)
        .eq("consumed", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (verificationError || !verificationData) {
        await sendTelegramMessage({
          chat_id: chatId,
          text: "Invalid or expired verification link. Please request a new code from the registration page.",
        });
        return new Response("OK", { status: 200 });
      }

      const phone = verificationData.phone;
      const code = verificationData.code;

      // Update or create barber record with telegram_chat_id
      const { data: barberData, error: barberError } = await supabase
        .from("barbers")
        .upsert(
          {
            phone,
            telegram_chat_id: chatId,
            telegram_user_id: userId,
          },
          { onConflict: "phone" }
        )
        .select()
        .single();

      if (barberError) {
        console.error("Error updating barber:", barberError);
        await sendTelegramMessage({
          chat_id: chatId,
          text: "There was an error linking your account. Please try again.",
        });
        return new Response("OK", { status: 200 });
      }

      // Send the verification code
      await sendTelegramMessage({
        chat_id: chatId,
        text: `Your BarberUp verification code is: *${code}*\n\nThis code expires in 5 minutes. Enter it on the registration page to continue.`,
        parse_mode: "Markdown",
      });

      return new Response("OK", { status: 200 });
    }

    // Handle any other message
    await sendTelegramMessage({
      chat_id: chatId,
      text: "This bot is only used for verification codes. Please use the BarberUp website to manage your account.",
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});
