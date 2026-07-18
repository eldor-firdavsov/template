import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Barber ID is required" });
  }

  if (req.method === "GET") {
    // Get barber by ID
    try {
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching barber:", error);
        return res.status(500).json({ error: "Failed to fetch barber" });
      }

      if (!data) {
        return res.status(404).json({ error: "Barber not found" });
      }

      return res.json(data);
    } catch (error) {
      console.error("Fetch barber error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "PATCH") {
    // Update barber
    try {
      const { data, error } = await supabase
        .from("barbers")
        .update(req.body)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating barber:", error);
        return res.status(500).json({ error: "Failed to update barber" });
      }

      return res.json(data);
    } catch (error) {
      console.error("Update barber error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
