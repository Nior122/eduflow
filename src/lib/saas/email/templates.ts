// ─── Phase 9: transactional email templates (inline styles, safe) ────
export interface SaaSEmailInput {
  to: string;
  subject: string;
  /** Rendered body override. Optional: when omitted, `template` + `data` are rendered. */
  html?: string;
  template?: string;
  data?: Record<string, unknown>;
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
<div style="background:#18181b;color:#ffffff;padding:20px 28px;font-size:18px;font-weight:700">🎓 EduFlow</div>
<div style="padding:28px">
<h2 style="margin:0 0 12px;font-size:20px;color:#18181b">${title}</h2>
${body}
</div>
<div style="padding:14px 28px;background:#fafafa;color:#71717a;font-size:12px">EduFlow — AI-Powered School Management · support@eduflow.app</div>
</div></body></html>`;
}

function minor(value: unknown, currency: unknown): string {
  const n = typeof value === "number" ? value / 100 : 0;
  return `${typeof currency === "string" ? currency : "USD"} ${n.toFixed(2)}`;
}

export function renderTemplate(name: string | undefined, data: Record<string, unknown>): string | null {
  const school = String(data.schoolName ?? "your school");
  const plan = String(data.planName ?? "");
  switch (name) {
    case "welcome":
      return shell(
        "Welcome to EduFlow 👋",
        `<p style="color:#3f3f46;line-height:1.6">Your school <strong>${school}</strong> is on the <strong>${plan}</strong> plan. You can now invite teachers, add students, and configure your academic year from the dashboard.</p>
<p style="color:#3f3f46;line-height:1.6">Next step: complete your <a href="https://app.eduflow.com/onboarding" style="color:#2563eb">school onboarding</a>.</p>`
      );
    case "invitation":
      return shell(
        "You've been invited to EduFlow",
        `<p style="color:#3f3f46;line-height:1.6">You have been invited to join <strong>${school}</strong> on EduFlow.</p>
<p style="color:#3f3f46;line-height:1.6">Sign in with your email and the temporary password below, then change it from your profile:</p>
<p style="background:#f4f4f5;padding:12px;border-radius:8px;font-family:monospace;color:#18181b">${String(data.tempPassword ?? "")}</p>`
      );
    case "invoice":
      return shell(
        `Invoice ${String(data.invoiceNumber ?? "")}`,
        `<p style="color:#3f3f46;line-height:1.6">Amount due: <strong>${minor(data.amountMinor, data.currency)}</strong> for your EduFlow subscription.</p>
<p style="color:#3f3f46;line-height:1.6">Payments are processed automatically by your billing provider.</p>`
      );
    case "receipt":
      return shell(
        `Receipt ${String(data.invoiceNumber ?? "")}`,
        `<p style="color:#3f3f46;line-height:1.6">Thank you! We received <strong>${minor(data.amountMinor, data.currency)}</strong> for your EduFlow subscription.</p>`
      );
    case "paymentFailed":
      return shell(
        "Payment failed",
        `<p style="color:#3f3f46;line-height:1.6">We couldn't charge your card for the EduFlow subscription of <strong>${school}</strong>.</p>
<p style="color:#3f3f46;line-height:1.6">Please update your payment method in your <a href="https://app.eduflow.com/admin/subscription" style="color:#2563eb">billing settings</a> to avoid service interruption.</p>`
      );
    case "subscriptionCanceled":
      return shell(
        "Subscription canceled",
        `<p style="color:#3f3f46;line-height:1.6">The EduFlow subscription for <strong>${school}</strong> has been canceled and will end at the end of the current period.</p>`
      );
    case "ticket":
      return shell(
        "Support ticket received",
        `<p style="color:#3f3f46;line-height:1.6">We received your ticket <strong>${String(data.ticketSubject ?? "")}</strong>. Our team will get back to you shortly.</p>`
      );
    default:
      return null;
  }
}
