// Phone utilities — Uzbekistan (12 digits, no "+" prefix)
// Format: 998 90 909 90 90
export const UZ_PHONE_REGEX = /^\d{12}$/;

export function normalizePhone(input: string): string {
  // Strip everything but digits
  return input.replace(/\D/g, "");
}

export function formatPhoneUz(value: string): string {
  const digits = normalizePhone(value).slice(0, 12);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 8)
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  if (digits.length <= 10)
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
}

export function isValidPhoneUz(value: string): boolean {
  return UZ_PHONE_REGEX.test(normalizePhone(value));
}

// "998 90 909 90 90" -> "+99890909090" (E.164 used for storage / API)
export function toE164(value: string): string {
  const digits = normalizePhone(value);
  if (digits.length === 0) return "";
  return `+${digits}`;
}
