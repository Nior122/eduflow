import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classes = await prisma.class.findMany({
    where: { schoolId: session.user.schoolId },
    include: {
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ classes });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const cls = await prisma.class.create({
      data: { ...body, schoolId: session.user.schoolId },
    });
    return NextResponse.json({ class: cls }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
  }
}
