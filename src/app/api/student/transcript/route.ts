import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { averageScore } from "@/lib/portal";

const STUDENT_ROLES = ["STUDENT"] as const;

/**
 * GET /api/student/transcript — academic transcript summary derived from
 * published results (per session/term), plus the official transcript record.
 */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, STUDENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const studentId = session?.user?.studentId;
  if (!studentId) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

  const [results, transcript] = await Promise.all([
    prisma.result.findMany({
      where: { studentId, status: { in: ["PUBLISHED", "LOCKED"] } },
      include: {
        subject: { select: { name: true } },
        academicSession: { select: { name: true } },
        academicTerm: { select: { name: true } },
      },
      orderBy: [
        { academicSession: { name: "asc" } },
        { academicTerm: { name: "asc" } },
        { subject: { name: "asc" } },
      ],
    }),
    prisma.transcript.findUnique({ where: { studentId }, select: { lastGeneratedAt: true } }),
  ]);

  // Group published results into session/term blocks (null-safe: legacy rows
  // carry only the scalar session/term fields).
  const blocks = new Map<string, { sessionName: string; termName: string; rows: { subject: string; total: number; grade: string | null }[] }>();
  for (const r of results) {
    const sessionName = r.academicSession?.name ?? r.session;
    const termName = r.academicTerm?.name ?? String(r.term);
    const key = `${sessionName}::${termName}`;
    const block = blocks.get(key) ?? { sessionName, termName, rows: [] };
    block.rows.push({
      subject: r.subject.name,
      total: r.total == null ? 0 : Number(r.total),
      grade: r.grade,
    });
    blocks.set(key, block);
  }

  return NextResponse.json({
    transcript: transcript ? { lastGeneratedAt: transcript.lastGeneratedAt.toISOString() } : null,
    blocks: [...blocks.values()].map((b) => ({
      sessionName: b.sessionName,
      termName: b.termName,
      average: averageScore(b.rows.map((r) => r.total)),
      subjectsCount: b.rows.length,
      rows: b.rows,
    })),
  });
}
