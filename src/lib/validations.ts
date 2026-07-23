import { z } from "zod";

// ─── Student ──────────────────────────────────────────────────────────

export const studentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  admissionNumber: z.string().min(1, "Admission number is required"),
  classId: z.string().optional(),
  parentId: z.string().optional(),
  medicalInfo: z.string().optional(),
});

export type StudentFormData = z.infer<typeof studentSchema>;

// ─── Teacher ──────────────────────────────────────────────────────────

export const teacherSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  employeeDate: z.string().optional(),
});

export type TeacherFormData = z.infer<typeof teacherSchema>;

// ─── Class ───────────────────────────────────────────────────────────

export const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  category: z.enum(["PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"]),
  section: z.string().optional(),
  capacity: z.coerce.number().optional(),
});

export type ClassFormData = z.infer<typeof classSchema>;

// ─── Subject ─────────────────────────────────────────────────────────

export const subjectSchema = z.object({
  name: z.string().min(1, "Subject name is required"),
  code: z.string().optional(),
  category: z.enum(["PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"]).optional(),
});

export type SubjectFormData = z.infer<typeof subjectSchema>;

// ─── Fee ─────────────────────────────────────────────────────────────

export const feeSchema = z.object({
  name: z.string().min(1, "Fee name is required"),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  dueDate: z.string().optional(),
  isOptional: z.boolean().default(false),
  term: z.enum(["FIRST", "SECOND", "THIRD"]).optional(),
});

export type FeeFormData = z.infer<typeof feeSchema>;

// ─── Attendance ──────────────────────────────────────────────────────

export const attendanceSchema = z.object({
  date: z.string().min(1, "Date is required"),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().optional(),
  records: z.array(
    z.object({
      studentId: z.string(),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    })
  ),
});

export type AttendanceFormData = z.infer<typeof attendanceSchema>;

// ─── Result ──────────────────────────────────────────────────────────

export const resultSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  term: z.enum(["FIRST", "SECOND", "THIRD"]),
  session: z.string(),
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

export type AnnouncementFormData = z.infer<typeof announcementSchema>;

// ─── Lesson Plan ─────────────────────────────────────────────────────

export const lessonPlanSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  class: z.string().min(1, "Class is required"),
  topic: z.string().min(1, "Topic is required"),
  duration: z.string().min(1, "Duration is required"),
});

export type LessonPlanFormData = z.infer<typeof lessonPlanSchema>;

// ─── Login ───────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ─── Register ────────────────────────────────────────────────────────

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
