import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const subjectId = searchParams.get("subjectId");
  const term = searchParams.get("term");

  const where: Record<string, unknown> = { class: { schoolId: session.user.schoolId } };
  if (classId) where.classId = classId;
  if (subjectId) where.subjectId = subjectId;
  if (term) where.term = term;

  const results = await prisma.result.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      subject: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ student: { lastName: "asc" } }, { subject: { name: "asc" } }],
  });

  return NextResponse.json({ results });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { studentId, classId, subjectId, term, session: sessionYear, assignment, test, exam } = body;

    const total = (assignment || 0) + (test || 0) + (exam || 0);
    const grade = total >= 75 ? "A" : total >= 65 ? "B" : total >= 55 ? "C" : total >= 45 ? "D" : total >= 40 ? "E" : "F";

    const result = await prisma.result.upsert({
      where: { studentId_subjectId_term_session: { studentId, subjectId, term, session: sessionYear } },
      update: { assignment: assignment || 0, test: test || 0, exam: exam || 0, total, grade, teacherId: session.user.teacherId || null },
      create: { studentId, classId, subjectId, term, session: sessionYear, assignment: assignment || 0, test: test || 0, exam: exam || 0, total, grade, teacherId: session.user.teacherId || null },
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to save result" }, { status: 500 });
  }
}
