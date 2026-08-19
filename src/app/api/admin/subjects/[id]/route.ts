import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, subjectUpdateSchema } from "@/lib/validations";
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
    const parsed = validate(subjectUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const updateData: Prisma.SubjectUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code ?? null }),
      ...(data.category !== undefined && { category: data.category ?? null }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId ?? null }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.passMark !== undefined && { passMark: data.passMark }),
      ...(data.creditUnit !== undefined && { creditUnit: data.creditUnit }),
    };
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const subject = await prisma.subject.update({ where: { id }, data: updateData });
    return NextResponse.json({ subject });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return NextResponse.json({ error: "Subject not found" }, { status: 404 });
      if (error.code === "P2002") {
        return NextResponse.json({ error: "A subject with this name already exists" }, { status: 409 });
      }
    }
    console.error("Failed to update subject:", error);
    return NextResponse.json({ error: "Failed to update subject" }, { status: 500 });
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
    const existing = await prisma.subject.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

    await prisma.subject.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete subject:", error);
    return NextResponse.json({ error: "Failed to delete subject" }, { status: 500 });
  }
}
