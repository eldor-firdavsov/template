import { describe, it, expect } from "vitest";
import {
  getAvailableSlots,
  subtractRanges,
  timeToMinutes,
  minutesToTime,
  mergeSlotMaps,
  pickBestBarber,
  getAvailableSlotsForBarber,
} from "./availability";
import type { TimeRange } from "./types";

describe("timeToMinutes / minutesToTime", () => {
  it("converts time strings to minutes and back", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("23:59")).toBe(1439);
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(1439)).toBe("23:59");
  });
});

describe("subtractRanges", () => {
  it("subtracts a middle range", () => {
    const ranges: TimeRange[] = [{ start: "09:00", end: "17:00" }];
    const result = subtractRanges(ranges, { start: "12:00", end: "13:00" });
    expect(result).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
  });

  it("subtracts from the start", () => {
    const ranges: TimeRange[] = [{ start: "09:00", end: "17:00" }];
    const result = subtractRanges(ranges, { start: "08:00", end: "11:00" });
    expect(result).toEqual([{ start: "11:00", end: "17:00" }]);
  });

  it("subtracts from the end", () => {
    const ranges: TimeRange[] = [{ start: "09:00", end: "17:00" }];
    const result = subtractRanges(ranges, { start: "15:00", end: "18:00" });
    expect(result).toEqual([{ start: "09:00", end: "15:00" }]);
  });

  it("subtracts the entire range", () => {
    const ranges: TimeRange[] = [{ start: "09:00", end: "17:00" }];
    const result = subtractRanges(ranges, { start: "09:00", end: "17:00" });
    expect(result).toEqual([]);
  });

  it("handles non-overlapping subtraction", () => {
    const ranges: TimeRange[] = [{ start: "09:00", end: "12:00" }];
    const result = subtractRanges(ranges, { start: "13:00", end: "14:00" });
    expect(result).toEqual([{ start: "09:00", end: "12:00" }]);
  });
});

describe("getAvailableSlots — normal availability", () => {
  it("generates 15-min slots within working hours", () => {
    const now = new Date("2025-01-06T00:00:00Z"); // Monday
    const result = getAvailableSlots(
      {
        barberId: "b1",
        serviceId: "s1",
        durationMinutes: 30,
        workingHours: [{ weekday: 1, start_time: "09:00", end_time: "12:00" }],
        timeOff: [],
        bookings: [],
      },
      now,
      now,
    );

    const monday = "2025-01-06";
    const slots = result.get(monday);
    expect(slots).toBeDefined();
    // 09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30 (10:30+30=12:00 fits)
    // 10:45 + 30 = 11:15 <= 12:00 => yes
    // 11:00 + 30 = 11:30 <= 12:00 => yes
    // 11:15 + 30 = 11:45 <= 12:00 => yes
    // 11:30 + 30 = 12:00 <= 12:00 => yes
    // 11:45 + 30 = 12:15 <= 12:00 => no
    expect(slots).toEqual([
      "09:00", "09:15", "09:30", "09:45",
      "10:00", "10:15", "10:30", "10:45",
      "11:00", "11:15", "11:30",
    ]);
  });

  it("returns empty for a day with no working hours", () => {
    const now = new Date("2025-01-06T00:00:00Z"); // Monday
    const result = getAvailableSlots(
      {
        barberId: "b1",
        serviceId: "s1",
        durationMinutes: 30,
        workingHours: [{ weekday: 2, start_time: "09:00", end_time: "17:00" }], // Only Tuesday
        timeOff: [],
        bookings: [],
      },
      now,
      now,
    );

    const slots = result.get("2025-01-06");
    expect(slots).toEqual([]);
  });
});

describe("getAvailableSlots — fully booked day", () => {
  it("returns no slots when bookings cover the entire day", () => {
    const now = new Date("2025-01-06T00:00:00Z");
    const result = getAvailableSlots(
      {
        barberId: "b1",
        serviceId: "s1",
        durationMinutes: 30,
        workingHours: [{ weekday: 1, start_time: "09:00", end_time: "17:00" }],
        timeOff: [],
        bookings: [
          {
            starts_at: "2025-01-06T09:00:00Z",
            ends_at: "2025-01-06T17:00:00Z",
            status: "confirmed",
            barber_id: "b1",
          },
        ],
      },
      now,
      now,
    );

    const slots = result.get("2025-01-06");
    expect(slots).toEqual([]);
  });
});

