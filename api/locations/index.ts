import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    // Create location
    const { name, address, phone, photo_url } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: "Name and address are required" });
    }

    try {
      const { data, error } = await supabase
        .from("locations")
        .insert({
          name,
          address,
          phone: phone || null,
          photo_url: photo_url || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating location:", error);
        return res.status(500).json({ error: "Failed to create location" });
      }

      return res.status(201).json(data);
    } catch (error) {
      console.error("Create location error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "GET") {
    // Get locations
    try {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching locations:", error);
        return res.status(500).json({ error: "Failed to fetch locations" });
      }

      return res.json(data || []);
    } catch (error) {
      console.error("Fetch locations error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
