import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, studentSchema } from "@/lib/validations";
import { provisionUser, generateAdmissionNumber } from "@/lib/provision";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

  const where: Record<string, unknown> = {
    schoolId,
  };
  if (status && status !== "all") where.admissionStatus = status;
  if (!status || status === "all") where.isActive = true;
  if (classId) where.classId = classId;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { admissionNumber: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
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
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(studentSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    // Student + login account + timeline entry in one transaction.
    const { student, creds } = await prisma.$transaction(async (tx) => {
      const creds = await provisionUser(
        {
          email: data.email ?? "",
          role: "STUDENT",
          schoolId,
          name: `${data.firstName} ${data.lastName}`,
          phone: data.phone ?? null,
        },
        tx
      );
      const student = await tx.student.create({
        data: {
          firstName: data.firstName,
          middleName: data.middleName ?? null,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender ?? null,
          bloodGroup: data.bloodGroup ?? null,
          religion: data.religion ?? null,
          nationality: data.nationality ?? null,
          state: data.state ?? null,
          lga: data.lga ?? null,
          address: data.address ?? null,
          phone: data.phone ?? null,
          email: creds.loginEmail,
          admissionNumber: data.admissionNumber || generateAdmissionNumber(),
          classId: data.classId ?? null,
          parentId: data.parentId ?? null,
          parentRelation: data.parentRelation ?? null,
          emergencyContactName: data.emergencyContactName ?? null,
          emergencyContactPhone: data.emergencyContactPhone ?? null,
          previousSchool: data.previousSchool ?? null,
          medicalInfo: data.medicalInfo ?? null,
          disabilities: data.disabilities ?? null,
          schoolId,
          userId: creds.userId,
        },
      });
      await tx.studentTimeline.create({
        data: { studentId: student.id, event: "Admitted", note: "Student registered" },
      });
      return { student, creds };
    });

    return NextResponse.json(
      { student, credentials: { email: creds.loginEmail, tempPassword: creds.tempPassword } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A student with this admission number or email already exists" },
        { status: 409 }
      );
    }
    console.error("Failed to create student:", error);
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}
