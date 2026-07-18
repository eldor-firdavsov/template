import { createClient } from "@supabase/supabase-js";

// TODO: replace with real credentials via env vars
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder";

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
