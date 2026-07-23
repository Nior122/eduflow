import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const date = searchParams.get("date");
  const subjectId = searchParams.get("subjectId");

  const where: Record<string, unknown> = { class: { schoolId: session.user.schoolId } };
  if (classId) where.classId = classId;
  if (date) where.date = new Date(date);
  if (subjectId) where.subjectId = subjectId;

  const attendances = await prisma.attendance.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return NextResponse.json({ attendances });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { classId, date, subjectId, records } = await req.json();

    // Delete existing records for this class/date/subject
    await prisma.attendance.deleteMany({
      where: { classId, date: new Date(date), subjectId: subjectId || undefined },
    });

    // Create new records
    const attendances = await prisma.attendance.createMany({
      data: records.map((r: { studentId: string; status: string }) => ({
        studentId: r.studentId,
        classId,
        date: new Date(date),
        subjectId: subjectId || null,
        teacherId: session.user.teacherId || null,
        status: r.status,
      })),
    });

    return NextResponse.json({ attendances }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 });
  }
}
