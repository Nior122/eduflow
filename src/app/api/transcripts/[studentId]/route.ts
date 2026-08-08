import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth, requireRole } from "@/lib/auth";
import { buildTranscript } from "@/lib/exams/transcript";
import { ALL_ROLES } from "@/lib/exams/guards";

/**
 * GET /api/transcripts/[studentId]
 * Admins/teachers: any student. Students: own transcript. Parents: their
 * children only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  const denied = requireRole(session, ALL_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId!;
  const { studentId } = await params;

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, parentId: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const role = session?.user?.role;
  if (role === "STUDENT" && session?.user?.studentId !== studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "PARENT" && session?.user?.parentId !== student.parentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await buildTranscript(studentId);
  if (!data) return NextResponse.json({ error: "Transcript unavailable" }, { status: 404 });
  return NextResponse.json({ transcript: data });
}
