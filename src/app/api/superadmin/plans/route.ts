import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/** GET — all plans. POST — create/update a plan (upsert by code). */
export async function GET() {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ plans });
}

export async function POST(req: Request) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;

  const body = await parseJsonBody(req).catch(() => null);
  const code = typeof body?.code === "string" ? body.code.toUpperCase() : null;
  const name = typeof body?.name === "string" ? body.name : null;
  if (!code || !name) return NextResponse.json({ error: "code and name are required" }, { status: 400 });

  const data = {
    name,
    code,
    description: typeof body?.description === "string" ? body.description : null,
    priceMonthly: Number(body?.priceMonthly ?? 0),
    priceYearly: Number(body?.priceYearly ?? 0),
    currency: typeof body?.currency === "string" ? body.currency : "USD",
    features: body?.features ?? {
      maxStudents: 100,
      maxTeachers: 10,
      storageMb: 1024,
      aiTokensPerMonth: 100000,
      apiCallsPerMonth: 10000,
      modules: {},
    },
    isActive: body?.isActive !== false,
    sortOrder: Number(body?.sortOrder ?? 0),
  };

  const plan = await prisma.subscriptionPlan.upsert({
    where: { code },
    update: data,
    create: data,
  });
  await audit({
    actorId: guard.userId,
    action: "PLAN_SAVED",
    category: "ADMIN",
    metadata: { code: plan.code },
  });
  return NextResponse.json({ plan }, { status: 201 });
}
