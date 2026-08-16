import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";
import { sendSaaSEmail } from "@/lib/saas/email/send";
import { provisionUser } from "@/lib/provision";

const MAX_INVITES = 20;

/**
 * POST /api/onboarding/invite-teachers
 * Body: { invites: [{ email, name? }] }
 * Creates teacher login accounts (User role TEACHER) and emails each an
 * invitation with a temporary password. Full teacher profiles are filled
 * in later from Teachers → Add Teacher.
 */
export async function POST(req: Request) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const invites = Array.isArray(body?.invites) ? body.invites : [];
  if (invites.length === 0 || invites.length > MAX_INVITES) {
    return NextResponse.json({ error: `Provide between 1 and ${MAX_INVITES} invites` }, { status: 400 });
  }
  const parsed: { email: string; name?: string }[] = [];
  for (const inv of invites) {
    if (typeof inv?.email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inv.email)) {
      return NextResponse.json({ error: `Invalid email: ${String(inv?.email)}` }, { status: 400 });
    }
    parsed.push({ email: inv.email.toLowerCase(), name: typeof inv.name === "string" ? inv.name : undefined });
  }

  const school = await prisma.school.findUnique({
    where: { id: guard.schoolId },
    select: { name: true },
  });

  const results = await prisma.$transaction(async (tx) => {
    const out: { email: string; status: string; tempPassword?: string }[] = [];
    for (const inv of parsed) {
      const existing = await tx.user.findUnique({ where: { email: inv.email } });
      if (existing) {
        out.push({ email: inv.email, status: "skipped: already registered" });
        continue;
      }
      const creds = await provisionUser(
        {
          email: inv.email,
          role: "TEACHER",
          schoolId: guard.schoolId,
          name: inv.name ?? inv.email.split("@")[0],
          phone: null,
        },
        tx
      );
      out.push({ email: creds.loginEmail, status: "invited", tempPassword: creds.tempPassword });
    }
    return out;
  });

  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "ONBOARDING_INVITE_TEACHERS",
    category: "ONBOARDING",
    metadata: { count: results.filter((r) => r.status === "invited").length },
  });

  for (const r of results) {
    if (r.status === "invited") {
      await sendSaaSEmail({
        to: r.email,
        subject: `You've been invited to ${school?.name ?? "a school"} on EduFlow`,
        template: "invitation",
        data: { schoolName: school?.name ?? "your school", tempPassword: r.tempPassword },
      });
    }
  }

  return NextResponse.json({ ok: true, invites: results }, { status: 201 });
}
