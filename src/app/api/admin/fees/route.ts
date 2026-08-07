import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, feeSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fees = await prisma.fee.findMany({
    where: { schoolId, isActive: true },
    include: {
      _count: { select: { feeRecords: true } },
      feeRecords: { select: { amount: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ fees });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(feeSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const fee = await prisma.fee.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isOptional: data.isOptional,
        term: data.term ?? null,
        schoolId,
      },
    });
    return NextResponse.json({ fee }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This fee already exists" }, { status: 409 });
    }
    console.error("Failed to create fee:", error);
    return NextResponse.json({ error: "Failed to create fee" }, { status: 500 });
  }
}
