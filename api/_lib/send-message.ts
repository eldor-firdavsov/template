// TODO: replace with real bot token via env var
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "TODO_BOT_TOKEN";

export async function sendTelegramMessage(
  telegramUserId: number,
  text: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramUserId,
          text,
          parse_mode: "HTML",
        }),
      },
    );
    return res.ok;
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
    return false;
  }
}
