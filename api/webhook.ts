import type { VercelRequest, VercelResponse } from "@vercel/node";

// TODO: replace with real credentials via env vars
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "TODO_BOT_TOKEN";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "TODO_WEBHOOK_SECRET";

// TODO: replace with your actual Vercel deployment URL
const MINI_APP_URL = process.env.MINI_APP_URL ?? "https://your-app.vercel.app";

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    from?: { id: number; first_name: string };
  };
  [key: string]: unknown;
}

async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify the secret token (optional extra security layer)
  const secretToken = req.headers["x-telegram-bot-api-secret-token"];
  if (WEBHOOK_SECRET !== "TODO_WEBHOOK_SECRET" && secretToken !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: "Invalid secret token" });
  }

  const update = req.body as TelegramUpdate;

  if (BOT_TOKEN === "TODO_BOT_TOKEN") {
    console.warn("Bot token not configured — skipping update processing");
    return res.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text) {
    return res.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text;

  if (text === "/start") {
    const firstName = message.from?.first_name ?? "there";
    await sendMessage(chatId, `Hey ${firstName}! 👋\n\nReady to book your next haircut?`, {
      inline_keyboard: [
        [
          {
            text: "📅 Book Now",
            web_app: { url: MINI_APP_URL },
          },
        ],
      ],
    });
  }

  return res.json({ ok: true });
}

// For webhook setup, call this once:
// POST https://api.telegram.org/bot<token>/setWebhook?url=<deployment-url>/api/webhook&secret_token=<secret>
