import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, libraryCategorySchema } from "@/lib/validations";
import { logActivity } from "@/lib/notifications";

const ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

/** PATCH /api/library/categories/[id] — rename / update a category. */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.libraryCategory.findFirst({ where: { id, schoolId } });
  if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = validate(libraryCategorySchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const category = await prisma.libraryCategory.update({
      where: { id },
      data: { name: parsed.data.name, description: parsed.data.description ?? null },
    });
    await logActivity({ userId, schoolId, action: "LIBRARY_CATEGORY_UPDATED", entityType: "LibraryCategory", entityId: id });
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
  }
}

/** DELETE /api/library/categories/[id] — soft delete. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.libraryCategory.findFirst({ where: { id, schoolId } });
  if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  await prisma.libraryCategory.update({ where: { id }, data: { isActive: false } });
  await logActivity({ userId, schoolId, action: "LIBRARY_CATEGORY_DELETED", entityType: "LibraryCategory", entityId: id });
  return NextResponse.json({ ok: true });
}
