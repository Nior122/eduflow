/**
 * EduFlow AI — assistant tool registry (Phase 7).
 * Every tool queries the real production database (school-scoped) and
 * returns compact JSON for the model. Write tools (create_announcement)
 * are restricted to administrators and logged.
 */
import { prisma } from "@/lib/db";
import { announcementVisibleTo, fanOutAnnouncement, logActivity } from "@/lib/notifications";
import type { UserRole } from "@prisma/client";

export type ToolCtx = {
  schoolId: string;
  userId: string;
  role: UserRole;
  teacherId?: string | null;
  studentId?: string | null;
  parentId?: string | null;
};

export type AiToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (ctx: ToolCtx, args: Record<string, unknown>) => Promise<string>;
};

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function num(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

function str(v: unknown, d = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : d;
}

function nameOf(s: { firstName: string; lastName: string }): string {
  return `${s.firstName} ${s.lastName}`;
}

/** Class ids the actor is connected to (for audience-aware visibility). */
async function ctxClassIds(ctx: ToolCtx): Promise<string[]> {
  if (ctx.role === "TEACHER" && ctx.teacherId) {
    const cs = await prisma.classSubject.findMany({ where: { teacherId: ctx.teacherId }, select: { classId: true } });
    return [...new Set(cs.map((c) => c.classId))];
  }
  if (ctx.role === "STUDENT" && ctx.studentId) {
    const me = await prisma.student.findUnique({ where: { id: ctx.studentId }, select: { classId: true } });
    return me?.classId ? [me.classId] : [];
  }
  if (ctx.role === "PARENT" && ctx.parentId) {
    const kids = await prisma.student.findMany({
      where: { parentId: ctx.parentId, schoolId: ctx.schoolId, isActive: true },
      select: { classId: true },
    });
    return [...new Set(kids.map((k) => k.classId).filter((c): c is string => !!c))];
  }
  return [];
}

const PUBLISHED = ["PUBLISHED", "LOCKED"] as const;

export const AI_TOOLS: AiToolDef[] = [
  {
    name: "school_summary",
    description: "Overall school snapshot: student/teacher/class/subject counts, outstanding fees, attendances recorded today.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async run(ctx) {
      const [students, teachers, classes, subjects, feeAgg, attToday] = await Promise.all([
        prisma.student.count({ where: { schoolId: ctx.schoolId, isActive: true } }),
        prisma.teacher.count({ where: { schoolId: ctx.schoolId, isActive: true } }),
        prisma.class.count({ where: { schoolId: ctx.schoolId, isActive: true } }),
        prisma.subject.count({ where: { schoolId: ctx.schoolId, isActive: true } }),
        prisma.feeRecord.aggregate({
          where: { status: { notIn: ["PAID", "WAIVED"] }, student: { schoolId: ctx.schoolId } },
          _sum: { amount: true },
        }),
        prisma.attendance.count({
          where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, student: { schoolId: ctx.schoolId } },
        }),
      ]);
      return JSON.stringify({
        students,
        teachers,
        classes,
        subjects,
        outstandingFees: Number(feeAgg._sum.amount ?? 0),
        attendancesRecordedToday: attToday,
      });
    },
  },

  {
    name: "students_poor_attendance",
    description: "Students whose attendance rate over the last N days is below a threshold (default 85%).",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Look-back window in days (default 30)" },
        threshold: { type: "number", description: "Minimum attendance % (default 85)" },
      },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const days = num(args.days, 30);
      const threshold = num(args.threshold, 85);
      const since = new Date(Date.now() - days * 86400000);
      const students = await prisma.student.findMany({
        where: { schoolId: ctx.schoolId, isActive: true },
        include: {
          class: { select: { name: true } },
          attendances: { where: { date: { gte: since } }, select: { status: true } },
        },
        take: 300,
      });
      const poor = students
        .map((s) => {
          const total = s.attendances.length;
          const present = s.attendances.filter((a) => a.status === "PRESENT").length;
          return {
            name: nameOf(s),
            className: s.class?.name ?? null,
            rate: total ? Math.round((present / total) * 100) : 100,
          };
        })
        .filter((r) => r.rate < threshold)
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 25);
      return JSON.stringify({ periodDays: days, threshold, count: poor.length, students: poor });
    },
  },

  {
    name: "students_owing_fees",
    description: "Students with outstanding fee balances and the total owed.",
    parameters: {
      type: "object",
      properties: { limit: { type: "number", description: "Max students to return (default 25)" } },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const limit = Math.min(num(args.limit, 25), 100);
      const records = await prisma.feeRecord.findMany({
        where: { status: { notIn: ["PAID", "WAIVED"] }, student: { schoolId: ctx.schoolId, isActive: true } },
        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              admissionNumber: true,
              class: { select: { name: true } },
            },
          },
        },
        take: 500,
      });
      const byStudent = new Map<string, { student: (typeof records)[number]["student"]; total: number; items: number }>();
      for (const r of records) {
        const cur = byStudent.get(r.studentId) ?? { student: r.student, total: 0, items: 0 };
        cur.total += Number(r.amount);
        cur.items += 1;
        byStudent.set(r.studentId, cur);
      }
      const list = [...byStudent.values()]
        .map((e) => ({ name: nameOf(e.student), admissionNumber: e.student.admissionNumber, className: e.student.class?.name ?? null, outstanding: Math.round(e.total * 100) / 100, items: e.items }))
        .sort((a, b) => b.outstanding - a.outstanding)
        .slice(0, limit);
      const totalOutstanding = list.reduce((s, e) => s + e.outstanding, 0);
      return JSON.stringify({ count: byStudent.size, totalOutstanding, students: list });
    },
  },

  {
    name: "students_failing_subject",
    description: "Students with published results below a threshold, optionally filtered by subject.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject name to filter by (optional)" },
        threshold: { type: "number", description: "Score threshold (default 50)" },
        limit: { type: "number", description: "Max results (default 25)" },
      },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const subject = str(args.subject);
      const threshold = num(args.threshold, 50);
      const limit = Math.min(num(args.limit, 25), 100);
      const results = await prisma.result.findMany({
        where: {
          status: { in: [...PUBLISHED] },
          total: { lt: threshold },
          student: { schoolId: ctx.schoolId, isActive: true },
          ...(subject ? { subject: { name: { contains: subject, mode: "insensitive" } } } : {}),
        },
        include: {
          student: { select: { firstName: true, lastName: true, class: { select: { name: true } } } },
          subject: { select: { name: true } },
        },
        orderBy: { total: "asc" },
        take: 200,
      });
      return JSON.stringify({
        subject: subject || "any",
        threshold,
        count: results.length,
        students: results.slice(0, limit).map((r) => ({
          name: nameOf(r.student),
          className: r.student.class?.name ?? null,
          subject: r.subject.name,
          score: Number(r.total),
        })),
      });
    },
  },

  {
    name: "classes_overview",
    description: "List of classes with student counts.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async run(ctx) {
      const classes = await prisma.class.findMany({
        where: { schoolId: ctx.schoolId, isActive: true },
        include: { _count: { select: { students: true } } },
        orderBy: { name: "asc" },
        take: 100,
      });
      return JSON.stringify({ classes: classes.map((c) => ({ name: c.name, students: c._count.students })) });
    },
  },

  {
    name: "my_timetable_today",
    description: "Today's timetable for the current user (teacher's lessons, student's class, parent's children, or school-wide for admins).",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async run(ctx) {
      const day = DAYS[new Date().getDay()];
      if (ctx.role === "TEACHER" && ctx.teacherId) {
        const entries = await prisma.timetableEntry.findMany({
          where: { schoolId: ctx.schoolId, teacherId: ctx.teacherId, day },
          include: { subject: { select: { name: true } }, class: { select: { name: true } } },
          orderBy: { startTime: "asc" },
        });
        return JSON.stringify({
          day,
          entries: entries.map((e) => ({ time: `${e.startTime}–${e.endTime}`, subject: e.subject.name, className: e.class.name })),
        });
      }
      if (ctx.role === "STUDENT" && ctx.studentId) {
        const me = await prisma.student.findUnique({ where: { id: ctx.studentId }, select: { classId: true } });
        if (me?.classId) {
          const entries = await prisma.timetableEntry.findMany({
            where: { schoolId: ctx.schoolId, classId: me.classId, day },
            include: { subject: { select: { name: true } }, teacher: { select: { firstName: true, lastName: true } } },
            orderBy: { startTime: "asc" },
          });
          return JSON.stringify({
            day,
            entries: entries.map((e) => ({ time: `${e.startTime}–${e.endTime}`, subject: e.subject.name, teacher: e.teacher ? `${e.teacher.firstName} ${e.teacher.lastName}` : null })),
          });
        }
        return JSON.stringify({ day, entries: [] });
      }
      if (ctx.role === "PARENT" && ctx.parentId) {
        const kids = await prisma.student.findMany({
          where: { parentId: ctx.parentId, schoolId: ctx.schoolId, isActive: true },
          select: { id: true, firstName: true, lastName: true, classId: true },
        });
        const classIds = [...new Set(kids.map((k) => k.classId).filter((c): c is string => !!c))].slice(0, 3);
        const entries = classIds.length
          ? await prisma.timetableEntry.findMany({
              where: { schoolId: ctx.schoolId, classId: { in: classIds }, day },
              include: { subject: { select: { name: true } }, class: { select: { name: true } } },
              orderBy: [{ classId: "asc" }, { startTime: "asc" }],
              take: 40,
            })
          : [];
        return JSON.stringify({ day, entries: entries.map((e) => ({ time: `${e.startTime}–${e.endTime}`, subject: e.subject.name, className: e.class.name })) });
      }
      const entries = await prisma.timetableEntry.findMany({
        where: { schoolId: ctx.schoolId, day },
        include: { subject: { select: { name: true } }, class: { select: { name: true } } },
        orderBy: { startTime: "asc" },
        take: 30,
      });
      return JSON.stringify({ day, entries: entries.map((e) => ({ time: `${e.startTime}–${e.endTime}`, subject: e.subject.name, className: e.class.name })) });
    },
  },

  {
    name: "upcoming_events",
    description: "Upcoming school calendar events.",
    parameters: {
      type: "object",
      properties: { limit: { type: "number", description: "Max events (default 10)" } },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const limit = Math.min(num(args.limit, 10), 50);
      const events = await prisma.calendarEvent.findMany({
        where: { schoolId: ctx.schoolId, eventDate: { gte: new Date() } },
        orderBy: { eventDate: "asc" },
        take: limit,
      });
      return JSON.stringify({
        events: events.map((e) => ({
          title: e.title,
          date: e.eventDate.toISOString().slice(0, 10),
          type: e.type,
          time: e.startTime ?? null,
        })),
      });
    },
  },

  {
    name: "recent_announcements",
    description: "Recent announcements visible to the current user.",
    parameters: {
      type: "object",
      properties: { limit: { type: "number", description: "Max announcements (default 5)" } },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const limit = Math.min(num(args.limit, 5), 20);
      const classIds = await ctxClassIds(ctx);
      const announcements = await prisma.announcement.findMany({
        where: { schoolId: ctx.schoolId, isActive: true },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const visible = announcements
        .filter((a) => announcementVisibleTo(a, { role: ctx.role, classIds, departmentIds: [] }))
        .slice(0, limit)
        .map((a) => ({
          title: a.title,
          priority: a.priority,
          audience: a.audience,
          content: a.content.slice(0, 300),
          author: a.author?.name ?? "School",
          createdAt: a.createdAt.toISOString().slice(0, 10),
        }));
      return JSON.stringify({ announcements: visible });
    },
  },

  {
    name: "class_performance",
    description: "Average score per subject for a class (published results).",
    parameters: {
      type: "object",
      properties: { className: { type: "string", description: "Class name, e.g. 'JSS 1A'" } },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const className = str(args.className);
      const cls = className
        ? await prisma.class.findFirst({ where: { schoolId: ctx.schoolId, name: { contains: className, mode: "insensitive" }, isActive: true } })
        : null;
      if (!cls) return JSON.stringify({ error: "Class not found" });
      const results = await prisma.result.findMany({
        where: { status: { in: [...PUBLISHED] }, student: { schoolId: ctx.schoolId, classId: cls.id } },
        include: { subject: { select: { name: true } } },
        take: 1000,
      });
      const bySubject = new Map<string, { sum: number; count: number }>();
      for (const r of results) {
        const cur = bySubject.get(r.subject.name) ?? { sum: 0, count: 0 };
        cur.sum += Number(r.total ?? 0);
        cur.count += 1;
        bySubject.set(r.subject.name, cur);
      }
      const subjects = [...bySubject.entries()].map(([name, v]) => ({
        subject: name,
        average: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0,
        results: v.count,
      }));
      return JSON.stringify({ className: cls.name, studentCount: results.length ? undefined : undefined, subjects });
    },
  },

  {
    name: "student_progress",
    description: "Progress snapshot for a student by name: attendance rate, average score, homework completion, fee balance.",
    parameters: {
      type: "object",
      properties: {
        studentName: { type: "string", description: "Full or partial student name" },
        limit: { type: "number", description: "Max matching students (default 5)" },
      },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const studentName = str(args.studentName);
      const limit = Math.min(num(args.limit, 5), 20);
      if (!studentName) return JSON.stringify({ error: "studentName is required" });
      const students = await prisma.student.findMany({
        where: {
          schoolId: ctx.schoolId,
          isActive: true,
          OR: [
            { firstName: { contains: studentName, mode: "insensitive" } },
            { lastName: { contains: studentName, mode: "insensitive" } },
          ],
        },
        include: {
          class: { select: { name: true } },
          attendances: { select: { status: true }, take: 90 },
          results: { where: { status: { in: [...PUBLISHED] } }, select: { total: true }, take: 100 },
          homeworkSubmissions: { select: { id: true }, take: 100 },
          feeRecords: { select: { amount: true, status: true } },
        },
        take: limit,
      });
      return JSON.stringify({
        students: students.map((s) => {
          const total = s.attendances.length;
          const present = s.attendances.filter((a) => a.status === "PRESENT").length;
          const totals = s.results.map((r) => Number(r.total ?? 0));
          const avg = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null;
          const outstanding = s.feeRecords.filter((f) => !["PAID", "WAIVED"].includes(f.status)).reduce((sum, f) => sum + Number(f.amount), 0);
          return {
            name: nameOf(s),
            className: s.class?.name ?? null,
            attendanceRate: total ? Math.round((present / total) * 100) : null,
            averageScore: avg,
            homeworkSubmissions: s.homeworkSubmissions.length,
            feeBalance: Math.round(outstanding * 100) / 100,
          };
        }),
      });
    },
  },

  {
    name: "homework_stats",
    description: "Homework completion overview: assigned, submitted, graded, overdue.",
    parameters: {
      type: "object",
      properties: { className: { type: "string", description: "Optional class name filter" } },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const className = str(args.className);
      const cls = className
        ? await prisma.class.findFirst({ where: { schoolId: ctx.schoolId, name: { contains: className, mode: "insensitive" } } })
        : null;
      const homework = await prisma.homework.findMany({
        where: { schoolId: ctx.schoolId, ...(cls ? { classId: cls.id } : {}) },
        include: { _count: { select: { submissions: true } } },
        take: 300,
      });
      const assigned = homework.length;
      const submitted = homework.reduce((s, h) => s + h._count.submissions, 0);
      const graded = await prisma.homeworkSubmission.count({
        where: { grade: { not: null }, homework: { schoolId: ctx.schoolId, ...(cls ? { classId: cls.id } : {}) } },
      });
      const overdue = homework.filter((h) => h.dueDate < new Date()).length;
      return JSON.stringify({ className: cls?.name ?? "all classes", assigned, submitted, graded, overdue });
    },
  },

  {
    name: "create_announcement",
    description: "Create and publish a school announcement (administrators only). Recipients get a notification.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Announcement title" },
        content: { type: "string", description: "Announcement body" },
        audience: { type: "string", enum: ["ALL", "TEACHERS", "PARENTS", "STUDENTS"], description: "Target audience (default ALL)" },
      },
      required: ["title", "content"],
      additionalProperties: false,
    },
    async run(ctx, args) {
      const isAdmin = ctx.role === "SCHOOL_ADMIN" || ctx.role === "SUPER_ADMIN";
      if (!isAdmin) return JSON.stringify({ error: "Only administrators can create announcements" });
      const title = str(args.title, "Announcement");
      const content = str(args.content);
      if (!content) return JSON.stringify({ error: "Content is required" });
      const rawAudience = str(args.audience, "ALL").toUpperCase();
      const audience = ["ALL", "TEACHERS", "PARENTS", "STUDENTS"].includes(rawAudience) ? rawAudience : "ALL";
      const announcement = await prisma.announcement.create({
        data: { title, content, audience, published: true, schoolId: ctx.schoolId, authorId: ctx.userId },
      });
      await fanOutAnnouncement({
        id: announcement.id,
        schoolId: ctx.schoolId,
        audience,
        targetClassId: null,
        targetDepartmentId: null,
        title,
        content,
      });
      await logActivity({
        userId: ctx.userId,
        schoolId: ctx.schoolId,
        action: "ANNOUNCEMENT_CREATED",
        entityType: "Announcement",
        entityId: announcement.id,
        metadata: { title, audience, source: "ai_assistant" },
      });
      return JSON.stringify({ ok: true, id: announcement.id, title, audience });
    },
  },
];
