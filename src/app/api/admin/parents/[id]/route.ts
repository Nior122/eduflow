import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, parentUpdateSchema } from "@/lib/validations";
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

  const parent = await prisma.parent.findFirst({
    where: { id, schoolId, isActive: true },
    include: {
      children: {
        select: { id: true, firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } } },
      },
    },
  });
  if (!parent) return NextResponse.json({ error: "Parent not found" }, { status: 404 });
  return NextResponse.json({ parent });
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
    const parsed = validate(parentUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { studentIds, ...data } = parsed.data;

    const existing = await prisma.parent.findFirst({
      where: { id, schoolId },
      select: { id: true, userId: true, email: true },
    });
    if (!existing) return NextResponse.json({ error: "Parent not found" }, { status: 404 });

    const updateData: Prisma.ParentUpdateInput = {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone ?? null }),
      ...(data.occupation !== undefined && { occupation: data.occupation ?? null }),
      ...(data.address !== undefined && { address: data.address ?? null }),
    };

    if (data.email !== undefined && data.email && data.email !== existing.email && existing.userId) {
      await prisma.user.update({ where: { id: existing.userId }, data: { email: data.email } });
      updateData.email = data.email;
    }

    // Replace the linked-children set when provided.
    if (studentIds !== undefined) {
      await prisma.$transaction([
        prisma.student.updateMany({ where: { parentId: id, schoolId }, data: { parentId: null } }),
        prisma.student.updateMany({
          where: { id: { in: studentIds }, schoolId },
          data: { parentId: id },
        }),
      ]);
    }

    const parent = await prisma.parent.update({ where: { id }, data: updateData });
    return NextResponse.json({ parent });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A parent with this email already exists" }, { status: 409 });
    }
    console.error("Failed to update parent:", error);
    return NextResponse.json({ error: "Failed to update parent" }, { status: 500 });
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
    const existing = await prisma.parent.findFirst({
      where: { id, schoolId },
      select: { id: true, userId: true },
    });
    if (!existing) return NextResponse.json({ error: "Parent not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.parent.update({ where: { id }, data: { isActive: false } }),
      prisma.student.updateMany({ where: { parentId: id, schoolId }, data: { parentId: null } }),
      ...(existing.userId
        ? [prisma.user.update({ where: { id: existing.userId }, data: { isActive: false } })]
        : []),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete parent:", error);
    return NextResponse.json({ error: "Failed to delete parent" }, { status: 500 });
  }
}
