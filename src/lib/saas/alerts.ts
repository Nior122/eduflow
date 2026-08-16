// ─── Phase 9: alerting (Slack-compatible webhook + log fallback) ────
import { logger } from "./logger";

export async function sendAlert(opts: {
  title: string;
  message: string;
  level?: "info" | "warn" | "error";
}) {
  const url = process.env.ALERT_WEBHOOK_URL;
  const level = opts.level ?? "info";
  const payload = { text: `[${level}] ${opts.title}\n${opts.message}` };
  if (url) {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return;
    } catch (e) {
      logger.warn("alert webhook failed", { error: String(e) });
    }
  }
  if (level === "error") logger.error(opts.title, { message: opts.message });
  else if (level === "warn") logger.warn(opts.title, { message: opts.message });
  else logger.info(opts.title, { message: opts.message });
}
