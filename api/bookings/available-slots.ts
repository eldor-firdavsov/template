import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { service_id, barber_id, from_date, to_date } = req.query as Record<string, string>;

  if (!service_id || !from_date || !to_date) {
    return res.status(400).json({ error: "Missing required query params: service_id, from_date, to_date" });
  }

  // Fetch service to get default duration
  const { data: service, error: svcErr } = await supabaseAdmin
    .from("services")
    .select("id, duration_minutes")
    .eq("id", service_id)
    .single();

  if (svcErr || !service) {
    return res.status(404).json({ error: "Service not found" });
  }

  // Determine which barbers to check
  let barberIds: string[] = [];
  if (barber_id) {
    barberIds = [barber_id];
  } else {
    const { data: bsData } = await supabaseAdmin
      .from("barber_services")
      .select("barber_id")
      .eq("service_id", service_id);

    if (bsData && bsData.length > 0) {
      const bsBarberIds = bsData.map((bs: any) => bs.barber_id);
      const { data: activeBarbers } = await supabaseAdmin
        .from("barbers")
        .select("id")
        .in("id", bsBarberIds)
        .eq("is_active", true);
      barberIds = activeBarbers?.map((b: any) => b.id) ?? [];
    }

    if (barberIds.length === 0) {
      const { data: allActiveBarbers } = await supabaseAdmin
        .from("barbers")
        .select("id")
        .eq("is_active", true);
      barberIds = allActiveBarbers?.map((b: any) => b.id) ?? [];
    }
  }

  if (barberIds.length === 0) {
    return res.json({});
  }

  // Fetch all needed data in parallel
  const [whResult, toResult, bookingResult, bsResult] = await Promise.all([
    supabaseAdmin
      .from("working_hours")
      .select("barber_id, weekday, start_time, end_time")
      .in("barber_id", barberIds),
    supabaseAdmin
      .from("time_off")
      .select("barber_id, date, start_time, end_time")
      .in("barber_id", barberIds)
      .gte("date", from_date)
      .lte("date", to_date),
    supabaseAdmin
      .from("bookings")
      .select("barber_id, starts_at, ends_at, status")
      .in("barber_id", barberIds)
      .in("status", ["confirmed", "pending"])
      .gte("starts_at", from_date + "T00:00:00Z")
      .lte("starts_at", to_date + "T23:59:59Z"),
    supabaseAdmin
      .from("barber_services")
      .select("barber_id, service_id, custom_duration_minutes")
      .in("barber_id", barberIds)
      .eq("service_id", service_id),
  ]);

  // Fixed 30-minute slot granularity
  const SLOT_GRANULARITY = 30;

  // Bookings store shop wall-clock time as UTC (09:00 local → …T09:00:00Z).
  // Slot math must use UTC date/weekday/hours so they match the picker labels.
  const mergedSlots = new Map<string, string[]>();
  const fromDateObj = new Date(from_date + "T00:00:00Z");
  const toDateObj = new Date(to_date + "T00:00:00Z");

  for (const bid of barberIds) {
    const bsData = bsResult.data ?? [];
    const match = bsData.find(
      (bs: any) => bs.service_id === service_id && bs.barber_id === bid,
    );
    const duration = Number(match?.custom_duration_minutes ?? service.duration_minutes) || 30;

    let barberWH = (whResult.data ?? []).filter((wh: any) => wh.barber_id === bid);
    if (barberWH.length === 0) {
      // Default working hours: Mon–Sat (1..6), 09:00 - 20:00
      barberWH = [1, 2, 3, 4, 5, 6].map((w) => ({
        barber_id: bid,
        weekday: w,
        start_time: "09:00:00",
        end_time: "20:00:00",
      }));
    }
    const barberTO = (toResult.data ?? []).filter((to: any) => to.barber_id === bid);
    const barberBookings = (bookingResult.data ?? []).filter(
      (b: any) => b.barber_id === bid,
    );

    const current = new Date(fromDateObj);
    while (current <= toDateObj) {
      const weekday = current.getUTCDay();
      const dateStr = current.toISOString().substring(0, 10);

      const dayHours = barberWH.filter((wh: any) => wh.weekday === weekday);
      if (dayHours.length === 0) {
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }

      let availableRanges: { start: string; end: string }[] = dayHours.map(
        (wh: any) => ({ start: wh.start_time, end: wh.end_time }),
      );

      // Subtract time off
      const dayTO = barberTO.filter((to: any) => to.date === dateStr);
      for (const to of dayTO) {
        if (!to.start_time && !to.end_time) {
          availableRanges = [];
          break;
        }
        availableRanges = subtractTimeRanges(availableRanges, {
          start: to.start_time ?? "00:00",
          end: to.end_time ?? "23:59",
        });
      }

      // Subtract existing confirmed/pending bookings (wall-clock stored as UTC)
      if (availableRanges.length > 0) {
        const dayBookings = barberBookings.filter(
          (b: any) => b.starts_at && b.starts_at.substring(0, 10) === dateStr,
        );
        for (const b of dayBookings) {
          const bStart = new Date(b.starts_at);
          const bEnd = new Date(b.ends_at);
          const bStartStr = `${String(bStart.getUTCHours()).padStart(2, "0")}:${String(bStart.getUTCMinutes()).padStart(2, "0")}`;
          const bEndStr = `${String(bEnd.getUTCHours()).padStart(2, "0")}:${String(bEnd.getUTCMinutes()).padStart(2, "0")}`;
          availableRanges = subtractTimeRanges(availableRanges, {
            start: bStartStr,
            end: bEndStr,
          });
        }
      }

      // Generate slots using fixed 30-minute granularity
      // Note: past-slot filtering is done client-side using local time (StepTime.tsx)
      for (const range of availableRanges) {
        let slotStart = Math.ceil(timeToMinutes(range.start) / SLOT_GRANULARITY) * SLOT_GRANULARITY;
        const rangeEnd = timeToMinutes(range.end);

        while (slotStart + duration <= rangeEnd) {
          const slotStr = minutesToTime(slotStart);
          if (!mergedSlots.has(dateStr)) mergedSlots.set(dateStr, []);
          const slots = mergedSlots.get(dateStr)!;
          if (!slots.includes(slotStr)) {
            slots.push(slotStr);
          }
          slotStart += SLOT_GRANULARITY;
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  // Generate slots for each day in date range
  const result: Record<string, string[]> = {};

  // Populate slots for every day in from_date..to_date
  let cur = new Date(from_date + "T00:00:00Z");
  const endD = new Date(to_date + "T00:00:00Z");
  while (cur <= endD) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    const dStr = `${y}-${m}-${d}`;
    
    const existing = mergedSlots.get(dStr);
    // Only return real computed slots — no fallback defaults
    result[dStr] = existing ? existing.sort() : [];
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return res.json(result);
}

function timeToMinutes(t: string): number {
  const parts = t.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function subtractTimeRanges(
  ranges: { start: string; end: string }[],
  sub: { start: string; end: string },
): { start: string; end: string }[] {
  const result: { start: string; end: string }[] = [];
  const subStart = timeToMinutes(sub.start);
  const subEnd = timeToMinutes(sub.end);

  for (const r of ranges) {
    const rStart = timeToMinutes(r.start);
    const rEnd = timeToMinutes(r.end);

    if (subEnd <= rStart || subStart >= rEnd) {
      result.push(r);
      continue;
    }
    if (subStart > rStart) {
      result.push({ start: r.start, end: minutesToTime(subStart) });
    }
    if (subEnd < rEnd) {
      result.push({ start: minutesToTime(subEnd), end: r.end });
    }
  }

  return result;
}
