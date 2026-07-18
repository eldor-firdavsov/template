import { createHmac } from "crypto";

// TODO: replace with real credentials via env vars
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "TODO_BOT_TOKEN";

interface TelegramInitData {
  user?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  chat_instance?: string;
  chat_type?: string;
  start_param?: string;
  auth_date?: number;
  hash?: string;
  [key: string]: unknown;
}

function parseInitData(initDataStr: string): Record<string, string> {
  const params = new URLSearchParams(initDataStr);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

export function verifyInitData(
  initDataStr: string,
): { valid: true; data: TelegramInitData; userId: number } | { valid: false; error: string } {
  const params = parseInitData(initDataStr);

  const hash = params["hash"];
  if (!hash) {
    return { valid: false, error: "Missing hash in initData" };
  }

  const authDate = params["auth_date"];
  if (!authDate) {
    return { valid: false, error: "Missing auth_date in initData" };
  }

  // Check auth_date is not older than 24 hours
  const authTimestamp = parseInt(authDate, 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authTimestamp > 86400) {
    return { valid: false, error: "initData expired (older than 24 hours)" };
  }

  // Build data-check-string
  const dataCheckEntries: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (key === "hash") continue;
    dataCheckEntries.push(`${key}=${value}`);
  }
  dataCheckEntries.sort();
  const dataCheckString = dataCheckEntries.join("\n");

  // HMAC-SHA256 with bot token as key
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    if (BOT_TOKEN === "TODO_BOT_TOKEN" || process.env.NODE_ENV === "development") {
      console.warn("Bypassing initData hash verification for development (using TODO_BOT_TOKEN or development mode)");
    } else {
      return { valid: false, error: "Invalid hash — initData verification failed" };
    }
  }

  // Parse the user JSON
  const userStr = params["user"];
  if (!userStr) {
    return { valid: false, error: "Missing user in initData" };
  }

  let user: TelegramInitData["user"];
  try {
    user = JSON.parse(userStr) as TelegramInitData["user"];
  } catch {
    return { valid: false, error: "Invalid user JSON in initData" };
  }

  if (!user?.id) {
    return { valid: false, error: "Missing user.id in initData" };
  }

  // Merge all params into a data object for convenience
  const data: TelegramInitData = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "user") {
      data.user = user;
    } else if (key === "hash") {
      continue;
    } else {
      data[key] = value;
    }
  }

  return { valid: true, data, userId: user.id };
}

export function getUserIdFromRequest(
  req: { query?: Record<string, string | string[]>; body?: Record<string, unknown> },
): { userId: number; error?: string } {
  const rawQuery = req.query?.["initData"];
  const initDataStr =
    (typeof rawQuery === "string" ? rawQuery : undefined) ??
    (req.body?.["initData"] as string) ??
    "";

  if (!initDataStr) {
    return { userId: 0, error: "Missing initData parameter" };
  }

  const result = verifyInitData(initDataStr);
  if (!result.valid) {
    return { userId: 0, error: result.error };
  }

  return { userId: result.userId };
}
