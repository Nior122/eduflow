import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subjects = await prisma.subject.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ subjects });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const subject = await prisma.subject.create({
      data: { ...body, schoolId: session.user.schoolId },
    });
    return NextResponse.json({ subject }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
  }
}
