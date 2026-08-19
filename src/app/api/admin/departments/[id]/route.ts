import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, departmentUpdateSchema } from "@/lib/validations";
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
    const body = await parseJsonBody(req);
    const parsed = validate(departmentUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    if (data.headTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: data.headTeacherId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const updateData: Prisma.DepartmentUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code ?? null }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.headTeacherId !== undefined && { headTeacherId: data.headTeacherId }),
    };

    const department = await prisma.department.update({ where: { id }, data: updateData });
    return NextResponse.json({ department });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return NextResponse.json({ error: "Department not found" }, { status: 404 });
      if (error.code === "P2002") {
        return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 });
      }
    }
    console.error("Failed to update department:", error);
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
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
    const existing = await prisma.department.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Department not found" }, { status: 404 });

    // Unlink teachers + subjects before deactivating.
    await prisma.$transaction([
      prisma.teacher.updateMany({ where: { departmentId: id }, data: { departmentId: null } }),
      prisma.subject.updateMany({ where: { departmentId: id }, data: { departmentId: null } }),
      prisma.department.update({ where: { id }, data: { isActive: false, headTeacherId: null } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete department:", error);
    return NextResponse.json({ error: "Failed to delete department" }, { status: 500 });
  }
}
