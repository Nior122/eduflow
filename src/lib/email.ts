// Optional transactional email via Resend.
// When RESEND_API_KEY is not configured the caller receives ok:false and
// may fall back to returning the link in the response (dev/demo mode) —
// never a fake "email sent" message without a real transport.

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "EduFlow <noreply@eduflow.app>",
        to,
        subject,
        html,
      }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
