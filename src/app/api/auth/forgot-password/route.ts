import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { validate, forgotPasswordSchema } from "@/lib/validations";
import { sendEmail } from "@/lib/email";
import { rateLimit, ipKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ipKey(ip, "forgot-password"), { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = validate(forgotPasswordSchema, body);
    if (!parsed.ok) {
      // Do not reveal whether an account exists — same response as success.
      return NextResponse.json({ ok: true });
    }
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const token = randomBytes(24).toString("hex");
      await prisma.verificationToken.create({
        data: {
          identifier: user.id,
          token,
          expires: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        },
      });

      const origin =
        req.headers.get("origin")?.replace(/\/$/, "") ??
        (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
      const resetUrl = `${origin}/reset-password?token=${token}`;

      const sent = await sendEmail(
        email,
        "Reset your EduFlow password",
        `<p>You requested a password reset for your EduFlow account.</p>
         <p><a href="${resetUrl}">Click here to choose a new password</a></p>
         <p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`
      );

      // Dev/demo mode (no email provider configured): return the link so
      // the reset flow can actually be completed — never a fake "sent!".
      if (!sent.ok) {
        return NextResponse.json({ ok: true, dev: true, resetUrl });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
