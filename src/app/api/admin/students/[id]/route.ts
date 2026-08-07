import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, studentUpdateSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      include: {
        class: true,
        parent: true,
        attendances: { orderBy: { date: "desc" }, take: 30 },
        results: { include: { subject: true, class: true }, orderBy: { createdAt: "desc" } },
        feeRecords: { include: { fee: true }, orderBy: { createdAt: "desc" } },
        aiReports: { orderBy: { createdAt: "desc" }, take: 5 },
        performanceAnalyses: { orderBy: { createdAt: "desc" }, take: 5 },
        timeline: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ student });
  } catch (error) {
    console.error("Failed to fetch student:", error);
    return NextResponse.json({ error: "Failed to fetch student" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = validate(studentUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true, userId: true, email: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const updateData: Prisma.StudentUpdateInput = {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.middleName !== undefined && { middleName: data.middleName ?? null }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.bloodGroup !== undefined && { bloodGroup: data.bloodGroup ?? null }),
      ...(data.religion !== undefined && { religion: data.religion ?? null }),
      ...(data.nationality !== undefined && { nationality: data.nationality ?? null }),
      ...(data.state !== undefined && { state: data.state ?? null }),
      ...(data.lga !== undefined && { lga: data.lga ?? null }),
      ...(data.address !== undefined && { address: data.address ?? null }),
      ...(data.phone !== undefined && { phone: data.phone ?? null }),
      ...(data.admissionNumber !== undefined && { admissionNumber: data.admissionNumber }),
      ...(data.classId !== undefined && { classId: data.classId ?? null }),
      ...(data.parentId !== undefined && { parentId: data.parentId ?? null }),
      ...(data.parentRelation !== undefined && { parentRelation: data.parentRelation ?? null }),
      ...(data.emergencyContactName !== undefined && { emergencyContactName: data.emergencyContactName ?? null }),
      ...(data.emergencyContactPhone !== undefined && { emergencyContactPhone: data.emergencyContactPhone ?? null }),
      ...(data.previousSchool !== undefined && { previousSchool: data.previousSchool ?? null }),
      ...(data.medicalInfo !== undefined && { medicalInfo: data.medicalInfo ?? null }),
      ...(data.disabilities !== undefined && { disabilities: data.disabilities ?? null }),
      ...(data.admissionStatus !== undefined && { admissionStatus: data.admissionStatus }),
    };

    // Keep the linked login account's email in sync when it changes.
    if (data.email !== undefined && data.email && data.email !== existing.email && existing.userId) {
      await prisma.user.update({ where: { id: existing.userId }, data: { email: data.email } });
      updateData.email = data.email;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const student = await prisma.student.update({ where: { id }, data: updateData });
    return NextResponse.json({ student });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A student with this admission number already exists" },
          { status: 409 }
        );
      }
    }
    console.error("Failed to update student:", error);
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Soft-delete the student, deactivate their login, and log it.
    await prisma.$transaction([
      prisma.student.update({
        where: { id },
        data: { isActive: false, admissionStatus: "WITHDRAWN" },
      }),
      ...(existing.userId
        ? [prisma.user.update({ where: { id: existing.userId }, data: { isActive: false } })]
        : []),
      prisma.studentTimeline.create({
        data: { studentId: id, event: "Withdrawn", note: "Student removed by school admin" },
      }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete student:", error);
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 });
  }
}
