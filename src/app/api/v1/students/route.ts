import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardV1ApiKey } from "@/lib/saas/v1";
import { parsePagination, paginated } from "@/lib/saas/api";
import { validate, studentSchema } from "@/lib/validations";
import { checkUsageLimit, recordUsage } from "@/lib/saas/usage";
import { queueWebhookEvent } from "@/lib/saas/webhooks";
import { provisionUser, generateAdmissionNumber } from "@/lib/provision";
import { Prisma } from "@prisma/client";

const SAFE_SORTS = ["createdAt", "firstName", "lastName", "admissionNumber", "enrollmentDate"];

/**
 * GET /api/v1/students — paginated, filterable list.
 *   ?page=&pageSize=&sort=&order=&classId=&search=&status=
 * POST /api/v1/students — create a student (plan-limited, tenant-scoped).
 * Auth: x-api-key header.
 */
export async function GET(req: Request) {
  const auth = await guardV1ApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const { page, pageSize, skip, take, sort, order } = parsePagination(searchParams, { page: 1, pageSize: 50, max: 200 });
  const safeSort = SAFE_SORTS.includes(sort) ? sort : "createdAt";
  const where: Record<string, unknown> = { schoolId: auth.schoolId, isActive: true };

  const classId = searchParams.get("classId");
  if (classId) where.classId = classId;
  const search = searchParams.get("search");
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { admissionNumber: { contains: search, mode: "insensitive" } },
    ];
  }
  const status = searchParams.get("status");
  if (status && status !== "active") where.admissionStatus = status;

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { [safeSort]: order },
      skip,
      take,
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        gender: true,
        admissionNumber: true,
        email: true,
        phone: true,
        classId: true,
        class: { select: { name: true } },
        admissionStatus: true,
        enrollmentDate: true,
        createdAt: true,
      },
    }),
    prisma.student.count({ where }),
  ]);

  return NextResponse.json(paginated(rows, total, page, pageSize));
}

export async function POST(req: Request) {
  const auth = await guardV1ApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const limit = await checkUsageLimit(auth.schoolId, "STUDENTS", "maxStudents");
  if (limit !== null) {
    return NextResponse.json(
      { error: `Student limit reached (${limit}). Upgrade your subscription.` },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = validate(studentSchema, body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const { student, creds } = await prisma.$transaction(async (tx) => {
      const creds = await provisionUser(
        { email: data.email ?? "", role: "STUDENT", schoolId: auth.schoolId, name: `${data.firstName} ${data.lastName}`, phone: data.phone ?? null },
        tx
      );
      const student = await tx.student.create({
        data: {
          firstName: data.firstName,
          middleName: data.middleName ?? null,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender ?? null,
          address: data.address ?? null,
          phone: data.phone ?? null,
          email: creds.loginEmail,
          admissionNumber: data.admissionNumber || generateAdmissionNumber(),
          classId: data.classId ?? null,
          parentId: data.parentId ?? null,
          schoolId: auth.schoolId,
          userId: creds.userId,
        },
      });
      return { student, creds };
    });

    await recordUsage(auth.schoolId, "STUDENTS", 1);
    await queueWebhookEvent({
      schoolId: auth.schoolId,
      event: "student.created",
      payload: { student: { id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNumber: student.admissionNumber } },
    });

    return NextResponse.json(
      { student, credentials: { email: creds.loginEmail, tempPassword: creds.tempPassword } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Student already exists (duplicate admission number or email)" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}
