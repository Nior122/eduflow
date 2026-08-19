import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, examinationSchema } from "@/lib/validations";
import { adminGuard } from "@/lib/exams/guards";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");
  const status = searchParams.get("status");

  const where: Prisma.ExaminationWhereInput = { schoolId };
  if (sessionId) where.sessionId = sessionId;
  if (termId) where.termId = termId;
  if (status) where.status = status as Prisma.ExaminationWhereInput["status"];

  const examinations = await prisma.examination.findMany({
    where,
    include: {
      session: { select: { name: true } },
      term: { select: { name: true } },
      classes: { include: { class: { select: { id: true, name: true } } } },
      _count: { select: { scores: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ examinations });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(examinationSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    // Validate session/term belong to this school.
    const term = await prisma.academicTerm.findFirst({
      where: { id: data.termId, sessionId: data.sessionId, OR: [{ schoolId }, { schoolId: null }] },
    });
    if (!term) {
      return NextResponse.json({ error: "Session or term not found" }, { status: 404 });
    }

    const examination = await prisma.examination.create({
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        schoolId,
        sessionId: data.sessionId,
        termId: data.termId,
        createdById: g.session?.user?.id ?? null,
        classes: data.classIds?.length
          ? { create: data.classIds.map((classId) => ({ classId })) }
          : undefined,
      },
      include: { classes: true },
    });

    return NextResponse.json({ examination }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An examination with this name already exists for this session/term" }, { status: 409 });
    }
    console.error("Failed to create examination:", error);
    return NextResponse.json({ error: "Failed to create examination" }, { status: 500 });
  }
}
