import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, announcementSchema } from "@/lib/validations";
import { announcementVisibleTo, fanOutAnnouncement, logActivity } from "@/lib/notifications";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;
const VIEWER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"];

/**
 * GET /api/announcements — role-aware announcement feed for every portal.
 * Admins see unpublished/expired items too; everyone else only sees what
 * targets them (role, class, department).
 */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, VIEWER_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session!.user!.schoolId!;
  const role = session!.user!.role;
  const userId = session!.user!.id;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);

  // Actor context: classes I belong to (student's class, parent's children,
  // teacher's classes) and departments (teacher).
  let classIds: string[] = [];
  let departmentIds: string[] = [];
  if (role === "STUDENT" && session!.user!.studentId) {
    const s = await prisma.student.findUnique({
      where: { id: session!.user!.studentId },
      select: { classId: true },
    });
    if (s?.classId) classIds = [s.classId];
  } else if (role === "PARENT" && session!.user!.parentId) {
    const children = await prisma.student.findMany({
      where: { parentId: session!.user!.parentId, schoolId, isActive: true },
      select: { classId: true },
    });
    classIds = [...new Set(children.map((c) => c.classId).filter((c): c is string => !!c))];
  } else if (role === "TEACHER" && session!.user!.teacherId) {
    const [cs, t] = await Promise.all([
      prisma.classSubject.findMany({
        where: { teacherId: session!.user!.teacherId },
        select: { classId: true },
      }),
      prisma.teacher.findUnique({
        where: { id: session!.user!.teacherId },
        select: { departmentId: true },
      }),
    ]);
    classIds = [...new Set(cs.map((c) => c.classId))];
    if (t?.departmentId) departmentIds = [t.departmentId];
  }

  const announcements = await prisma.announcement.findMany({
    where: { schoolId, isActive: true },
    include: {
      author: { select: { name: true } },
      targetClass: { select: { name: true } },
      targetDepartment: { select: { name: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const visible = announcements
    .filter((a) => announcementVisibleTo(a, { role, classIds, departmentIds }))
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      priority: a.priority,
      audience: a.audience,
      published: a.published,
      pinned: a.pinned,
      expiresAt: a.expiresAt?.toISOString() ?? null,
      isExpired: a.expiresAt ? a.expiresAt.getTime() < Date.now() : false,
      attachmentUrl: a.attachmentUrl,
      targetClass: a.targetClass ? { id: a.targetClass.id, name: a.targetClass.name } : null,
      targetDepartment: a.targetDepartment ? { id: a.targetDepartment.id, name: a.targetDepartment.name } : null,
      author: a.author ? { id: a.author.id, name: a.author.name ?? "Unknown" } : null,
      createdAt: a.createdAt.toISOString(),
    }));

  return NextResponse.json({ announcements: visible });
}

/**
 * POST /api/announcements — publish an announcement (admin only) with
 * audience targeting (role / class / department), pinning and expiry,
 * then fan it out to the in-app notification center of every recipient.
 */
export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session!.user!.schoolId!;
  const userId = session!.user!.id;

  const body = await req.json().catch(() => null);
  const parsed = validate(announcementSchema, body ?? {});
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

  try {
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
        authorId: userId,
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
      userId,
      schoolId,
      action: "ANNOUNCEMENT_CREATED",
      entityType: "Announcement",
      entityId: announcement.id,
      metadata: { title: announcement.title, audience: announcement.audience },
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    console.error("Failed to create announcement:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
