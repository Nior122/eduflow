import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const TEACHER_ROLES = ["TEACHER"] as const;

/** GET /api/teacher/my-classes — classes+subjects the teacher is assigned to. */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, TEACHER_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const teacherId = session?.user?.teacherId;
  if (!teacherId) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });

  const [classSubjects, assignments] = await Promise.all([
    prisma.classSubject.findMany({
      where: { teacherId },
      include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
    }),
    prisma.teacherAssignment.findMany({
      where: { teacherId },
      include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
    }),
  ]);

  const seen = new Set<string>();
  const items: { classId: string; className: string; subjectId: string; subjectName: string }[] = [];
  for (const c of classSubjects) {
    const key = c.classId + ":" + c.subjectId;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ classId: c.classId, className: c.class.name, subjectId: c.subjectId, subjectName: c.subject.name });
  }
  for (const a of assignments) {
    const key = a.classId + ":" + a.subjectId;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ classId: a.classId, className: a.class.name, subjectId: a.subjectId, subjectName: a.subject.name });
  }

  return NextResponse.json({ classes: items });
}
