import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(STAFF_ROLES as readonly string[]).includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Teachers may delete only their own plans; admins any plan in the school.
  const result = await prisma.lessonPlan.deleteMany({
    where: {
      id,
      schoolId: session.user.schoolId,
      ...(session.user.role === "TEACHER" ? { teacherId: session.user.teacherId ?? "__none__" } : {}),
    },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Lesson plan not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
