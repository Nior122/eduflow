import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, assignmentUpdateSchema } from "@/lib/validations";
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
    const parsed = validate(assignmentUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.assignment.findFirst({
      where: { id, schoolId, ...(session.user.role === "TEACHER" ? { teacherId: session.user.teacherId ?? "__none__" } : {}) },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    const updateData: Prisma.AssignmentUpdateInput = {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
      ...(data.maxScore !== undefined && { maxScore: data.maxScore }),
      ...(data.attachments !== undefined && { attachments: data.attachments ?? null }),
      ...(data.classId !== undefined && { classId: data.classId }),
      ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
    };

    const assignment = await prisma.assignment.update({ where: { id }, data: updateData });
    return NextResponse.json({ assignment });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    console.error("Failed to update assignment:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const result = await prisma.assignment.deleteMany({
    where: { id, schoolId, ...(session.user.role === "TEACHER" ? { teacherId: session.user.teacherId ?? "__none__" } : {}) },
  });
  if (result.count === 0) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
