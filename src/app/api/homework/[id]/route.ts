import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, homeworkUpdateSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(homeworkUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.homework.findFirst({
      where: { id, schoolId, ...(session.user.role === "TEACHER" ? { teacherId: session.user.teacherId ?? "__none__" } : {}) },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

    const updateData: Prisma.HomeworkUpdateInput = {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
      ...(data.attachments !== undefined && { attachments: data.attachments ?? null }),
      ...(data.classId !== undefined && { classId: data.classId }),
      ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
    };

    const item = await prisma.homework.update({ where: { id }, data: updateData });
    return NextResponse.json({ homework: item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    }
    console.error("Failed to update homework:", error);
    return NextResponse.json({ error: "Failed to update homework" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const result = await prisma.homework.deleteMany({
    where: { id, schoolId, ...(session.user.role === "TEACHER" ? { teacherId: session.user.teacherId ?? "__none__" } : {}) },
  });
  if (result.count === 0) return NextResponse.json({ error: "Homework not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
