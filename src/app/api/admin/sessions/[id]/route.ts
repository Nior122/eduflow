import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, sessionUpdateSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

const sessionPatchSchema = sessionUpdateSchema.extend({
  isActive: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

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
    const parsed = validate(sessionPatchSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { isActive, isLocked, isArchived, ...fields } = parsed.data;

    const existing = await prisma.academicSession.findFirst({
      where: { id, schoolId },
      select: { id: true, isActive: true },
    });
    if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const updateData: Prisma.AcademicSessionUpdateInput = {
      ...(fields.name !== undefined && { name: fields.name }),
      ...(fields.startDate !== undefined && { startDate: fields.startDate ? new Date(fields.startDate) : null }),
      ...(fields.endDate !== undefined && { endDate: fields.endDate ? new Date(fields.endDate) : null }),
      ...(isLocked !== undefined && { isLocked }),
    };

    // Activation swaps active state atomically across the school; the
    // archived flag is only settable on an inactive session.
    if (isActive === true) {
      await prisma.$transaction([
        prisma.academicSession.updateMany({
          where: { schoolId, isActive: true, id: { not: id } },
          data: { isActive: false },
        }),
        prisma.academicSession.update({ where: { id }, data: { isActive: true, isArchived: false } }),
      ]);
    } else if (isActive === false && existing.isActive) {
      return NextResponse.json(
        { error: "Deactivate the active term first (it belongs to this session)" },
        { status: 400 }
      );
    }

    if (isArchived === true) {
      if (existing.isActive) {
        return NextResponse.json({ error: "Archive an inactive session first" }, { status: 400 });
      }
      updateData.isArchived = true;
    } else if (isArchived === false) {
      updateData.isArchived = false;
    }

    const academicSession =
      isActive === true
        ? await prisma.academicSession.findFirst({ where: { id, schoolId }, include: { terms: true } })
        : await prisma.academicSession.update({ where: { id }, data: updateData });

    return NextResponse.json({ session: academicSession });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return NextResponse.json({ error: "Session not found" }, { status: 404 });
      if (error.code === "P2002") {
        return NextResponse.json({ error: "A session with this name already exists" }, { status: 409 });
      }
    }
    console.error("Failed to update session:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
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
    const existing = await prisma.academicSession.findFirst({
      where: { id, schoolId },
      select: { id: true, isActive: true, isArchived: true, _count: { select: { terms: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (existing.isActive) {
      return NextResponse.json({ error: "Deactivate the session before archiving" }, { status: 400 });
    }

    // Archive (soft delete). Sessions with no terms can be removed fully.
    if (existing._count.terms === 0 && existing.isArchived) {
      await prisma.academicSession.delete({ where: { id } });
    } else {
      await prisma.academicSession.update({ where: { id }, data: { isArchived: true } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete session:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
