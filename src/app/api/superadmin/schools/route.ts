import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/**
 * GET /api/superadmin/schools?search=&page=&pageSize= — all tenants.
 * PATCH /api/superadmin/schools — { id, status: ACTIVE|SUSPENDED }.
 */
export async function GET(req: Request) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10) || 25));

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { slug: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [schools, total] = await Promise.all([
    prisma.school.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        status: true,
        onboardingComplete: true,
        createdAt: true,
        subscription: {
          select: { status: true, plan: { select: { name: true, code: true } }, trialEndsAt: true },
        },
        _count: { select: { students: true, teachers: true, users: true } },
      },
    }),
    prisma.school.count({ where }),
  ]);

  return NextResponse.json({
    data: schools,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

export async function PATCH(req: Request) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const status = body?.status;
  if (!id || (status !== "ACTIVE" && status !== "SUSPENDED")) {
    return NextResponse.json({ error: "id and status (ACTIVE|SUSPENDED) are required" }, { status: 400 });
  }

  const school = await prisma.school.findUnique({ where: { id } });
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  await prisma.school.update({ where: { id }, data: { status } });
  await audit({
    schoolId: id,
    actorId: guard.userId,
    action: status === "SUSPENDED" ? "SCHOOL_SUSPENDED" : "SCHOOL_ACTIVATED",
    category: "ADMIN",
    metadata: { school: school.name },
  });
  return NextResponse.json({ ok: true, status });
}
