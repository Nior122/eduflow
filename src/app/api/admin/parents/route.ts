import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, parentSchema } from "@/lib/validations";
import { provisionUser } from "@/lib/provision";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");

  const where: Record<string, unknown> = { schoolId, isActive: true };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const parents = await prisma.parent.findMany({
    where,
    include: {
      _count: { select: { children: true } },
      children: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ parents });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(parentSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const { parent, creds } = await prisma.$transaction(async (tx) => {
      const creds = await provisionUser(
        {
          email: data.email,
          role: "PARENT",
          schoolId,
          name: `${data.firstName} ${data.lastName}`,
          phone: data.phone ?? null,
        },
        tx
      );
      const parent = await tx.parent.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: creds.loginEmail,
          phone: data.phone ?? null,
          occupation: data.occupation ?? null,
          address: data.address ?? null,
          schoolId,
          userId: creds.userId,
        },
      });
      if (data.studentIds && data.studentIds.length > 0) {
        await tx.student.updateMany({
          where: { id: { in: data.studentIds }, schoolId },
          data: { parentId: parent.id },
        });
      }
      return { parent, creds };
    });

    return NextResponse.json(
      { parent, credentials: { email: creds.loginEmail, tempPassword: creds.tempPassword } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A parent with this email already exists" }, { status: 409 });
    }
    console.error("Failed to create parent:", error);
    return NextResponse.json({ error: "Failed to create parent" }, { status: 500 });
  }
}
