import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { full_name, phone, telegram_user_id } = req.body as {
    full_name?: string;
    phone?: string;
    telegram_user_id?: number | string;
  };

  if (!full_name || !phone) {
    return res.status(400).json({ error: "Missing full_name or phone" });
  }

  // Check if client already exists by phone (using maybeSingle to avoid 0-rows errors)
  const { data: existing } = await supabaseAdmin
    .from("clients")
    .select("id, full_name")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    // If the name is different, we can update it to be accurate
    if (full_name !== existing.full_name) {
      await supabaseAdmin
        .from("clients")
        .update({ full_name })
        .eq("id", existing.id);
    }
    return res.json({ client_id: existing.id, is_new: false });
  }

  // Create new client with provided telegram_user_id or synthetic ID for web clients
  const tgId = telegram_user_id
    ? Number(telegram_user_id)
    : Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100000);

  const { data: newClient, error: createErr } = await supabaseAdmin
    .from("clients")
    .insert({
      full_name,
      phone,
      telegram_user_id: tgId,
    })
    .select("id")
    .single();

  if (createErr || !newClient) {
    console.error("Client creation failed:", createErr);
    return res.status(500).json({ error: "Failed to create client profile" });
  }

  return res.json({ client_id: newClient.id, is_new: true });
}
