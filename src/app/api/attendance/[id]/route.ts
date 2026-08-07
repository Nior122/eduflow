import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, attendanceCorrectionSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

/** Correct a student attendance record (status/remark). */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
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

    const existing = await prisma.attendance.findFirst({
      where: { id, class: { schoolId } },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

    const updateData: Prisma.AttendanceUpdateInput = {
      status: parsed.data.status,
      ...(parsed.data.remark !== undefined && { remark: parsed.data.remark ?? null }),
    };

    const record = await prisma.attendance.update({ where: { id }, data: updateData });
    return NextResponse.json({ record });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }
    console.error("Failed to correct attendance:", error);
    return NextResponse.json({ error: "Failed to correct attendance" }, { status: 500 });
  }
}
