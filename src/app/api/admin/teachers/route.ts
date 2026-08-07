import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, teacherSchema } from "@/lib/validations";
import { provisionUser } from "@/lib/provision";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const teachers = await prisma.teacher.findMany({
    where: { schoolId, isActive: true },
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
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(teacherSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    // Teacher + login account in one transaction; temp password returned once.
    const { teacher, creds } = await prisma.$transaction(async (tx) => {
      const creds = await provisionUser(
        {
          email: data.email,
          role: "TEACHER",
          schoolId,
          name: `${data.firstName} ${data.lastName}`,
          phone: data.phone ?? null,
        },
        tx
      );
      const teacher = await tx.teacher.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: creds.loginEmail,
          phone: data.phone ?? null,
          qualification: data.qualification ?? null,
          specialization: data.specialization ?? null,
          employeeDate: data.employeeDate ? new Date(data.employeeDate) : new Date(),
          schoolId,
          userId: creds.userId,
        },
      });
      return { teacher, creds };
    });

    return NextResponse.json(
      { teacher, credentials: { email: creds.loginEmail, tempPassword: creds.tempPassword } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A teacher with this email already exists" }, { status: 409 });
    }
    console.error("Failed to create teacher:", error);
    return NextResponse.json({ error: "Failed to create teacher" }, { status: 500 });
  }
}
