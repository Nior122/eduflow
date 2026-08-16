import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";

/** GET /api/superadmin/tickets?status=OPEN — support queue (super admin). */
export async function GET(req: Request) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const tickets = await prisma.supportTicket.findMany({
    where: status && status !== "ALL" ? { status: status as never } : undefined,
    include: {
      school: { select: { name: true, slug: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ tickets });
}
