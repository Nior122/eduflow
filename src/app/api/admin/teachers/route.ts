import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teachers = await prisma.teacher.findMany({
    where: { schoolId: session.user.schoolId, isActive: true },
    include: {
      classSubjects: {
        include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
      },
      _count: { select: { attendances: true, results: true, lessonPlans: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ teachers });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const teacher = await prisma.teacher.create({
      data: {
        ...body,
        schoolId: session.user.schoolId,
        employeeDate: body.employeeDate ? new Date(body.employeeDate) : new Date(),
      },
    });
    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create teacher" }, { status: 500 });
  }
}
