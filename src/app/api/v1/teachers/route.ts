import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardV1ApiKey } from "@/lib/saas/v1";
import { parsePagination, paginated } from "@/lib/saas/api";
import { validate, teacherSchema } from "@/lib/validations";
import { checkUsageLimit, recordUsage } from "@/lib/saas/usage";
import { queueWebhookEvent } from "@/lib/saas/webhooks";
import { provisionUser } from "@/lib/provision";
import { Prisma } from "@prisma/client";

const SAFE_SORTS = ["createdAt", "firstName", "lastName", "staffId", "email"];

/** GET /api/v1/teachers — paginated list. POST — create (plan-limited). */
export async function GET(req: Request) {
  const auth = await guardV1ApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip, take, sort, order } = parsePagination(searchParams);
  const safeSort = SAFE_SORTS.includes(sort) ? sort : "createdAt";
  const where: Record<string, unknown> = { schoolId: auth.schoolId };

  const search = searchParams.get("search");
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  const departmentId = searchParams.get("departmentId");
  if (departmentId) where.departmentId = departmentId;

  const [rows, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      orderBy: { [safeSort]: order },
      skip,
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        staffId: true,
        specialization: true,
        qualification: true,
        department: { select: { name: true } },
        createdAt: true,
      },
    }),
    prisma.teacher.count({ where }),
  ]);

  return NextResponse.json(paginated(rows, total, page, pageSize));
}

export async function POST(req: Request) {
  const auth = await guardV1ApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const limit = await checkUsageLimit(auth.schoolId, "TEACHERS", "maxTeachers");
  if (limit !== null) {
    return NextResponse.json(
      { error: `Teacher limit reached (${limit}). Upgrade your subscription.` },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = validate(teacherSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const { teacher, creds } = await prisma.$transaction(async (tx) => {
      const creds = await provisionUser(
        { email: data.email, role: "TEACHER", schoolId: auth.schoolId, name: `${data.firstName} ${data.lastName}`, phone: data.phone ?? null },
        tx
      );
      const teacher = await tx.teacher.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: creds.loginEmail,
          phone: data.phone ?? null,
          address: data.address ?? null,
          qualification: data.qualification ?? null,
          specialization: data.specialization ?? null,
          employeeDate: data.employeeDate ? new Date(data.employeeDate) : new Date(),
          staffId: data.staffId ?? null,
          yearsOfExperience: data.yearsOfExperience ?? null,
          salaryGrade: data.salaryGrade ?? null,
          departmentId: data.departmentId ?? null,
          schoolId: auth.schoolId,
          userId: creds.userId,
        },
      });
      return { teacher, creds };
    });

    await recordUsage(auth.schoolId, "TEACHERS", 1);
    await queueWebhookEvent({
      schoolId: auth.schoolId,
      event: "teacher.created",
      payload: { teacher: { id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}`, email: teacher.email } },
    });

    return NextResponse.json(
      { teacher, credentials: { email: creds.loginEmail, tempPassword: creds.tempPassword } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Teacher already exists (duplicate email or staff ID)" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create teacher" }, { status: 500 });
  }
}
