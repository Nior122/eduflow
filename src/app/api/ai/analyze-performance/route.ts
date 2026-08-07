import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const ANALYZE_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`ai:${session.user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = z.object({ studentId: z.string().min(1) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    const { studentId } = parsed.data;

    // Students may only analyze their own record; staff may analyze any
    // student in their school.
    const isSelf = session.user.role === "STUDENT" && session.user.studentId === studentId;
    if (!isSelf && !(ANALYZE_ROLES as readonly string[]).includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId, schoolId: session.user.schoolId },
      include: {
        results: { include: { subject: true } },
        attendances: true,
      },
    });

    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    // Calculate strengths and weaknesses
    const subjectScores: Record<string, number[]> = {};
    student.results.forEach((r) => {
      if (!subjectScores[r.subject.name]) subjectScores[r.subject.name] = [];
      subjectScores[r.subject.name].push(Number(r.total) || 0);
    });

    const averages = Object.entries(subjectScores).map(([name, scores]) => ({
      subject: name,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }));

    averages.sort((a, b) => b.avg - a.avg);
    const strengths = averages.slice(0, 2).map((s) => s.subject);
    const weaknesses = averages
      .slice(-2)
      .map((s) => s.subject)
      .filter((s) => !strengths.includes(s));

    const allScores = averages.map((s) => s.avg);
    const overallAvg =
      allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    const attendanceRate =
      student.attendances.length > 0
        ? (student.attendances.filter((a) => a.status === "PRESENT").length /
            student.attendances.length) *
          100
        : 0;

    let riskLevel = "LOW";
    if (overallAvg < 50 || attendanceRate < 60) riskLevel = "HIGH";
    else if (overallAvg < 65 || attendanceRate < 80) riskLevel = "MEDIUM";

    // Generate recommendations
    const recommendations: string[] = [];
    if (riskLevel === "HIGH") {
      recommendations.push("Schedule an immediate parent-teacher meeting");
      recommendations.push("Provide one-on-one tutoring sessions");
      recommendations.push("Create a personalized learning improvement plan");
    }
    if (weaknesses.length > 0) {
      recommendations.push(`Extra practice exercises in ${weaknesses.join(" and ")}`);
      recommendations.push("Peer tutoring with students who excel in these subjects");
    }
    if (attendanceRate < 80) {
      recommendations.push("Investigate root causes of absenteeism");
      recommendations.push("Implement attendance improvement incentives");
    }
    if (overallAvg >= 70) {
      recommendations.push("Enroll in enrichment programs to stay challenged");
      recommendations.push("Consider mentoring younger students");
    }
    recommendations.push("Weekly progress review sessions");

    // Save analysis
    const analysis = await prisma.performanceAnalysis.create({
      data: {
        studentId,
        strengths: strengths.join(", ") || "None identified yet",
        weaknesses: weaknesses.join(", ") || "None identified yet",
        riskLevel,
        recommendations: recommendations.join("\n"),
        overallScore: Math.round(overallAvg * 10) / 10,
        teacherId: session.user.teacherId ?? null,
      },
    });

    return NextResponse.json({
      analysis,
      strengths,
      weaknesses,
      riskLevel,
      overallScore: Math.round(overallAvg * 10) / 10,
      recommendations,
    });
  } catch (error) {
    console.error("Failed to analyze performance:", error);
    return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
  }
}
