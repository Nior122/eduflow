import { z } from "zod";

// ─── Shared validation helper ────────────────────────────────────────
// safeParse + strip: unknown keys are dropped from `data`, so routes can
// safely spread parsed output into Prisma without mass-assignment risk.

export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false as const,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "root",
        message: issue.message,
      })),
    };
  }
  return { ok: true as const, data: result.data as z.infer<T> };
}

export type ValidationResult<T extends z.ZodTypeAny> = ReturnType<typeof validate<T>>;

// ─── Student ──────────────────────────────────────────────────────────

export const studentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  bloodGroup: z.string().optional(),
  religion: z.string().optional(),
  nationality: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  admissionNumber: z.string().optional(),
  classId: z.string().optional(),
  parentId: z.string().optional(),
  parentRelation: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  previousSchool: z.string().optional(),
  medicalInfo: z.string().optional(),
  disabilities: z.string().optional(),
  admissionStatus: z.enum(["ACTIVE", "SUSPENDED", "GRADUATED", "TRANSFERRED", "WITHDRAWN"]).optional(),
});

export const studentUpdateSchema = studentSchema.partial();

export type StudentFormData = z.infer<typeof studentSchema>;

export const studentStatusActionSchema = z.object({
  action: z.enum(["SUSPEND", "GRADUATE", "TRANSFER", "PROMOTE", "REACTIVATE"]),
  note: z.string().optional(),
  newClassId: z.string().optional(),
});

export type StudentStatusAction = z.infer<typeof studentStatusActionSchema>;

// Bulk import rows (client sends parsed CSV rows as JSON)
export const studentImportSchema = z.object({
  rows: z
    .array(
      z.object({
        admissionNumber: z.string().optional(),
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        middleName: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
        dateOfBirth: z.string().optional(),
        className: z.string().optional(),
        parentRelation: z.string().optional(),
      })
    )
    .min(1, "At least one row is required")
    .max(500, "Maximum 500 rows per import"),
});

// ─── Teacher ──────────────────────────────────────────────────────────

export const teacherSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  employeeDate: z.string().optional(),
  staffId: z.string().optional(),
  yearsOfExperience: z.coerce.number().int().min(0).optional(),
  salaryGrade: z.string().optional(),
  departmentId: z.string().optional(),
});

export const teacherUpdateSchema = teacherSchema.partial();

export type TeacherFormData = z.infer<typeof teacherSchema>;

// ─── Parent ───────────────────────────────────────────────────────────

export const parentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  occupation: z.string().optional(),
  address: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
});

export const parentUpdateSchema = parentSchema.partial();

export type ParentFormData = z.infer<typeof parentSchema>;

// ─── Class ───────────────────────────────────────────────────────────

export const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  category: z.enum(["PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"]),
  section: z.string().optional(),
  capacity: z.coerce.number().optional(),
});

export const classUpdateSchema = classSchema.partial();

export type ClassFormData = z.infer<typeof classSchema>;

// ─── Subject ─────────────────────────────────────────────────────────

export const subjectSchema = z.object({
  name: z.string().min(1, "Subject name is required"),
  code: z.string().optional(),
  category: z.enum(["PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"]).optional(),
  departmentId: z.string().optional(),
  description: z.string().optional(),
  passMark: z.coerce.number().int().min(0).max(100).optional(),
  creditUnit: z.coerce.number().int().min(1).optional(),
});

export const subjectUpdateSchema = subjectSchema.partial();

export type SubjectFormData = z.infer<typeof subjectSchema>;

// ─── Department ──────────────────────────────────────────────────────

export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  headTeacherId: z.string().nullable().optional(),
});

export const departmentUpdateSchema = departmentSchema.partial();

// ─── Academic session / term ─────────────────────────────────────────

