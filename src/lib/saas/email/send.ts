// ─── Phase 9: email sending (Resend via REST; console fallback) ──────
// Provider abstraction: swap Resend for any fetch-able provider by
// changing `sendViaProvider`. Every send is logged to EmailLog.
import { prisma } from "@/lib/db";
import { logger } from "../logger";
import { renderTemplate, type SaaSEmailInput } from "./templates";

export async function sendSaaSEmail(input: SaaSEmailInput): Promise<"SENT" | "QUEUED" | "FAILED"> {
  const html = renderTemplate(input.template, input.data ?? {}) ?? input.html;
  const apiKey = process.env.RESEND_API_KEY;
  let status: "SENT" | "QUEUED" | "FAILED" = "QUEUED";
  let error: string | null = null;

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? "EduFlow <noreply@eduflow.app>",
          to: [input.to],
          subject: input.subject,
          html,
        }),
      });
      if (!res.ok) {
        status = "FAILED";
        error = `resend ${res.status}`;
      } else {
        status = "SENT";
      }
    } catch (e) {
      status = "FAILED";
      error = String(e);
    }
  } else {
    // Dev fallback — never silently drop: log instead of sending.
    logger.info("email (dev fallback, no RESEND_API_KEY)", { to: input.to, subject: input.subject });
    status = "QUEUED";
  }

  try {
    await prisma.emailLog.create({
      data: {
        to: input.to,
        subject: input.subject,
        template: input.template ?? null,
        status,
        provider: apiKey ? "resend" : "console",
        error,
      },
    });
  } catch (e) {
    logger.error("emailLog write failed", { error: String(e) });
  }
  return status;
}
