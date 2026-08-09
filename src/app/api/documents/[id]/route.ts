import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, documentUpdateSchema } from "@/lib/validations";
import { deleteUpload } from "@/lib/uploads";
import { logActivity } from "@/lib/notifications";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];
const VIEWER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"];

const AUDIENCE_ROLES: Record<string, UserRole[]> = {
  ALL: ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"],
  TEACHERS: ["TEACHER"],
  PARENTS: ["PARENT"],
  STUDENTS: ["STUDENT"],
  STAFF: ["TEACHER", "FINANCE_OFFICER", "SCHOOL_ADMIN", "SUPER_ADMIN"],
};

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/documents/[id] — single document (audience-permission checked). */
export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, VIEWER_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session!.user!.schoolId!;
  const role = session!.user!.role;

  const { id } = await params;
  const doc = await prisma.schoolDocument.findFirst({
    where: { id, schoolId, isActive: true },
    include: { uploader: { select: { name: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const allowed = AUDIENCE_ROLES[doc.audience] ?? AUDIENCE_ROLES.ALL;
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      audience: doc.audience,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      uploader: doc.uploader ? { id: doc.uploader.id, name: doc.uploader.name ?? "Unknown" } : null,
      createdAt: doc.createdAt.toISOString(),
    },
  });
}

/** PATCH /api/documents/[id] — update metadata (admin or uploader). */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, VIEWER_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session!.user!.schoolId!;
  const userId = session!.user!.id;
  const role = session!.user!.role;

  const { id } = await params;
  const doc = await prisma.schoolDocument.findFirst({
    where: { id, schoolId, isActive: true },
    select: { id: true, uploaderId: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
  if (!isAdmin && doc.uploaderId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = validate(documentUpdateSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const updated = await prisma.schoolDocument.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.category !== undefined && { category: parsed.data.category }),
      ...(parsed.data.audience !== undefined && { audience: parsed.data.audience }),
    },
  });

  await logActivity({
    userId,
    schoolId,
    action: "DOCUMENT_UPDATED",
    entityType: "SchoolDocument",
    entityId: id,
  });

  return NextResponse.json({ document: updated });
}

/** DELETE /api/documents/[id] — remove document + stored file (admin or uploader). */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  const denied = requireRole(session, VIEWER_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session!.user!.schoolId!;
  const userId = session!.user!.id;
  const role = session!.user!.role;

  const { id } = await params;
  const doc = await prisma.schoolDocument.findFirst({
    where: { id, schoolId },
    select: { id: true, uploaderId: true, fileUrl: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
  if (!isAdmin && doc.uploaderId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteUpload(doc.fileUrl);
  await prisma.schoolDocument.delete({ where: { id } });

  await logActivity({
    userId,
    schoolId,
    action: "DOCUMENT_DELETED",
    entityType: "SchoolDocument",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
