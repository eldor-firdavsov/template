import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    // Create service
    const { name, category, duration_minutes, price } = req.body;

    if (!name || !duration_minutes || !price) {
      return res.status(400).json({ error: "Name, duration, and price are required" });
    }

    try {
      const { data, error } = await supabase
        .from("services")
        .insert({
          name,
          category: category || null,
          duration_minutes,
          price,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating service:", error);
        return res.status(500).json({ error: "Failed to create service" });
      }

      return res.status(201).json(data);
    } catch (error) {
      console.error("Create service error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "GET") {
    // Get services
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching services:", error);
        return res.status(500).json({ error: "Failed to fetch services" });
      }

      return res.json(data || []);
    } catch (error) {
      console.error("Fetch services error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "PATCH") {
    // Update service
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    try {
      const { data, error } = await supabase
        .from("services")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating service:", error);
        return res.status(500).json({ error: "Failed to update service" });
      }

      return res.json(data);
    } catch (error) {
      console.error("Update service error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
