import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, announcementSchema } from "@/lib/validations";
import { fanOutAnnouncement, logActivity } from "@/lib/notifications";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const announcements = await prisma.announcement.findMany({
    where: { schoolId, isActive: true },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ announcements });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(announcementSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    if (data.audience === "CLASS" && !data.targetClassId) {
      return NextResponse.json({ error: "Select a class for class-targeted announcements" }, { status: 400 });
    }
    if (data.audience === "DEPARTMENT" && !data.targetDepartmentId) {
      return NextResponse.json({ error: "Select a department for department-targeted announcements" }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        priority: data.priority,
        audience: data.audience,
        published: true,
        pinned: data.pinned,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        targetClassId: data.targetClassId ?? null,
        targetDepartmentId: data.targetDepartmentId ?? null,
        attachmentUrl: data.attachmentUrl ?? null,
        schoolId,
        authorId: session?.user?.id ?? null,
      },
    });

    await fanOutAnnouncement({
      id: announcement.id,
      schoolId,
      audience: announcement.audience,
      targetClassId: announcement.targetClassId,
      targetDepartmentId: announcement.targetDepartmentId,
      title: announcement.title,
      content: announcement.content,
    });

    await logActivity({
      userId: session!.user!.id,
      schoolId,
      action: "ANNOUNCEMENT_CREATED",
      entityType: "Announcement",
      entityId: announcement.id,
      metadata: { title: announcement.title, audience: announcement.audience },
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Duplicate announcement" }, { status: 409 });
    }
    console.error("Failed to create announcement:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
