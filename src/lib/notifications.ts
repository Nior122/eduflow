import { prisma } from "./db";
import type { Prisma, UserRole } from "@prisma/client";

/**
 * PHASE 6 — Notifications & activity logging helpers.
 * Single source of truth so every route creates Notification rows and
 * UserActivityLog rows consistently. Failures are swallowed (logging must
 * never break the primary action).
 */

const NOTIFICATION_TYPES = new Set([
  "INFO", "SUCCESS", "WARNING", "ERROR", "MESSAGE", "ASSIGNMENT",
  "ATTENDANCE", "RESULT", "FEE", "PAYMENT", "ANNOUNCEMENT", "EVENT",
]);

export async function notifyUser(opts: {
  userId: string;
  schoolId?: string | null;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
}): Promise<void> {
  const type = opts.type && NOTIFICATION_TYPES.has(opts.type) ? opts.type : "INFO";
  try {
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        schoolId: opts.schoolId ?? null,
        title: opts.title,
        message: opts.message,
        type,
        link: opts.link ?? null,
      },
    });
  } catch (error) {
    console.error("notifyUser failed:", error);
  }
}

export async function logActivity(opts: {
  userId: string;
  schoolId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.userActivityLog.create({
      data: {
        userId: opts.userId,
        schoolId: opts.schoolId ?? null,
        action: opts.action,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        metadata: opts.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("logActivity failed:", error);
  }
}

// ─── Announcement visibility & fan-out ───────────────────────────────

export type AnnouncementLike = {
  audience: string;
  targetClassId: string | null;
  targetDepartmentId: string | null;
  published: boolean;
  expiresAt: Date | null;
};

export type AnnouncementActor = {
  role: UserRole;
  classIds: string[];
  departmentIds: string[];
};

/** True when `a` may be seen by the actor (role + class/department scoping). */
export function announcementVisibleTo(a: AnnouncementLike, actor: AnnouncementActor): boolean {
  if (a.expiresAt && a.expiresAt.getTime() < Date.now()) return false;
  const isAdmin = actor.role === "SCHOOL_ADMIN" || actor.role === "SUPER_ADMIN";
  if (!a.published) return isAdmin;

  const audience = (a.audience || "ALL").toUpperCase();
  switch (audience) {
    case "ALL":
      return true;
    case "TEACHERS":
      return actor.role === "TEACHER" || isAdmin;
    case "PARENTS":
      return actor.role === "PARENT" || isAdmin;
    case "STUDENTS":
      return actor.role === "STUDENT" || isAdmin;
    case "STAFF":
      return actor.role === "TEACHER" || actor.role === "FINANCE_OFFICER" || isAdmin;
    case "CLASS":
      return isAdmin || (a.targetClassId != null && actor.classIds.includes(a.targetClassId));
    case "DEPARTMENT":
      return isAdmin || (a.targetDepartmentId != null && actor.departmentIds.includes(a.targetDepartmentId));
    default:
      return true;
  }
}

type AnnouncementForFanOut = {
  id: string;
  schoolId: string;
  audience: string;
  targetClassId: string | null;
  targetDepartmentId: string | null;
  title: string;
  content: string;
};

/**
 * Push an Announcement to the in-app Notification center of every user it
 * targets (school scale: capped at 1000 rows per fan-out).
 */
export async function fanOutAnnouncement(a: AnnouncementForFanOut): Promise<void> {
  const audience = (a.audience || "ALL").toUpperCase();
  const notify = (userIds: string[]) =>
    prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        schoolId: a.schoolId,
        title: a.title,
        message: a.content.length > 160 ? `${a.content.slice(0, 160)}…` : a.content,
        type: "ANNOUNCEMENT",
        link: "/announcements",
      })),
      skipDuplicates: true,
    });

  try {
    if (audience === "CLASS" && a.targetClassId) {
      const [students, classSubjects] = await Promise.all([
        prisma.student.findMany({
          where: { schoolId: a.schoolId, classId: a.targetClassId, isActive: true },
          select: { id: true, parentId: true },
        }),
        prisma.classSubject.findMany({
          where: { classId: a.targetClassId },
          select: { teacherId: true },
        }),
      ]);
      const parentIds = [...new Set(students.map((s) => s.parentId).filter((p): p is string => !!p))];
      const teacherIds = [...new Set(classSubjects.map((cs) => cs.teacherId).filter((t): t is string => !!t))];
      const users = await prisma.user.findMany({
        where: {
          schoolId: a.schoolId,
          isActive: true,
          OR: [
            { student: { id: { in: students.map((s) => s.id) } } },
            { parent: { id: { in: parentIds } } },
            { teacher: { id: { in: teacherIds } } },
          ],
        },
        select: { id: true },
        take: 1000,
      });
      await notify(users.map((u) => u.id));
      return;
    }

    if (audience === "DEPARTMENT" && a.targetDepartmentId) {
      const teachers = await prisma.teacher.findMany({
        where: { schoolId: a.schoolId, departmentId: a.targetDepartmentId, isActive: true },
        select: { id: true },
      });
      const users = await prisma.user.findMany({
        where: { schoolId: a.schoolId, isActive: true, teacher: { id: { in: teachers.map((t) => t.id) } } },
        select: { id: true },
        take: 1000,
      });
      await notify(users.map((u) => u.id));
      return;
    }

    const roleFilter: Prisma.UserWhereInput["role"] | undefined =
      audience === "TEACHERS"
        ? "TEACHER"
        : audience === "PARENTS"
          ? "PARENT"
          : audience === "STUDENTS"
            ? "STUDENT"
            : audience === "STAFF"
              ? { in: ["TEACHER", "FINANCE_OFFICER", "SCHOOL_ADMIN", "SUPER_ADMIN"] }
              : undefined;

    const users = await prisma.user.findMany({
      where: { schoolId: a.schoolId, isActive: true, ...(roleFilter !== undefined ? { role: roleFilter } : {}) },
      select: { id: true },
      take: 1000,
    });
    await notify(users.map((u) => u.id));
  } catch (error) {
    console.error("fanOutAnnouncement failed:", error);
  }
}
