import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const student = await prisma.student.findUnique({
    where: { id: session.user.studentId },
    include: { class: true, attendances: true, results: true },
  });

  if (!student) return NextResponse.json({ name: null, class: null, avgScore: 0, attendance: 0 });

  const totals = student.results.map(r => Number(r.total)).filter(t => !isNaN(t));
  const avgScore = totals.length > 0 ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  const attendance = student.attendances.length > 0
    ? Math.round((student.attendances.filter(a => a.status === "PRESENT").length / student.attendances.length) * 100) : 0;

  return NextResponse.json({
    name: `${student.firstName} ${student.lastName}`,
    class: student.class?.name || null,
    avgScore,
    attendance,
  });
}
