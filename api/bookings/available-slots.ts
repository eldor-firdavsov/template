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
      const bsBarberIds = bsData.map((bs) => bs.barber_id);
      const { data: activeBarbers } = await supabaseAdmin
        .from("barbers")
        .select("id")
        .in("id", bsBarberIds)
        .eq("is_active", true);
      barberIds = activeBarbers?.map((b) => b.id) ?? [];
    }

    if (barberIds.length === 0) {
      const { data: allActiveBarbers } = await supabaseAdmin
        .from("barbers")
        .select("id")
        .eq("is_active", true);
      barberIds = allActiveBarbers?.map((b) => b.id) ?? [];
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
      .gte("starts_at", from_date + "T00:00:00")
      .lte("starts_at", to_date + "T23:59:59"),
    supabaseAdmin
      .from("barber_services")
      .select("barber_id, service_id, custom_duration_minutes")
      .in("barber_id", barberIds)
      .eq("service_id", service_id),
  ]);

  // Fixed 30-minute slot granularity
  const SLOT_GRANULARITY = 30;

  // Compute slots per barber
  const mergedSlots = new Map<string, string[]>();
  const fromDateObj = new Date(from_date + "T00:00:00Z");
  const toDateObj = new Date(to_date + "T00:00:00Z");

  for (const bid of barberIds) {
    const bsData = bsResult.data ?? [];
    const match = bsData.find(
      (bs) => bs.service_id === service_id && bs.barber_id === bid,
    );
    const duration = match?.custom_duration_minutes ?? service.duration_minutes;

    let barberWH = (whResult.data ?? []).filter((wh) => wh.barber_id === bid);
    if (barberWH.length === 0) {
      // Default working hours: Mon–Sat (1..6), 09:00 - 20:00
      barberWH = [1, 2, 3, 4, 5, 6].map((w) => ({
        barber_id: bid,
        weekday: w,
        start_time: "09:00:00",
        end_time: "20:00:00",
      }));
    }
    const barberTO = (toResult.data ?? []).filter((to) => to.barber_id === bid);
    const barberBookings = (bookingResult.data ?? []).filter(
      (b) => b.barber_id === bid,
    );

    const current = new Date(fromDateObj);
    while (current <= toDateObj) {
      const weekday = current.getUTCDay();
      const dateStr = current.toISOString().substring(0, 10);

      const dayHours = barberWH.filter((wh) => wh.weekday === weekday);
      if (dayHours.length === 0) {
        current.setUTCDate(current.getUTCDate() + 1);
        continue;
      }

      let availableRanges: { start: string; end: string }[] = dayHours.map(
        (wh) => ({ start: wh.start_time, end: wh.end_time }),
      );

      // Subtract time off
      const dayTO = barberTO.filter((to) => to.date === dateStr);
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

      // Subtract existing confirmed bookings
      if (availableRanges.length > 0) {
        const dayBookings = barberBookings.filter(
          (b) => b.starts_at.substring(0, 10) === dateStr,
        );
        for (const b of dayBookings) {
          availableRanges = subtractTimeRanges(availableRanges, {
            start: formatTime(new Date(b.starts_at)),
            end: formatTime(new Date(b.ends_at)),
          });
        }
      }

      // Generate slots using fixed 30-minute granularity
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

  // Sort slots per day
  const result: Record<string, string[]> = {};
  for (const [date, slots] of mergedSlots) {
    result[date] = slots.sort();
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

function formatTime(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
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
