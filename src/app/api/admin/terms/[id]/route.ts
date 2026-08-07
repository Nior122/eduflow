import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, termUpdateSchema } from "@/lib/validations";
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
    const parsed = validate(termUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.academicTerm.findFirst({
      where: { id, session: { schoolId } },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Term not found" }, { status: 404 });

    const updateData: Prisma.AcademicTermUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
    };
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const term = await prisma.academicTerm.update({ where: { id }, data: updateData });
    return NextResponse.json({ term });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Term not found" }, { status: 404 });
    }
    console.error("Failed to update term:", error);
    return NextResponse.json({ error: "Failed to update term" }, { status: 500 });
  }
}

/** Activate this term — exactly one term is active per school at a time. */
export async function POST(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const term = await prisma.academicTerm.findFirst({
      where: { id, session: { schoolId } },
      select: { id: true, sessionId: true },
    });
    if (!term) return NextResponse.json({ error: "Term not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.academicTerm.updateMany({
        where: { session: { schoolId } },
        data: { isActive: false },
      }),
      prisma.academicTerm.update({ where: { id }, data: { isActive: true } }),
      prisma.academicSession.update({ where: { id: term.sessionId }, data: { isActive: true } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to activate term:", error);
    return NextResponse.json({ error: "Failed to activate term" }, { status: 500 });
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
    const result = await prisma.academicTerm.deleteMany({
      where: { id, session: { schoolId } },
    });
    if (result.count === 0) return NextResponse.json({ error: "Term not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete term:", error);
    return NextResponse.json({ error: "Failed to delete term" }, { status: 500 });
  }
}
