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
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {
    schoolId: session.user.schoolId,
    isActive: true,
  };

  if (classId) where.classId = classId;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { admissionNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          parent: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { attendances: true, results: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.student.count({ where }),
    ]);

    return NextResponse.json({ students, total, page, limit });
  } catch (error) {
    console.error("Failed to fetch students:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const student = await prisma.student.create({
      data: {
        ...body,
        schoolId: session.user.schoolId,
        enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate) : new Date(),
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      },
    });
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    console.error("Failed to create student:", error);
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}
