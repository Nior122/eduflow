import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, teacherUpdateSchema } from "@/lib/validations";
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
    const teacher = await prisma.teacher.findFirst({
      where: { id, schoolId, isActive: true },
      include: {
        classSubjects: {
          include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
        },
        department: { select: { id: true, name: true } },
        _count: { select: { attendances: true, results: true, lessonPlans: true } },
      },
    });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    return NextResponse.json({ teacher });
  } catch (error) {
    console.error("Failed to fetch teacher:", error);
    return NextResponse.json({ error: "Failed to fetch teacher" }, { status: 500 });
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
    const parsed = validate(teacherUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.teacher.findFirst({
      where: { id, schoolId },
      select: { id: true, userId: true, email: true },
    });
    if (!existing) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

    if (data.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: data.departmentId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!dept) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const updateData: Prisma.TeacherUpdateInput = {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone ?? null }),
      ...(data.address !== undefined && { address: data.address ?? null }),
      ...(data.qualification !== undefined && { qualification: data.qualification ?? null }),
      ...(data.specialization !== undefined && { specialization: data.specialization ?? null }),
      ...(data.employeeDate !== undefined && { employeeDate: data.employeeDate ? new Date(data.employeeDate) : null }),
      ...(data.staffId !== undefined && { staffId: data.staffId ?? null }),
      ...(data.yearsOfExperience !== undefined && { yearsOfExperience: data.yearsOfExperience }),
      ...(data.salaryGrade !== undefined && { salaryGrade: data.salaryGrade ?? null }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId ?? null }),
    };

    if (data.email !== undefined && data.email && data.email !== existing.email && existing.userId) {
      await prisma.user.update({ where: { id: existing.userId }, data: { email: data.email } });
      updateData.email = data.email;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const teacher = await prisma.teacher.update({ where: { id }, data: updateData });
    return NextResponse.json({ teacher });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A teacher with this email or staff ID already exists" },
          { status: 409 }
        );
      }
    }
    console.error("Failed to update teacher:", error);
    return NextResponse.json({ error: "Failed to update teacher" }, { status: 500 });
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
    const existing = await prisma.teacher.findFirst({
      where: { id, schoolId },
      select: { id: true, userId: true },
    });
    if (!existing) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.teacher.update({ where: { id }, data: { isActive: false } }),
      ...(existing.userId
        ? [prisma.user.update({ where: { id: existing.userId }, data: { isActive: false } })]
        : []),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete teacher:", error);
    return NextResponse.json({ error: "Failed to delete teacher" }, { status: 500 });
  }
}
