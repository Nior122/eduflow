import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, studentStatusActionSchema } from "@/lib/validations";
import type { Prisma, StudentAdmissionStatus } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = validate(studentStatusActionSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { action, note, newClassId } = parsed.data;

    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true, userId: true, classId: true, firstName: true, lastName: true, admissionNumber: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    // PROMOTE needs a target class; verify it belongs to this school.
    if (action === "PROMOTE" || (action === "TRANSFER" && newClassId)) {
      if (!newClassId) {
        return NextResponse.json({ error: "Select the target class first" }, { status: 400 });
      }
      const target = await prisma.class.findFirst({
        where: { id: newClassId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!target) return NextResponse.json({ error: "Target class not found" }, { status: 404 });
    }

    const now = new Date();
    let admissionStatus: StudentAdmissionStatus = "ACTIVE";
    let event = "";
    let isActive = true;
    const extra: Prisma.StudentUncheckedUpdateInput = {};

    switch (action) {
      case "SUSPEND":
        admissionStatus = "SUSPENDED";
        isActive = false;
        event = "Suspended";
        extra.suspendedAt = now;
        break;
      case "GRADUATE":
        admissionStatus = "GRADUATED";
        isActive = false;
        event = "Graduated";
        extra.graduatedAt = now;
        break;
      case "TRANSFER":
        admissionStatus = "TRANSFERRED";
        isActive = false;
        event = "Transferred";
        extra.transferredAt = now;
        extra.classId = newClassId ?? null;
        break;
      case "PROMOTE":
        admissionStatus = "ACTIVE";
        isActive = true;
        event = "Promoted";
        extra.promotedAt = now;
        extra.classId = newClassId ?? null;
        break;
      case "REACTIVATE":
        admissionStatus = "ACTIVE";
        isActive = true;
        event = "Reinstated";
        extra.suspendedAt = null;
        break;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.student.update({
        where: { id },
        data: { admissionStatus, isActive, ...extra },
      });
      if (student.userId) {
        await tx.user.update({ where: { id: student.userId }, data: { isActive } });
      }
      await tx.studentTimeline.create({
        data: {
          studentId: id,
          event,
          note: note || `${action} by school admin`,
        },
      });
      return result;
    });

    return NextResponse.json({ student: updated, event });
  } catch (error) {
    console.error("Failed to apply student status action:", error);
    return NextResponse.json({ error: "Failed to apply status action" }, { status: 500 });
  }
}
