import type { TimeRange } from "./types";

export function timeToMinutes(t: string): number {
  const parts = t.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function subtractRanges(
  ranges: TimeRange[],
  toSubtract: TimeRange,
): TimeRange[] {
  const result: TimeRange[] = [];
  const subStart = timeToMinutes(toSubtract.start);
  const subEnd = timeToMinutes(toSubtract.end);

  for (const range of ranges) {
    const rStart = timeToMinutes(range.start);
    const rEnd = timeToMinutes(range.end);

    if (subEnd <= rStart || subStart >= rEnd) {
      result.push(range);
      continue;
    }
    if (subStart > rStart) {
      result.push({ start: range.start, end: minutesToTime(subStart) });
    }
    if (subEnd < rEnd) {
      result.push({ start: minutesToTime(subEnd), end: range.end });
    }
  }

  return result;
}

function subtractAllRanges(
  ranges: TimeRange[],
  subtractions: TimeRange[],
): TimeRange[] {
  let current = ranges;
  for (const sub of subtractions) {
    current = subtractRanges(current, sub);
  }
  return current;
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTimeFromDate(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function getDurationForSlot(
  serviceId: string,
  barberId: string,
  barberServices: { service_id: string; barber_id: string; custom_duration_minutes: number | null }[],
  defaultDuration: number,
): number {
  const match = barberServices.find(
    (bs) => bs.service_id === serviceId && bs.barber_id === barberId,
  );
  return match?.custom_duration_minutes ?? defaultDuration;
}

export interface SlotInput {
  barberId: string;
  serviceId: string;
  durationMinutes: number;
  workingHours: { weekday: number; start_time: string; end_time: string }[];
  timeOff: { date: string; start_time: string | null; end_time: string | null }[];
  bookings: {
    starts_at: string;
    ends_at: string;
    status: string;
    barber_id: string;
  }[];
}

export function getAvailableSlots(
  input: SlotInput,
  fromDate: Date,
  toDate: Date,
  granularityMinutes: number = 15,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const { durationMinutes, workingHours, timeOff, bookings, barberId } = input;

  const current = new Date(fromDate);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setUTCHours(23, 59, 59, 999);

  while (current <= end) {
    const weekday = current.getUTCDay();
    const dateStr = formatDate(current);

    const dayHours = workingHours.filter((wh) => wh.weekday === weekday);
    if (dayHours.length === 0) {
      result.set(dateStr, []);
      current.setUTCDate(current.getUTCDate() + 1);
      continue;
    }

    let availableRanges: TimeRange[] = dayHours.map((wh) => ({
      start: wh.start_time,
      end: wh.end_time,
    }));

    const dayTimeOff = timeOff.filter((to) => to.date === dateStr);
    for (const to of dayTimeOff) {
      if (!to.start_time && !to.end_time) {
        availableRanges = [];
        break;
      }
      availableRanges = subtractRanges(availableRanges, {
        start: to.start_time ?? "00:00",
        end: to.end_time ?? "23:59",
      });
    }

    if (availableRanges.length > 0) {
      const dayBookings = bookings.filter((b) => {
        if (b.barber_id !== barberId || (b.status !== "confirmed" && b.status !== "pending")) return false;
        const bDate = b.starts_at.substring(0, 10);
        return bDate === dateStr;
      });

      const bookingSubtractions: TimeRange[] = dayBookings.map((b) => ({
        start: formatTimeFromDate(new Date(b.starts_at)),
        end: formatTimeFromDate(new Date(b.ends_at)),
      }));

      availableRanges = subtractAllRanges(availableRanges, bookingSubtractions);
    }

    const slots: string[] = [];
    for (const range of availableRanges) {
      let slotStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);

      while (slotStart + durationMinutes <= rangeEnd) {
        slots.push(minutesToTime(slotStart));
        slotStart += granularityMinutes;
      }
    }

    result.set(dateStr, slots);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

export function getAvailableSlotsForBarber(
  serviceId: string,
  barberId: string,
  fromDate: Date,
  toDate: Date,
  allData: {
    barberServices: {
      service_id: string;
      barber_id: string;
      custom_duration_minutes: number | null;
    }[];
    workingHours: {
      barber_id: string;
      weekday: number;
      start_time: string;
      end_time: string;
    }[];
    timeOff: {
      barber_id: string;
      date: string;
      start_time: string | null;
      end_time: string | null;
    }[];
    bookings: {
      barber_id: string;
      starts_at: string;
      ends_at: string;
      status: string;
    }[];
    services: { id: string; duration_minutes: number }[];
  },
): Map<string, string[]> {
  const service = allData.services.find((s) => s.id === serviceId);
  if (!service) return new Map();

  const defaultDuration = service.duration_minutes;
  const duration = getDurationForSlot(
    serviceId,
    barberId,
    allData.barberServices,
    defaultDuration,
  );

  const barberWH = allData.workingHours.filter(
    (wh) => wh.barber_id === barberId,
  );
  const barberTO = allData.timeOff.filter((to) => to.barber_id === barberId);
  const barberBookings = allData.bookings.filter(
    (b) => b.barber_id === barberId,
  );

  return getAvailableSlots(
    {
      barberId,
      serviceId,
      durationMinutes: duration,
      workingHours: barberWH,
      timeOff: barberTO,
      bookings: barberBookings,
    },
    fromDate,
    toDate,
  );
}

export function mergeSlotMaps(
  maps: Map<string, string[]>[],
): Map<string, string[]> {
  const merged = new Map<string, string[]>();
  if (maps.length === 0) return merged;

  const allDates = new Set<string>();
  for (const map of maps) {
    for (const date of map.keys()) {
      allDates.add(date);
    }
  }

  for (const date of allDates) {
    const allSlots = new Set<string>();
    for (const map of maps) {
      const slots = map.get(date);
      if (slots) {
        for (const slot of slots) {
          allSlots.add(slot);
        }
      }
    }
    merged.set(date, Array.from(allSlots).sort());
  }

  return merged;
}

export function pickBestBarber(
  slotTime: string,
  dateStr: string,
  barberIds: string[],
  bookingCounts: Map<string, number>,
): string | null {
  if (barberIds.length === 0) return null;
  if (barberIds.length === 1) return barberIds[0]!;

  let bestBarber: string | null = null;
  let leastBookings = Infinity;

  for (const bid of barberIds) {
    const count = bookingCounts.get(bid) ?? 0;
    if (count < leastBookings) {
      leastBookings = count;
      bestBarber = bid;
    }
  }

  void slotTime;
  void dateStr;
  return bestBarber;
}