describe("getAvailableSlots — time_off day", () => {
  it("returns no slots for a whole day off", () => {
    const now = new Date("2025-01-06T00:00:00Z"); // Monday
    const result = getAvailableSlots(
      {
        barberId: "b1",
        serviceId: "s1",
        durationMinutes: 30,
        workingHours: [{ weekday: 1, start_time: "09:00", end_time: "17:00" }],
        timeOff: [
          { date: "2025-01-06", start_time: null, end_time: null },
        ],
        bookings: [],
      },
      now,
      now,
    );

    const slots = result.get("2025-01-06");
    expect(slots).toEqual([]);
  });

  it("subtracts a partial time_off range", () => {
    const now = new Date("2025-01-06T00:00:00Z"); // Monday
    const result = getAvailableSlots(
      {
        barberId: "b1",
        serviceId: "s1",
        durationMinutes: 30,
        workingHours: [{ weekday: 1, start_time: "09:00", end_time: "17:00" }],
        timeOff: [
          { date: "2025-01-06", start_time: "12:00", end_time: "13:00" },
        ],
        bookings: [],
      },
      now,
      now,
    );

    const slots = result.get("2025-01-06");
    expect(slots).toBeDefined();
    // Slots before 12:00 (09:00..11:45 with 30min duration -> last is 11:30)
    // Slots after 13:00 (13:00..16:30)
    expect(slots!.length).toBeGreaterThan(0);
    // No slot should overlap with 12:00-13:00
    for (const slot of slots!) {
      const startMin = timeToMinutes(slot);
      const endMin = startMin + 30;
      // Either entirely before 12:00 or entirely after 13:00
      expect(endMin <= 720 || startMin >= 780).toBe(true);
    }
  });
});

describe("getAvailableSlots — any available barber merge", () => {
  it("merges slots from multiple barbers", () => {
    const now = new Date("2025-01-06T00:00:00Z"); // Monday
    const service = {
      id: "s1",
      duration_minutes: 30,
    };
    const barberServices = [
      { service_id: "s1", barber_id: "b1", custom_duration_minutes: null },
      { service_id: "s1", barber_id: "b2", custom_duration_minutes: null },
    ];
    const workingHours = [
      { barber_id: "b1", weekday: 1, start_time: "09:00", end_time: "12:00" },
      { barber_id: "b2", weekday: 1, start_time: "14:00", end_time: "17:00" },
    ];
    const timeOff: { barber_id: string; date: string; start_time: string | null; end_time: string | null }[] = [];
    const bookings: { barber_id: string; starts_at: string; ends_at: string; status: string }[] = [];

    const b1Slots = getAvailableSlotsForBarber("s1", "b1", now, now, {
      barberServices,
      workingHours,
      timeOff,
      bookings,
      services: [service],
    });

    const b2Slots = getAvailableSlotsForBarber("s1", "b2", now, now, {
      barberServices,
      workingHours,
      timeOff,
      bookings,
      services: [service],
    });

    const merged = mergeSlotMaps([b1Slots, b2Slots]);
    const slots = merged.get("2025-01-06");

    expect(slots).toBeDefined();
    // b1 has 09:00-12:00 slots, b2 has 14:00-17:00 slots
    expect(slots).toContain("09:00");
    expect(slots).toContain("14:00");
    // All should be sorted
    const sorted = [...slots!].sort();
    expect(slots).toEqual(sorted);
  });
});

describe("pickBestBarber", () => {
  it("picks the barber with fewest bookings", () => {
    const counts = new Map([
      ["b1", 5],
      ["b2", 2],
      ["b3", 8],
    ]);
    expect(pickBestBarber("09:00", "2025-01-06", ["b1", "b2", "b3"], counts)).toBe("b2");
  });

  it("returns null for empty barber list", () => {
    expect(pickBestBarber("09:00", "2025-01-06", [], new Map())).toBeNull();
  });

  it("returns the only barber when one is provided", () => {
    expect(pickBestBarber("09:00", "2025-01-06", ["b1"], new Map())).toBe("b1");
  });
});
