import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardV1ApiKey } from "@/lib/saas/v1";

/** GET /api/v1/school — school profile + plan + limits (API key auth). */
export async function GET(req: Request) {
  const auth = await guardV1ApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const school = await prisma.school.findUnique({
    where: { id: auth.schoolId },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      logo: true,
      motto: true,
      currency: true,
      gradeSystem: true,
      subscription: {
        select: {
          status: true,
          cycle: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          plan: { select: { name: true, code: true, features: true } },
        },
      },
    },
  });
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });
  return NextResponse.json({ school });
}
