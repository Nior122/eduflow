import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, termSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const terms = await prisma.academicTerm.findMany({
    where: { session: { schoolId } },
    include: { session: { select: { id: true, name: true, isActive: true } } },
    orderBy: [{ session: { createdAt: "asc" } }, { createdAt: "asc" }],
  });
  return NextResponse.json({ terms });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(termSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { sessionId, name, startDate, endDate } = parsed.data;

    const academicSession = await prisma.academicSession.findFirst({
      where: { id: sessionId, schoolId },
      select: { id: true },
    });
    if (!academicSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const term = await prisma.academicTerm.create({
      data: {
        sessionId,
        name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    return NextResponse.json({ term }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This term already exists for the session" }, { status: 409 });
    }
    console.error("Failed to create term:", error);
    return NextResponse.json({ error: "Failed to create term" }, { status: 500 });
  }
}
