/**
 * Shop times are stored as wall-clock Uzbekistan time labeled as UTC
 * (e.g. 09:00 local → "…T09:00:00.000Z"). Display and slot math must use
 * UTC getters so the same HH:MM the client picked is what barbers see.
 */

export const SHOP_TZ_LABEL = "Asia/Tashkent";

/** Build an ISO timestamp for a picked date + HH:MM using the wall-clock-as-UTC convention. */
export function wallClockToIso(date: string, time: string): string {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalized}Z`).toISOString();
}

/** Format a stored booking ISO back to wall-clock HH:MM. */
export function isoToWallClockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Calendar date (YYYY-MM-DD) from a stored booking ISO (wall-clock-as-UTC). */
export function isoToWallClockDate(iso: string): string {
  return new Date(iso).toISOString().substring(0, 10);
}
