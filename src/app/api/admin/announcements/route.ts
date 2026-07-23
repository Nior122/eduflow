import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const announcements = await prisma.announcement.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ announcements });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const announcement = await prisma.announcement.create({
      data: { ...body, schoolId: session.user.schoolId, authorId: session.user.id },
    });
    return NextResponse.json({ announcement }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
