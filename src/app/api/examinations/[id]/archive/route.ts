import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminGuard } from "@/lib/exams/guards";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const examination = await prisma.examination.findFirst({ where: { id, schoolId } });
  if (!examination) return NextResponse.json({ error: "Examination not found" }, { status: 404 });

  const updated = await prisma.examination.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  return NextResponse.json({ examination: updated });
}
