import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    // Create working hours
    const { barber_id, weekday, start_time, end_time } = req.body;

    if (!barber_id || weekday === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: "Barber ID, weekday, start time, and end time are required" });
    }

    try {
      const { data, error } = await supabase
        .from("working_hours")
        .insert({
          barber_id,
          weekday,
          start_time,
          end_time,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating working hours:", error);
        return res.status(500).json({ error: "Failed to create working hours" });
      }

      return res.status(201).json(data);
    } catch (error) {
      console.error("Create working hours error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "GET") {
    // Get working hours for a barber
    const { barber_id } = req.query;

    if (!barber_id) {
      return res.status(400).json({ error: "Barber ID is required" });
    }

    try {
      const { data, error } = await supabase
        .from("working_hours")
        .select("*")
        .eq("barber_id", barber_id)
        .order("weekday", { ascending: true });

      if (error) {
        console.error("Error fetching working hours:", error);
        return res.status(500).json({ error: "Failed to fetch working hours" });
      }

      return res.json(data || []);
    } catch (error) {
      console.error("Fetch working hours error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "PATCH") {
    // Update working hours
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Working hours ID is required" });
    }

    try {
      const { data, error } = await supabase
        .from("working_hours")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating working hours:", error);
        return res.status(500).json({ error: "Failed to update working hours" });
      }

      return res.json(data);
    } catch (error) {
      console.error("Update working hours error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "DELETE") {
    // Delete working hours
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Working hours ID is required" });
    }

    try {
      const { error } = await supabase
        .from("working_hours")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting working hours:", error);
        return res.status(500).json({ error: "Failed to delete working hours" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Delete working hours error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
