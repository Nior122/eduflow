import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, lessonPlanSaveSchema } from "@/lib/validations";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(STAFF_ROLES as readonly string[]).includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const schoolId = session.user.schoolId;

  const lessonPlans = await prisma.lessonPlan.findMany({
    where: { schoolId },
    include: { teacher: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ lessonPlans });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(STAFF_ROLES as readonly string[]).includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const schoolId = session.user.schoolId;

  try {
    const body = await req.json();
    const parsed = validate(lessonPlanSaveSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const lessonPlan = await prisma.lessonPlan.create({
      data: {
        subject: data.subject,
        class: data.className,
        topic: data.topic,
        duration: data.duration,
        objectives: data.objectives ?? "",
        materials: data.materials ?? "",
        introduction: data.introduction ?? "",
        activities: data.activities ?? "",
        teacherActivity: data.teacherActivity ?? "",
        studentActivity: data.studentActivity ?? "",
        assessment: data.assessment ?? "",
        homework: data.homework ?? "",
        aiGenerated: true,
        schoolId,
        teacherId: session.user.teacherId ?? null,
      },
    });
    return NextResponse.json({ lessonPlan }, { status: 201 });
  } catch (error) {
    console.error("Failed to save lesson plan:", error);
    return NextResponse.json({ error: "Failed to save lesson plan" }, { status: 500 });
  }
}