export const sessionSchema = z.object({
  name: z.string().min(4, "Session name is required (e.g. 2026/2027)"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const sessionUpdateSchema = z.object({
  name: z.string().min(4, "Session name is required (e.g. 2026/2027)").optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const termSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  name: z.enum(["FIRST", "SECOND", "THIRD"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const termUpdateSchema = z.object({
  name: z.enum(["FIRST", "SECOND", "THIRD"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Classroom ───────────────────────────────────────────────────────

export const classroomSchema = z.object({
  name: z.string().min(1, "Classroom name is required"),
  roomNumber: z.string().optional(),
  location: z.string().optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  classId: z.string().nullable().optional(),
  classTeacherId: z.string().nullable().optional(),
  assistantTeacherId: z.string().nullable().optional(),
});

export const classroomUpdateSchema = classroomSchema.partial();

// ─── School settings ─────────────────────────────────────────────────

export const schoolSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  logo: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().optional(),
  motto: z.string().optional(),
  principal: z.string().optional(),
  currency: z.string().min(1).optional(),
  timeZone: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  gradeSystem: z.string().optional(),
  attendanceRules: z.string().optional(),
});

// ─── Fee ─────────────────────────────────────────────────────────────

export const feeSchema = z.object({
  name: z.string().min(1, "Fee name is required"),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  dueDate: z.string().optional(),
  isOptional: z.boolean().default(false),
  term: z.enum(["FIRST", "SECOND", "THIRD"]).optional(),
  session: z.string().optional(),
});

export const feeUpdateSchema = feeSchema.partial();

export type FeeFormData = z.infer<typeof feeSchema>;

// ─── Fee payment record ──────────────────────────────────────────────

export const feeRecordSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "MOBILE_MONEY", "CHEQUE"]).default("CASH"),
  status: z.enum(["PAID", "PARTIAL", "PENDING", "OVERDUE", "WAIVED"]).default("PAID"),
  notes: z.string().optional(),
});

// ─── Attendance ──────────────────────────────────────────────────────

export const attendanceSchema = z.object({
  date: z.string().min(1, "Date is required"),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().nullable().optional(),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"]),
      })
    )
    .min(1, "At least one student record is required"),
});

export type AttendanceFormData = z.infer<typeof attendanceSchema>;

// ─── Result ──────────────────────────────────────────────────────────

export const resultSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  term: z.enum(["FIRST", "SECOND", "THIRD"]),
  session: z.string().min(4, "Session is required"),
  assignment: z.coerce.number().min(0).max(100).optional(),
  test: z.coerce.number().min(0).max(100).optional(),
  exam: z.coerce.number().min(0).max(100).optional(),
});

export type ResultFormData = z.infer<typeof resultSchema>;

// ─── Announcement ────────────────────────────────────────────────────

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  audience: z.enum(["ALL", "TEACHERS", "PARENTS", "STUDENTS"]).default("ALL"),
});

export const announcementUpdateSchema = announcementSchema.partial();

export type AnnouncementFormData = z.infer<typeof announcementSchema>;

// ─── Lesson Plan ─────────────────────────────────────────────────────

export const lessonPlanSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  class: z.string().min(1, "Class is required"),
  topic: z.string().min(1, "Topic is required"),
  duration: z.string().min(1, "Duration is required"),
});

export type LessonPlanFormData = z.infer<typeof lessonPlanSchema>;

// Saved lesson plan — section fields map 1:1 onto the LessonPlan model.

export const lessonPlanSaveSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  className: z.string().min(1, "Class is required"),
  topic: z.string().min(1, "Topic is required"),
  duration: z.string().min(1, "Duration is required"),
  objectives: z.string().optional(),
  materials: z.string().optional(),
  introduction: z.string().optional(),
  activities: z.string().optional(),
  teacherActivity: z.string().optional(),
  studentActivity: z.string().optional(),
  assessment: z.string().optional(),
  homework: z.string().optional(),
});

// ─── Saved AI report comment ─────────────────────────────────────────

export const reportCommentSaveSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  comment: z.string().min(1, "Comment is required"),
});

// ─── Teacher ↔ class/subject assignment ──────────────────────────────

export const classSubjectSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  teacherId: z.string().nullable().optional(),
});

// ─── Auth ────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Valid email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const registerSchoolSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  schoolName: z.string().min(2, "School name is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});


// ─── Phase 3: academic operations ─────────────────────────────────────

export const timetableEntrySchema = z.object({
  day: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM format"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM format"),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  teacherId: z.string().nullable().optional(),
  classroomId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  termId: z.string().nullable().optional(),
}).refine((d) => d.startTime < d.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

export const calendarEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  eventDate: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  type: z.enum(["EXAM", "SCHOOL_OPENING", "SCHOOL_CLOSING", "SPORTS", "PTA_MEETING", "HOLIDAY", "ASSIGNMENT", "EVENT"]).default("EVENT"),
  classId: z.string().nullable().optional(),
});

export const calendarEventUpdateSchema = calendarEventSchema.partial();

export const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  maxScore: z.coerce.number().int().min(1).optional(),
  attachments: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
});

export const assignmentUpdateSchema = assignmentSchema.partial();

export const submissionSchema = z.object({
  content: z.string().min(1, "Submission content is required"),
});

export const gradeSubmissionSchema = z.object({
  grade: z.coerce.number().int().min(0).max(100),
  feedback: z.string().optional(),
});

export const homeworkSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  attachments: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
});

export const homeworkUpdateSchema = homeworkSchema.partial();

export const homeworkSubmissionSchema = z.object({
  content: z.string().min(1, "Submission content is required"),
});

export const staffAttendanceSchema = z.object({
  date: z.string().min(1, "Date is required"),
  records: z
    .array(
      z.object({
        teacherId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"]),
      })
    )
    .min(1, "At least one teacher record is required"),
});

export const attendanceCorrectionSchema = z.object({
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"]),
  remark: z.string().optional(),
});

