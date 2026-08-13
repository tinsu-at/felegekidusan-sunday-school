import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (expected) {
          const provided =
            request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
          if (!safeEqual(provided, expected)) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        let update: unknown;
        try {
          update = await request.json();
        } catch {
          return Response.json({ ok: true, ignored: true });
        }

        try {
          const { handleTelegramUpdate } = await import(
            "@/lib/telegram-bot.server"
          );
          await handleTelegramUpdate(update as never);
        } catch {
          // Always answer 200 so Telegram does not hammer retries; details stay server-side.
          console.error("Failed to process a Telegram update");
        }

        return Response.json({ ok: true });
      },
    },
  },
});
