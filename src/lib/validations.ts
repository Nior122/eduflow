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
  feeCategoryId: z.string().optional(),
  classId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  isRecurring: z.boolean().optional(),
  lateFee: z.coerce.number().min(0).nullable().optional(),
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
  audience: z.enum(["ALL", "TEACHERS", "PARENTS", "STUDENTS", "STAFF", "CLASS", "DEPARTMENT"]).default("ALL"),
  pinned: z.boolean().default(false),
  expiresAt: z.string().nullable().optional(),
  targetClassId: z.string().optional(),
  targetDepartmentId: z.string().optional(),
  attachmentUrl: z.string().optional(),
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



// ─── Phase 4: examinations, scores, results workflow ─────────────────

export const examinationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["CA", "MID_TERM", "FINAL", "MOCK", "PROMOTION"]).default("CA"),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  sessionId: z.string().min(1, "Session is required"),
  termId: z.string().min(1, "Term is required"),
  classIds: z.array(z.string()).optional(),
});

export const examinationUpdateSchema = examinationSchema.partial();

export type ExaminationFormData = z.infer<typeof examinationSchema>;

export const assessmentTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  kind: z.enum(["CA", "EXAM"]).default("CA"),
  weight: z.coerce.number().int().min(0).max(100, "Weight must be 0-100"),
  maxScore: z.coerce.number().int().min(1).max(500),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const assessmentTypeUpdateSchema = assessmentTypeSchema.partial();

export const gradeBandSchema = z.object({
  name: z.string().min(1, "Grade is required"),
  minScore: z.coerce.number().int().min(0).max(100),
  maxScore: z.coerce.number().int().min(0).max(100),
  remark: z.string().min(1, "Remark is required"),
  gpa: z.coerce.number().min(0).max(5).nullable().optional(),
  isPass: z.boolean().default(true),
  color: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const gradeBandBulkSchema = z.object({
  bands: z.array(gradeBandSchema).min(1, "At least one grade band is required"),
});

export const scoreBulkSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  sessionId: z.string().min(1, "Session is required"),
  termId: z.string().min(1, "Term is required"),
  rows: z
    .array(
      z.object({
        studentId: z.string().min(1),
        assessmentTypeId: z.string().min(1),
        score: z.coerce.number().min(0, "Score cannot be negative"),
        maxScore: z.coerce.number().int().min(1).optional(),
      })
    )
    .min(1, "At least one score is required"),
});

export const recalculateSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  sessionId: z.string().min(1),
  termId: z.string().min(1),
});

export const workflowSchema = z.object({
  resultIds: z.array(z.string()).min(1, "Select at least one result"),
  action: z.enum(["SUBMIT", "APPROVE", "PUBLISH", "LOCK", "REJECT"]),
  note: z.string().optional(),
});

export const reportCardUpdateSchema = z.object({
  classTeacherComment: z.string().optional(),
  principalComment: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export const reportCardGenerateSchema = z.object({
  classId: z.string().optional(),
  studentId: z.string().optional(),
  sessionId: z.string().min(1),
  termId: z.string().min(1),
});

export const promotionApplySchema = z.object({
  studentId: z.string().min(1),
  action: z.enum(["PROMOTED", "REPEATED", "GRADUATED", "TRANSFERRED", "ARCHIVED"]),
  fromClassId: z.string().min(1),
  toClassId: z.string().nullable().optional(),
  sessionId: z.string().min(1),
  note: z.string().optional(),
});


// ─── Phase 5: finance ────────────────────────────────────────────────

export const feeCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const feeCategoryUpdateSchema = feeCategorySchema.partial();

export const billingGenerateSchema = z
  .object({
    sessionId: z.string().min(1, "Session is required"),
    termId: z.string().min(1, "Term is required"),
    studentIds: z.array(z.string()).optional(),
    classId: z.string().optional(),
    departmentId: z.string().optional(),
    feeIds: z.array(z.string()).optional(),
    discountId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
  })
  .refine((d) => !(d.studentIds?.length && d.classId), {
    message: "Provide studentIds OR classId, not both",
  });

export const invoiceCreateSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  feeIds: z.array(z.string()).min(1, "Select at least one fee"),
  discountId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().optional(),
  sessionId: z.string().optional(),
  termId: z.string().optional(),
});

