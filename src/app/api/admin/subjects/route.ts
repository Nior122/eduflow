import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, subjectSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const subjects = await prisma.subject.findMany({
    where: { schoolId, isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ subjects });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(subjectSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const subject = await prisma.subject.create({
      data: {
        name: data.name,
        code: data.code ?? null,
        category: data.category ?? null,
        departmentId: data.departmentId ?? null,
        description: data.description ?? null,
        passMark: data.passMark ?? null,
        creditUnit: data.creditUnit ?? null,
        schoolId,
      },
    });
    return NextResponse.json({ subject }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A subject with this name already exists" }, { status: 409 });
    }
    console.error("Failed to create subject:", error);
    return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
  }
}
