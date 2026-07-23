import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const student = await prisma.student.findFirst({
      where: { id, schoolId: session.user.schoolId },
      include: {
        class: true,
        parent: true,
        attendances: { orderBy: { date: "desc" }, take: 30 },
        results: { include: { subject: true, class: true }, orderBy: { createdAt: "desc" } },
        feeRecords: { include: { fee: true }, orderBy: { createdAt: "desc" } },
        aiReports: { orderBy: { createdAt: "desc" }, take: 5 },
        performanceAnalyses: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ student });
  } catch (error) {
    console.error("Failed to fetch student:", error);
    return NextResponse.json({ error: "Failed to fetch student" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const updateData: Record<string, unknown> = { ...body };
    if (body.dateOfBirth) updateData.dateOfBirth = new Date(body.dateOfBirth);

    const student = await prisma.student.updateMany({
      where: { id, schoolId: session.user.schoolId },
      data: updateData,
    });

    return NextResponse.json({ student });
  } catch (error) {
    console.error("Failed to update student:", error);
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.student.updateMany({
      where: { id, schoolId: session.user.schoolId },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete student:", error);
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 });
  }
}
