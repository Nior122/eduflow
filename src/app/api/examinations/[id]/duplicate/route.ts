import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminGuard } from "@/lib/exams/guards";

/** Duplicate an examination (new id, same metadata + classes, DRAFT status). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const source = await prisma.examination.findFirst({
    where: { id, schoolId },
    include: { classes: true },
  });
  if (!source) return NextResponse.json({ error: "Examination not found" }, { status: 404 });

  const base = source.name.replace(/\s*\(copy\)\s*$/i, "");
  const name = `${base} (copy)`;

  try {
    const copy = await prisma.examination.create({
      data: {
        name,
        type: source.type,
        description: source.description,
        status: "DRAFT",
        startDate: source.startDate,
        endDate: source.endDate,
        schoolId,
        sessionId: source.sessionId,
        termId: source.termId,
        createdById: g.session?.user?.id ?? null,
        classes: { create: source.classes.map((c) => ({ classId: c.classId })) },
      },
      include: { classes: true },
    });
    return NextResponse.json({ examination: copy }, { status: 201 });
  } catch (error) {
    console.error("Failed to duplicate examination:", error);
    return NextResponse.json({ error: "Failed to duplicate examination" }, { status: 500 });
  }
}
