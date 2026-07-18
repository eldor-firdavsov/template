import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    // Link barber to service
    const { barber_id, service_id, custom_duration_minutes } = req.body;

    if (!barber_id || !service_id) {
      return res.status(400).json({ error: "Barber ID and service ID are required" });
    }

    try {
      const { data, error } = await supabase
        .from("barber_services")
        .insert({
          barber_id,
          service_id,
          custom_duration_minutes: custom_duration_minutes || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error linking barber service:", error);
        return res.status(500).json({ error: "Failed to link barber service" });
      }

      return res.status(201).json(data);
    } catch (error) {
      console.error("Link barber service error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "GET") {
    // Get services for a barber
    const { barber_id } = req.query;

    if (!barber_id) {
      return res.status(400).json({ error: "Barber ID is required" });
    }

    try {
      const { data, error } = await supabase
        .from("barber_services")
        .select("*, services(*)")
        .eq("barber_id", barber_id);

      if (error) {
        console.error("Error fetching barber services:", error);
        return res.status(500).json({ error: "Failed to fetch barber services" });
      }

      return res.json(data || []);
    } catch (error) {
      console.error("Fetch barber services error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "DELETE") {
    // Unlink barber from service
    const { barber_id, service_id } = req.body;

    if (!barber_id || !service_id) {
      return res.status(400).json({ error: "Barber ID and service ID are required" });
    }

    try {
      const { error } = await supabase
        .from("barber_services")
        .delete()
        .eq("barber_id", barber_id)
        .eq("service_id", service_id);

      if (error) {
        console.error("Error unlinking barber service:", error);
        return res.status(500).json({ error: "Failed to unlink barber service" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Unlink barber service error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
