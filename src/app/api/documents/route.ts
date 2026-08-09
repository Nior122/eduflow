import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, documentUploadSchema } from "@/lib/validations";
import { saveUpload } from "@/lib/uploads";
import { logActivity } from "@/lib/notifications";
import type { DocumentCategory, UserRole } from "@prisma/client";

const UPLOADER_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "FINANCE_OFFICER"];
const VIEWER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"];

const AUDIENCE_ROLES: Record<string, UserRole[]> = {
  ALL: ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"],
  TEACHERS: ["TEACHER"],
  PARENTS: ["PARENT"],
  STUDENTS: ["STUDENT"],
  STAFF: ["TEACHER", "FINANCE_OFFICER", "SCHOOL_ADMIN", "SUPER_ADMIN"],
};

/**
 * GET /api/documents?category=&q=&limit= — school document library,
 * filtered by the current user's role audience permission.
 */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, VIEWER_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session!.user!.schoolId!;
  const role = session!.user!.role;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 300);

  const documents = await prisma.schoolDocument.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(category ? { category: category as DocumentCategory } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: { uploader: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const visible = documents.filter((d) => {
    const allowed = AUDIENCE_ROLES[d.audience] ?? AUDIENCE_ROLES.ALL;
    return allowed.includes(role);
  });

  return NextResponse.json({
    documents: visible.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      category: d.category,
      audience: d.audience,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      uploader: d.uploader ? { id: d.uploader.id, name: d.uploader.name ?? "Unknown" } : null,
      createdAt: d.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/documents — upload a school document (teachers & admins).
 * Multipart form: title, description, category, audience, file.
 */
export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, UPLOADER_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session!.user!.schoolId!;
  const userId = session!.user!.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const parsed = validate(
    documentUploadSchema,
    Object.fromEntries(["title", "description", "category", "audience"].map((k) => [k, form.get(k) ?? undefined]))
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  try {
    const saved = await saveUpload(file, { folder: "documents" });
    const doc = await prisma.schoolDocument.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        category: parsed.data.category,
        audience: parsed.data.audience,
        fileName: saved.fileName,
        fileUrl: saved.url,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        schoolId,
        uploaderId: userId,
      },
    });

    await logActivity({
      userId,
      schoolId,
      action: "DOCUMENT_UPLOADED",
      entityType: "SchoolDocument",
      entityId: doc.id,
      metadata: { title: doc.title, category: doc.category },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
