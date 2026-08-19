import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { validate, resetPasswordSchema } from "@/lib/validations";
import { rateLimit, ipKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ipKey(ip, "reset-password"), { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(resetPasswordSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { token, password } = parsed.data;

    const record = await prisma.verificationToken.findUnique({ where: { token } });
    if (!record || record.expires < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);

    // Reset the password (re-activating the account) and consume all
    // outstanding tokens for this user in one transaction.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.identifier },
        data: { passwordHash, isActive: true },
      }),
      prisma.verificationToken.deleteMany({ where: { identifier: record.identifier } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
