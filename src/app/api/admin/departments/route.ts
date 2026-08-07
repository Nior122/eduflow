import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, departmentSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const departments = await prisma.department.findMany({
    where: { schoolId, isActive: true },
    include: {
      headTeacher: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { teachers: true, subjects: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ departments });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(departmentSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    if (data.headTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: data.headTeacherId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        code: data.code ?? null,
        description: data.description ?? null,
        headTeacherId: data.headTeacherId ?? null,
        schoolId,
      },
    });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 });
    }
    console.error("Failed to create department:", error);
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}
