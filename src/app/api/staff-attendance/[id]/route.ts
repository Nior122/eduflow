import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, attendanceCorrectionSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = validate(attendanceCorrectionSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }

    const existing = await prisma.staffAttendance.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

    const updateData: Prisma.StaffAttendanceUpdateInput = {
      status: parsed.data.status,
      ...(parsed.data.remark !== undefined && { remark: parsed.data.remark ?? null }),
    };

    const record = await prisma.staffAttendance.update({ where: { id }, data: updateData });
    return NextResponse.json({ record });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }
    console.error("Failed to correct attendance:", error);
    return NextResponse.json({ error: "Failed to correct attendance" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const result = await prisma.staffAttendance.deleteMany({ where: { id, schoolId } });
  if (result.count === 0) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
