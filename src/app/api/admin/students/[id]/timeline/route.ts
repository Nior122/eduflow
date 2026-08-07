import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const student = await prisma.student.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const timeline = await prisma.studentTimeline.findMany({
    where: { studentId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ timeline });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = z
      .object({ event: z.string().min(1, "Event is required").max(100), note: z.string().max(500).optional() })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const entry = await prisma.studentTimeline.create({
      data: { studentId: id, event: parsed.data.event, note: parsed.data.note ?? null },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Failed to add timeline entry:", error);
    return NextResponse.json({ error: "Failed to add timeline entry" }, { status: 500 });
  }
}