export const invoiceUpdateSchema = z.object({
  notes: z.string().optional(),
});

export const paymentCreateSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero").max(1000000000),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "MOBILE_MONEY", "CHEQUE"]),
  reference: z.string().min(3, "Reference is required"),
  invoiceIds: z.array(z.string()).optional(),
  studentId: z.string().optional(),
  notes: z.string().optional(),
});

export const gatewayInitSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  email: z.string().email().optional(),
  invoiceId: z.string().optional(),
  studentId: z.string().optional(),
});

export const discountCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  type: z.enum(["PERCENTAGE", "FIXED", "WAIVER", "SCHOLARSHIP", "SIBLING", "STAFF"]),
  value: z.coerce.number().min(0, "Value cannot be negative"),
  scope: z.enum(["STUDENT", "CLASS", "SCHOOL", "FEE"]).default("STUDENT"),
  studentId: z.string().optional(),
  classId: z.string().optional(),
  feeId: z.string().optional(),
  reason: z.string().optional(),
  validUntil: z.string().nullable().optional(),
});

export const discountReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().optional(),
});

export const planCreateSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  invoiceId: z.string().optional(),
  totalAmount: z.coerce.number().positive("Total must be positive"),
  installmentAmount: z.coerce.number().positive("Installment must be positive"),
  installmentCount: z.coerce.number().int().min(1).max(52),
  frequency: z.enum(["WEEKLY", "MONTHLY", "TERMLY"]).default("MONTHLY"),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const planUpdateSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED"]),
});

export const reminderSchema = z.object({
  invoiceIds: z.array(z.string()).min(1, "Select at least one invoice"),
});

export const gatewayConfigSchema = z.object({
  gateway: z.enum(["paystack", "flutterwave", "stripe"]),
  isActive: z.boolean().default(false),
  publicKey: z.string().optional(),
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  testMode: z.boolean().default(true),
});


// ─── PHASE 6: MESSAGING, NOTIFICATIONS, DOCUMENTS, PROFILE ───────────

export const messageAttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1).max(500),
  size: z.number().int().min(0).max(10 * 1024 * 1024),
  mime: z.string().max(120).nullable().optional(),
});

export const messageSendSchema = z.object({
  receiverId: z.string().min(1, "Recipient is required").optional(),
  subject: z.string().min(1, "Subject is required").max(200),
  content: z.string().min(1, "Message is required").max(20000),
  replyToId: z.string().optional(),
  isDraft: z.boolean().default(false),
  draftId: z.string().optional(),
  attachments: z.array(messageAttachmentSchema).max(10).optional(),
});

export const notificationMarkSchema = z.object({
  ids: z.array(z.string()).max(500).optional(),
  all: z.boolean().optional(),
});

export const documentCategoryValues = [
  "HANDBOOK", "POLICY", "TIMETABLE", "STUDY_MATERIAL",
  "FORM", "CIRCULAR", "PAST_QUESTION", "OTHER",
] as const;

export const documentAudienceValues = [
  "ALL", "TEACHERS", "PARENTS", "STUDENTS", "STAFF",
] as const;

export const documentUploadSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(documentCategoryValues).default("OTHER"),
  audience: z.enum(documentAudienceValues).default("ALL"),
});

export const documentUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(documentCategoryValues).optional(),
  audience: z.enum(documentAudienceValues).optional(),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  image: z.string().max(500).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

export const preferencesUpdateSchema = z.object({
  language: z.string().max(10).optional(),
  theme: z.enum(["SYSTEM", "LIGHT", "DARK"]).optional(),
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  inAppNotifications: z.boolean().optional(),
});

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
