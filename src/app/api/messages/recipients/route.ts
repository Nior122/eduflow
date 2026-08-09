import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MESSAGE_ROLES } from "@/lib/messages";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN"];

type Recipient = { id: string; name: string; role: string; label: string };

/**
 * GET /api/messages/recipients?q= — searchable address book scoped to the
 * messaging rules of the current role:
 *   admin   → everyone in the school
 *   teacher → admins + parents & students of my classes
 *   parent  → admins + teachers of my children's classes
 *   student → admins + teachers of my class
 */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, MESSAGE_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const userId = session!.user!.id;
  const schoolId = session!.user!.schoolId!;
  const role = session!.user!.role;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const nameWhere = q ? { name: { contains: q, mode: "insensitive" as const } } : {};

  try {
    let recipients: Recipient[] = [];

    if (role === "TEACHER" && session!.user!.teacherId) {
      const classSubjects = await prisma.classSubject.findMany({
        where: { teacherId: session!.user!.teacherId },
        select: { classId: true },
      });
      const classIds = [...new Set(classSubjects.map((c) => c.classId))];
      const [students, admins] = await Promise.all([
        prisma.student.findMany({
          where: { schoolId, classId: { in: classIds }, isActive: true },
          select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } },
        }),
        prisma.user.findMany({
          where: { schoolId, role: { in: ADMIN_ROLES }, id: { not: userId }, ...nameWhere },
          select: { id: true, name: true, role: true },
        }),
      ]);
      const studentIds = students.map((s) => s.id);
      const [parentUsers, studentUsers] = await Promise.all([
        prisma.user.findMany({
          where: {
            schoolId,
            role: "PARENT",
            parent: { children: { some: { id: { in: studentIds } } } },
            ...nameWhere,
          },
          select: {
            id: true,
            name: true,
            role: true,
            parent: { select: { children: { select: { firstName: true, lastName: true }, take: 1 } } },
          },
        }),
        prisma.user.findMany({
          where: { schoolId, role: "STUDENT", student: { id: { in: studentIds } }, ...nameWhere },
          select: {
            id: true,
            name: true,
            role: true,
            student: { select: { firstName: true, lastName: true, class: { select: { name: true } } } },
          },
        }),
      ]);
      recipients.push(...admins.map((u) => ({ id: u.id, name: u.name ?? "", role: u.role, label: "Administrator" })));
      recipients.push(
        ...parentUsers.map((u) => ({
          id: u.id,
          name: u.name ?? "",
          role: u.role,
          label: u.parent?.children[0]
            ? `Parent of ${u.parent.children[0].firstName} ${u.parent.children[0].lastName}`
            : "Parent",
        }))
      );
      recipients.push(
        ...studentUsers.map((u) => ({
          id: u.id,
          name: u.name ?? "",
          role: u.role,
          label: u.student?.class ? `Student · ${u.student.class.name}` : "Student",
        }))
      );
    } else if (role === "PARENT" && session!.user!.parentId) {
      const children = await prisma.student.findMany({
        where: { parentId: session!.user!.parentId, schoolId, isActive: true },
        select: { id: true, classId: true, firstName: true, lastName: true },
      });
      const classIds = [...new Set(children.map((c) => c.classId).filter((c): c is string => !!c))];
      const classSubjects = classIds.length
        ? await prisma.classSubject.findMany({ where: { classId: { in: classIds } }, select: { teacherId: true } })
        : [];
      const teacherIds = [...new Set(classSubjects.map((c) => c.teacherId).filter((t): t is string => !!t))];
      const [teachers, admins] = await Promise.all([
        prisma.user.findMany({
          where: { schoolId, role: "TEACHER", teacher: { id: { in: teacherIds } }, ...nameWhere },
          select: {
            id: true,
            name: true,
            role: true,
            teacher: {
              select: {
                firstName: true,
                lastName: true,
                classSubjects: { select: { subject: { select: { name: true } } }, take: 1 },
              },
            },
          },
        }),
        prisma.user.findMany({
          where: { schoolId, role: { in: ADMIN_ROLES }, id: { not: userId }, ...nameWhere },
          select: { id: true, name: true, role: true },
        }),
      ]);
      recipients.push(...admins.map((u) => ({ id: u.id, name: u.name ?? "", role: u.role, label: "Administrator" })));
      recipients.push(
        ...teachers.map((u) => ({
          id: u.id,
          name: u.name ?? "",
          role: u.role,
          label: u.teacher?.classSubjects[0]?.subject.name
            ? `Teacher · ${u.teacher.classSubjects[0].subject.name}`
            : "Teacher",
        }))
      );
    } else if (role === "STUDENT" && session!.user!.studentId) {
      const me = await prisma.student.findUnique({
        where: { id: session!.user!.studentId },
        select: { classId: true },
      });
      const classSubjects = me?.classId
        ? await prisma.classSubject.findMany({ where: { classId: me.classId }, select: { teacherId: true } })
        : [];
      const teacherIds = [...new Set(classSubjects.map((c) => c.teacherId).filter((t): t is string => !!t))];
      const [teachers, admins] = await Promise.all([
        prisma.user.findMany({
          where: { schoolId, role: "TEACHER", teacher: { id: { in: teacherIds } }, ...nameWhere },
          select: {
            id: true,
            name: true,
            role: true,
            teacher: {
              select: {
                firstName: true,
                lastName: true,
                classSubjects: { select: { subject: { select: { name: true } } }, take: 1 },
              },
            },
          },
        }),
        prisma.user.findMany({
          where: { schoolId, role: { in: ADMIN_ROLES }, id: { not: userId }, ...nameWhere },
          select: { id: true, name: true, role: true },
        }),
      ]);
      recipients.push(...admins.map((u) => ({ id: u.id, name: u.name ?? "", role: u.role, label: "Administrator" })));
      recipients.push(
        ...teachers.map((u) => ({
          id: u.id,
          name: u.name ?? "",
          role: u.role,
          label: u.teacher?.classSubjects[0]?.subject.name
            ? `Teacher · ${u.teacher.classSubjects[0].subject.name}`
            : "Teacher",
        }))
      );
    } else {
      // Admins / finance officers: everyone in the school.
      const users = await prisma.user.findMany({
        where: {
          schoolId,
          id: { not: userId },
          role: { in: ["TEACHER", "PARENT", "STUDENT", ...ADMIN_ROLES, "FINANCE_OFFICER"] },
          ...nameWhere,
        },
        select: { id: true, name: true, role: true },
        take: 100,
      });
      const roleLabels: Record<string, string> = {
        TEACHER: "Teacher",
        PARENT: "Parent",
        STUDENT: "Student",
        FINANCE_OFFICER: "Finance Officer",
        SCHOOL_ADMIN: "Administrator",
        SUPER_ADMIN: "Administrator",
      };
      recipients = users.map((u) => ({
        id: u.id,
        name: u.name ?? "",
        role: u.role,
        label: roleLabels[u.role] ?? u.role,
      }));
    }

    // De-duplicate + sort.
    const seen = new Set<string>();
    const unique = recipients.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    unique.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ recipients: unique.slice(0, 100) });
  } catch (error) {
    console.error("Failed to load recipients:", error);
    return NextResponse.json({ error: "Failed to load recipients" }, { status: 500 });
  }
}
