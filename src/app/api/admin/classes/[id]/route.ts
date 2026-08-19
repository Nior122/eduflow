import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, classUpdateSchema } from "@/lib/validations";
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
    const parsed = validate(classUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.class.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const updateData: Prisma.ClassUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.section !== undefined && { section: data.section ?? null }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
    };
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const cls = await prisma.class.update({ where: { id }, data: updateData });
    return NextResponse.json({ class: cls });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return NextResponse.json({ error: "Class not found" }, { status: 404 });
      if (error.code === "P2002") {
        return NextResponse.json({ error: "A class with this name already exists" }, { status: 409 });
      }
    }
    console.error("Failed to update class:", error);
    return NextResponse.json({ error: "Failed to update class" }, { status: 500 });
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
    const existing = await prisma.class.findFirst({
      where: { id, schoolId },
      select: { id: true, _count: { select: { students: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    await prisma.class.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete class:", error);
    return NextResponse.json({ error: "Failed to delete class" }, { status: 500 });
  }
}
