/**
 * EduFlow — Isolated Demo Tenant Seed ("EduFlow Demo Academy")
 * ─────────────────────────────────────────────────────────────────────
 * Creates a dedicated, clearly identifiable DEMO tenant that is fully
 * isolated from real customer tenants:
 *
 *   School : EduFlow Demo Academy (slug: eduflow-demo-academy)
 *   Admin  : demo.admin@eduflow.demo
 *   Teacher: demo.teacher@eduflow.demo
 *   Parent : demo.parent@eduflow.demo
 *   Student: demo.student@eduflow.demo
 *   Finance: demo.finance@eduflow.demo
 *   Password: $DEMO_SEED_PASSWORD (default "EduflowDemo#2026", printed
 *             at the end of the run and documented in docs/DEMO.md).
 *
 * SAFETY — this script NEVER touches other tenants:
 *   - On every run it first deletes ONLY the demo tenant's own records
 *     (scoped by the demo school's id), so it is idempotent and can be
 *     re-run safely against a production database that already has real
 *     schools.
 *   - It requires `SEED_CONFIRM=yes` (like the main seed) because it
 *     still mutates the connected database.
 *
 * RUN:
 *   SEED_CONFIRM=yes npm run db:seed-demo
 *   # or: SEED_CONFIRM=yes DEMO_SEED_PASSWORD=... npm run db:seed-demo
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { upsertComputedResult } from "../src/lib/exams/calculator";
import { recomputePositions } from "../src/lib/exams/positions";
import { buildReportCard } from "../src/lib/exams/report-card";
import { generateInvoices } from "../src/lib/finance/billing";
import { recordPayment, createPaymentPlan } from "../src/lib/finance/payments";
import { createDiscount, reviewDiscount } from "../src/lib/finance/discounts";
import { DEFAULT_PROMPTS } from "../src/lib/ai/prompts";
import { chunkText } from "../src/lib/ai/rag";

const prisma = new PrismaClient();

// ─── Demo tenant identity ─────────────────────────────────────────────
const DEMO_SCHOOL_NAME = "EduFlow Demo Academy";
const DEMO_SCHOOL_SLUG = "eduflow-demo-academy";
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? "EduflowDemo#2026";
const SESSION_NAME = "2025/2026";

const CLASSES: Array<{ name: string; category: "PRIMARY" | "JUNIOR_SECONDARY" }> = [
  { name: "Primary 1", category: "PRIMARY" },
  { name: "Primary 2", category: "PRIMARY" },
  { name: "Primary 3", category: "PRIMARY" },
  { name: "Primary 4", category: "PRIMARY" },
  { name: "Primary 5", category: "PRIMARY" },
  { name: "Primary 6", category: "PRIMARY" },
  { name: "JSS 1", category: "JUNIOR_SECONDARY" },
  { name: "JSS 2", category: "JUNIOR_SECONDARY" },
  { name: "JSS 3", category: "JUNIOR_SECONDARY" },
];

const SUBJECTS = [
  "Mathematics",
  "English Language",
  "Basic Science",
  "Computer Studies",
  "Social Studies",
  "Civic Education",
  "Basic Technology",
  "Agricultural Science",
  "Physical & Health Education",
];
const RESULT_SUBJECTS = SUBJECTS.slice(0, 8); // PHE is timetable-only

const TEACHERS: Array<{ first: string; last: string; email: string }> = [
  { first: "Jane", last: "Teacher", email: "demo.teacher@eduflow.demo" },
  { first: "Adaeze", last: "Okafor", email: "adaeze.okafor@eduflow.demo" },
  { first: "Emeka", last: "Nwosu", email: "emeka.nwosu@eduflow.demo" },
  { first: "Fatima", last: "Bello", email: "fatima.bello@eduflow.demo" },
  { first: "Chinedu", last: "Obi", email: "chinedu.obi@eduflow.demo" },
  { first: "Amina", last: "Yusuf", email: "amina.yusuf@eduflow.demo" },
  { first: "Tunde", last: "Bakare", email: "tunde.bakare@eduflow.demo" },
  { first: "Ngozi", last: "Umeh", email: "ngozi.umeh@eduflow.demo" },
  { first: "Segun", last: "Ola", email: "segun.ola@eduflow.demo" },
];

const PARENTS: Array<{ first: string; last: string; email: string; occupation: string }> = [
  { first: "Ngozi", last: "Eze", email: "demo.parent@eduflow.demo", occupation: "Pharmacist" },
  { first: "Adebayo", last: "Olatunji", email: "adebayo.olatunji@eduflow.demo", occupation: "Banker" },
  { first: "Musa", last: "Abdullahi", email: "musa.abdullahi@eduflow.demo", occupation: "Civil Servant" },
  { first: "Chika", last: "Nwosu", email: "chika.nwosu@eduflow.demo", occupation: "Teacher" },
  { first: "Remi", last: "Falade", email: "remi.falade@eduflow.demo", occupation: "Engineer" },
  { first: "Halima", last: "Sani", email: "halima.sani@eduflow.demo", occupation: "Trader" },
  { first: "Obinna", last: "Uche", email: "obinna.uche@eduflow.demo", occupation: "Accountant" },
  { first: "Maryam", last: "Garba", email: "maryam.garba@eduflow.demo", occupation: "Nurse" },
  { first: "Wale", last: "Akintola", email: "wale.akintola@eduflow.demo", occupation: "Lawyer" },
  { first: "Chuka", last: "Nnamdi", email: "chuka.nnamdi@eduflow.demo", occupation: "Business Owner" },
];

// 40 realistic students; classIdx indexes CLASSES (4-5 students per class).
const STUDENTS: Array<{ first: string; last: string; gender: "MALE" | "FEMALE"; classIdx: number; dobYear: number }> = [
  { first: "Chioma", last: "Eze", gender: "FEMALE", classIdx: 0, dobYear: 2019 },
  { first: "Tunde", last: "Adebayo", gender: "MALE", classIdx: 0, dobYear: 2019 },
  { first: "Amina", last: "Bello", gender: "FEMALE", classIdx: 0, dobYear: 2018 },
  { first: "Fatima", last: "Musa", gender: "FEMALE", classIdx: 0, dobYear: 2019 },
  { first: "Emeka", last: "Okafor", gender: "MALE", classIdx: 0, dobYear: 2018 },
  { first: "Ngozi", last: "Nwosu", gender: "FEMALE", classIdx: 1, dobYear: 2018 },
  { first: "Damilare", last: "Johnson", gender: "MALE", classIdx: 1, dobYear: 2018 },
  { first: "Zainab", last: "Abdullahi", gender: "FEMALE", classIdx: 1, dobYear: 2017 },
  { first: "Segun", last: "Oyelaran", gender: "MALE", classIdx: 1, dobYear: 2018 },
  { first: "Adaeze", last: "Okoro", gender: "FEMALE", classIdx: 2, dobYear: 2017 },
  { first: "Kunle", last: "Falade", gender: "MALE", classIdx: 2, dobYear: 2017 },
  { first: "Halima", last: "Sani", gender: "FEMALE", classIdx: 2, dobYear: 2016 },
  { first: "Chiamaka", last: "Obi", gender: "FEMALE", classIdx: 2, dobYear: 2017 },
  { first: "Ibrahim", last: "Danjuma", gender: "MALE", classIdx: 2, dobYear: 2016 },
  { first: "Yetunde", last: "Adeyemi", gender: "FEMALE", classIdx: 3, dobYear: 2016 },
  { first: "Chinedu", last: "Uche", gender: "MALE", classIdx: 3, dobYear: 2016 },
  { first: "Aisha", last: "Mohammed", gender: "FEMALE", classIdx: 3, dobYear: 2015 },
  { first: "Bisi", last: "Alade", gender: "FEMALE", classIdx: 3, dobYear: 2016 },
  { first: "Olumide", last: "Fashola", gender: "MALE", classIdx: 4, dobYear: 2015 },
  { first: "Nnenna", last: "Agbo", gender: "FEMALE", classIdx: 4, dobYear: 2015 },
  { first: "Musa", last: "Ibrahim", gender: "MALE", classIdx: 4, dobYear: 2014 },
  { first: "Kemi", last: "Adeleke", gender: "FEMALE", classIdx: 4, dobYear: 2015 },
  { first: "Uche", last: "Nnamdi", gender: "MALE", classIdx: 4, dobYear: 2014 },
  { first: "Funke", last: "Akintola", gender: "FEMALE", classIdx: 5, dobYear: 2014 },
  { first: "Chukwuemeka", last: "Nwachukwu", gender: "MALE", classIdx: 5, dobYear: 2013 },
  { first: "Maryam", last: "Garba", gender: "FEMALE", classIdx: 5, dobYear: 2014 },
  { first: "Tobi", last: "Ogunleye", gender: "MALE", classIdx: 5, dobYear: 2013 },
  { first: "Ibrahim", last: "Salisu", gender: "MALE", classIdx: 6, dobYear: 2012 },
  { first: "Ifeoma", last: "Eze", gender: "FEMALE", classIdx: 6, dobYear: 2012 },
  { first: "Kehinde", last: "Ojo", gender: "MALE", classIdx: 6, dobYear: 2011 },
  { first: "Blessing", last: "Etim", gender: "FEMALE", classIdx: 6, dobYear: 2012 },
  { first: "Samuel", last: "Adewale", gender: "MALE", classIdx: 7, dobYear: 2011 },
  { first: "Chinyere", last: "Okeke", gender: "FEMALE", classIdx: 7, dobYear: 2011 },
  { first: "Mohammed", last: "Bello", gender: "MALE", classIdx: 7, dobYear: 2010 },
  { first: "Esther", last: "Ajayi", gender: "FEMALE", classIdx: 7, dobYear: 2011 },
  { first: "David", last: "Okafor", gender: "MALE", classIdx: 7, dobYear: 2010 },
  { first: "Grace", last: "Nnaji", gender: "FEMALE", classIdx: 8, dobYear: 2010 },
  { first: "Suleiman", last: "Yahaya", gender: "MALE", classIdx: 8, dobYear: 2009 },
  { first: "Omotola", last: "Akinola", gender: "FEMALE", classIdx: 8, dobYear: 2010 },
  { first: "Peter", last: "Obi", gender: "MALE", classIdx: 8, dobYear: 2009 },
];

// Performance profiles give the AI analytics meaningful variety:
// high performers, average, struggling, improving, declining, irregular.
type Profile = "HIGH" | "AVG" | "STRUGGLING" | "IMPROVING" | "DECLINING" | "IRREGULAR";
const PROFILE_CYCLE: Profile[] = ["HIGH", "AVG", "STRUGGLING", "IMPROVING", "DECLINING", "IRREGULAR"];
const profileOf = (i: number): Profile => PROFILE_CYCLE[i % PROFILE_CYCLE.length];

const SCORE_BOUNDS: Record<Profile, Record<string, [number, number]>> = {
  HIGH: { ASSIGNMENT: [8, 10], CLASS_TEST: [16, 20], PROJECT: [8, 10], EXAM: [46, 60] },
  AVG: { ASSIGNMENT: [5, 8], CLASS_TEST: [12, 16], PROJECT: [5, 8], EXAM: [34, 48] },
  STRUGGLING: { ASSIGNMENT: [3, 6], CLASS_TEST: [7, 13], PROJECT: [3, 6], EXAM: [20, 36] },
  IMPROVING: { ASSIGNMENT: [6, 9], CLASS_TEST: [13, 18], PROJECT: [6, 9], EXAM: [38, 52] },
  DECLINING: { ASSIGNMENT: [7, 10], CLASS_TEST: [10, 15], PROJECT: [6, 9], EXAM: [28, 44] },
  IRREGULAR: { ASSIGNMENT: [3, 7], CLASS_TEST: [7, 13], PROJECT: [3, 7], EXAM: [18, 38] },
};

const ATTENDANCE_PROFILE: Record<Profile, { present: number; absent: number; late: number; excused: number }> = {
  HIGH: { present: 0.97, absent: 0.01, late: 0.01, excused: 0.01 },
  AVG: { present: 0.9, absent: 0.04, late: 0.04, excused: 0.02 },
  STRUGGLING: { present: 0.84, absent: 0.07, late: 0.05, excused: 0.04 },
  IMPROVING: { present: 0.88, absent: 0.05, late: 0.05, excused: 0.02 },
  DECLINING: { present: 0.8, absent: 0.1, late: 0.07, excused: 0.03 },
  IRREGULAR: { present: 0.62, absent: 0.22, late: 0.1, excused: 0.06 },
};

/** Deterministic PRNG so the demo seed is reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  if (process.env.SEED_CONFIRM !== "yes") {
    console.log("WARNING: demo seed rewrites the demo tenant only - run with SEED_CONFIRM=yes to proceed");
    return;
  }
  if (process.env.NODE_ENV === "production") {
    console.log("⚠️  Running the demo seed against a PRODUCTION database.");
    console.log("    Only tenant 'EduFlow Demo Academy' will be touched. Ctrl+C to abort.");
  }
  console.log("🏫 Seeding EduFlow Demo Academy (isolated demo tenant)...");

  // ── 1. Scoped wipe: remove ONLY the demo tenant's previous data ──────
  await prisma.$transaction([
    prisma.performanceAnalysis.deleteMany({ where: { student: { schoolId: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.aIReportComment.deleteMany({ where: { student: { schoolId: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.lessonPlan.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.message.deleteMany({ where: { sender: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.notification.deleteMany({ where: { user: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.announcement.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.receipt.deleteMany({ where: { payment: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.invoicePayment.deleteMany({ where: { payment: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.invoiceItem.deleteMany({ where: { invoice: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } } }),
    prisma.latePayment.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.invoice.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.paymentPlan.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.discount.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.payment.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.feeRecord.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.fee.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.paymentGatewayConfig.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.assessmentScore.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.examinationClass.deleteMany({ where: { examination: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.examination.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.resultApprovalRecord.deleteMany({ where: { result: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } } }),
    prisma.result.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.reportCard.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.transcript.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.promotionRecord.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.graduationRecord.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.gradeBand.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.assessmentType.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.termAssessmentConfig.deleteMany({ where: { term: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.timetableEntry.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.classroom.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.staffAttendance.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.teacherAssignment.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.calendarEvent.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.assignmentSubmission.deleteMany({ where: { assignment: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.assignment.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.homeworkSubmission.deleteMany({ where: { homework: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.homework.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.classSubject.deleteMany({ where: { class: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.studentTimeline.deleteMany({ where: { student: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.schoolDocument.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.userPreference.deleteMany({ where: { user: { school: { slug: DEMO_SCHOOL_SLUG } } } }),
    prisma.userActivityLog.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.aiUsageLog.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.aiConversation.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.promptTemplate.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.aiSetting.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.knowledgeBaseDocument.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.subscription.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.schoolOnboarding.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.feeCategory.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.department.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.student.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.teacher.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.parent.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.user.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.class.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.subject.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.academicTerm.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.academicSession.deleteMany({ where: { school: { slug: DEMO_SCHOOL_SLUG } } }),
    prisma.school.deleteMany({ where: { slug: DEMO_SCHOOL_SLUG } }),
  ]);
  console.log("   ✓ wiped previous demo-tenant data");

  const rng = mulberry32(20260819);
  const today = new Date();

  // ── 2. School + users ────────────────────────────────────────────────
  const school = await prisma.school.create({
    data: {
      name: DEMO_SCHOOL_NAME,
      slug: DEMO_SCHOOL_SLUG,
      address: "1 EduFlow Crescent, Ikeja, Lagos",
      phone: "+234-800-DEMO-EDU",
      email: "demo@eduflow.demo",
      motto: "Learn. Grow. Succeed.",
      principal: "Dr. Grace Adeyemi",
      category: "PRIMARY",
    },
  });

  const passwordHash = await hash(DEMO_PASSWORD, 12);
  const adminUser = await prisma.user.create({
    data: { name: "Demo Admin", email: "demo.admin@eduflow.demo", passwordHash, role: "SCHOOL_ADMIN", schoolId: school.id },
  });
  const teacherUser = await prisma.user.create({
    data: { name: "Jane Teacher", email: "demo.teacher@eduflow.demo", passwordHash, role: "TEACHER", schoolId: school.id },
  });
  const parentUser = await prisma.user.create({
    data: { name: "Ngozi Eze", email: "demo.parent@eduflow.demo", passwordHash, role: "PARENT", schoolId: school.id },
  });
  const studentUser = await prisma.user.create({
    data: { name: "Chioma Eze", email: "demo.student@eduflow.demo", passwordHash, role: "STUDENT", schoolId: school.id },
  });
  const financeUser = await prisma.user.create({
    data: { name: "Demo Finance Officer", email: "demo.finance@eduflow.demo", passwordHash, role: "FINANCE_OFFICER", schoolId: school.id },
  });

  // ── 3. Session + terms ───────────────────────────────────────────────
  const session = await prisma.academicSession.create({
    data: {
      name: SESSION_NAME,
      startDate: new Date("2025-09-15"),
      endDate: new Date("2026-07-17"),
      isActive: true,
      schoolId: school.id,
      terms: {
        create: [
          { name: "FIRST", startDate: new Date("2025-09-15"), endDate: new Date("2025-12-19"), isActive: true, schoolId: school.id },
          { name: "SECOND", startDate: new Date("2026-01-05"), endDate: new Date("2026-04-03"), isActive: false, schoolId: school.id },
          { name: "THIRD", startDate: new Date("2026-04-20"), endDate: new Date("2026-07-17"), isActive: false, schoolId: school.id },
        ],
      },
    },
  });
  const firstTerm = await prisma.academicTerm.findFirstOrThrow({ where: { sessionId: session.id, name: "FIRST" } });

  // ── 4. Departments, classes, subjects, teachers ──────────────────────
  const departments = await Promise.all(
    [
      { name: "Sciences", code: "SCI" },
      { name: "Humanities", code: "HUM" },
    ].map((d) => prisma.department.create({ data: { ...d, schoolId: school.id } }))
  );

  const classes = await Promise.all(
    CLASSES.map((c) =>
      prisma.class.create({ data: { name: c.name, category: c.category, capacity: 35, isActive: true, schoolId: school.id } })
    )
  );

  const subjects = await Promise.all(
    SUBJECTS.map((name, i) =>
      prisma.subject.create({
        data: {
          name,
          code: name.slice(0, 4).toUpperCase() + (i + 1),
          category: i < 6 ? "PRIMARY" : "JUNIOR_SECONDARY",
          passMark: 40,
          creditUnit: 1,
          departmentId: i < 3 || i === 8 ? departments[0].id : departments[1].id,
          schoolId: school.id,
        },
      })
    )
  );

  const teachers = await Promise.all(
    TEACHERS.map((t, i) =>
      prisma.teacher.create({
        data: {
          firstName: t.first,
          lastName: t.last,
          email: t.email,
          phone: `+234-800-${String(1000 + i).slice(1)}${String(100 + i)}`,
          employeeDate: new Date("2023-09-01"),
          qualification: "B.Ed",
          specialization: SUBJECTS[i],
          staffId: `EDF-STF-${String(i + 1).padStart(3, "0")}`,
          yearsOfExperience: 3 + i,
          salaryGrade: "CONTISS 5",
          departmentId: i < 3 || i === 8 ? departments[0].id : departments[1].id,
          schoolId: school.id,
          userId: i === 0 ? teacherUser.id : undefined,
        },
      })
    )
  );

  // Class-subject + teacher assignment for every class × subject.
  const classSubjects = [];
  for (const cls of classes) {
    for (let s = 0; s < subjects.length; s++) {
      const cs = await prisma.classSubject.create({
        data: { classId: cls.id, subjectId: subjects[s].id, teacherId: teachers[s].id },
      });
      classSubjects.push(cs);
      await prisma.teacherAssignment.create({
        data: {
          teacherId: teachers[s].id,
          classId: cls.id,
          subjectId: subjects[s].id,
          sessionId: session.id,
          termId: firstTerm.id,
          schoolId: school.id,
        },
      });
    }
  }

  // Classrooms (one per class, with a class teacher).
  const classrooms = await Promise.all(
    classes.map((c, i) =>
      prisma.classroom.create({
        data: {
          name: `Room ${String(i + 1).padStart(2, "0")}`,
          roomNumber: String(i + 1).padStart(2, "0"),
          location: i < 6 ? "Primary Block" : "Secondary Block",
          capacity: 35,
          classId: c.id,
          classTeacherId: teachers[i % teachers.length].id,
          schoolId: school.id,
        },
      })
    )
  );

  // ── 5. Parents + students ────────────────────────────────────────────
  const parents = await Promise.all(
    PARENTS.map((p, i) =>
      prisma.parent.create({
        data: {
          firstName: p.first,
          lastName: p.last,
          email: p.email,
          phone: `+234-800-PARENT${i + 1}`,
          occupation: p.occupation,
          schoolId: school.id,
          userId: i === 0 ? parentUser.id : undefined,
        },
      })
    )
  );

  const students = [];
  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i];
    const student = await prisma.student.create({
      data: {
        firstName: s.first,
        lastName: s.last,
        dateOfBirth: new Date(`${s.dobYear}-06-15`),
        gender: s.gender,
        address: `${12 + i} Adeola Street, Ikeja, Lagos`,
        phone: `+234-800-STU${String(i + 1).padStart(3, "0")}`,
        admissionNumber: `EUF/2026/${String(i + 1).padStart(4, "0")}`,
        enrollmentDate: new Date("2025-09-08"),
        medicalInfo: i % 9 === 0 ? "Asthma (inhaler available)" : undefined,
        bloodGroup: ["A+", "O+", "B+", "AB+"][i % 4],
        religion: i % 3 === 0 ? "Islam" : "Christianity",
        nationality: "Nigerian",
        state: ["Lagos", "Enugu", "Kano", "Oyo", "Anambra", "Rivers"][i % 6],
        lga: "Ikeja",
        emergencyContactName: parents[Math.floor(i / 4)].last + " Family",
        emergencyContactPhone: "+234-800-EMERGENCY",
        previousSchool: i % 2 === 0 ? "Sunrise International School" : "Gracefield Academy",
        schoolId: school.id,
        classId: classes[s.classIdx].id,
        parentId: parents[Math.floor(i / 4)].id,
        parentRelation: "Mother",
        userId: i === 0 ? studentUser.id : undefined,
      },
    });
    await prisma.studentTimeline.create({
      data: { event: "Admitted", note: `Enrolled into ${CLASSES[s.classIdx].name}`, studentId: student.id },
    });
    students.push(student);
  }

  // ── 6. Attendance: 30 school days, realistic mix ─────────────────────
  const schoolDays: Date[] = [];
  let d = new Date(today);
  while (schoolDays.length < 30) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) schoolDays.push(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  for (const date of schoolDays) {
    for (let i = 0; i < students.length; i++) {
      const profile = profileOf(i);
      const p = ATTENDANCE_PROFILE[profile];
      const r = rng();
      const status = r < p.present ? "PRESENT" : r < p.present + p.absent ? "ABSENT" : r < p.present + p.absent + p.late ? "LATE" : "EXCUSED";
      await prisma.attendance.create({
        data: {
          studentId: students[i].id,
          classId: students[i].classId!,
          date,
          status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
          teacherId: teachers[students[i].classId === classes[0].id ? 0 : i % teachers.length].id,
        },
      });
    }
  }

  // ── 7. Assessment structure ──────────────────────────────────────────
  const assessmentTypes = await Promise.all(
    [
      { name: "Assignment", code: "ASSIGNMENT", kind: "CA" as const, weight: 10, maxScore: 10, sortOrder: 1 },
      { name: "Class Test", code: "CLASS_TEST", kind: "CA" as const, weight: 20, maxScore: 20, sortOrder: 2 },
      { name: "Project", code: "PROJECT", kind: "CA" as const, weight: 10, maxScore: 10, sortOrder: 3 },
      { name: "Exam", code: "EXAM", kind: "EXAM" as const, weight: 60, maxScore: 60, sortOrder: 4 },
    ].map((a) => prisma.assessmentType.create({ data: { ...a, schoolId: school.id } }))
  );

  await prisma.gradeBand.createMany({
    data: [
      { name: "A", minScore: 70, maxScore: 100, remark: "Excellent", gpa: 4.0, isPass: true, color: "text-green-600", sortOrder: 1, schoolId: school.id },
      { name: "B", minScore: 60, maxScore: 69, remark: "Very Good", gpa: 3.5, isPass: true, color: "text-green-600", sortOrder: 2, schoolId: school.id },
      { name: "C", minScore: 50, maxScore: 59, remark: "Good", gpa: 3.0, isPass: true, color: "text-yellow-600", sortOrder: 3, schoolId: school.id },
      { name: "D", minScore: 45, maxScore: 49, remark: "Fair", gpa: 2.5, isPass: true, color: "text-yellow-600", sortOrder: 4, schoolId: school.id },
      { name: "E", minScore: 40, maxScore: 44, remark: "Poor", gpa: 2.0, isPass: true, color: "text-orange-600", sortOrder: 5, schoolId: school.id },
      { name: "F", minScore: 0, maxScore: 39, remark: "Fail", gpa: 1.0, isPass: false, color: "text-red-600", sortOrder: 6, schoolId: school.id },
    ],
  });

  await prisma.examination.create({
    data: {
      name: "First Term Examination 2025/2026",
      type: "FINAL",
      description: "End of first term examination",
      status: "ACTIVE",
      startDate: new Date("2025-12-08"),
      endDate: new Date("2025-12-19"),
      schoolId: school.id,
      sessionId: session.id,
      termId: firstTerm.id,
      createdById: adminUser.id,
      classes: { create: classes.map((c) => ({ classId: c.id })) },
    },
  });

  // ── 8. Scores + computed results (FIRST term) ────────────────────────
  const resultSubjects = subjects.slice(0, RESULT_SUBJECTS.length);
  for (let i = 0; i < students.length; i++) {
    const profile = profileOf(i);
    const bounds = SCORE_BOUNDS[profile];
    for (const subject of resultSubjects) {
      for (const at of assessmentTypes) {
        const [lo, hi] = bounds[at.code ?? ""] ?? [0, at.maxScore];
        const score = Math.round((lo + rng() * (hi - lo)) * 10) / 10;
        await prisma.assessmentScore.create({
          data: {
            studentId: students[i].id,
            subjectId: subject.id,
            classId: students[i].classId!,
            sessionId: session.id,
            termId: firstTerm.id,
            assessmentTypeId: at.id,
            score,
            maxScore: at.maxScore,
            enteredById: teacherUser.id,
          },
        });
      }
    }
  }

  for (let i = 0; i < students.length; i++) {
    for (const subject of resultSubjects) {
      await upsertComputedResult({
        schoolId: school.id,
        studentId: students[i].id,
        subjectId: subject.id,
        classId: students[i].classId!,
        sessionId: session.id,
        termId: firstTerm.id,
        termName: "FIRST",
        sessionName: SESSION_NAME,
        teacherId: teachers[0].id,
      });
    }
  }
  const pairs = new Set<string>();
  for (let i = 0; i < students.length; i++) {
    for (const subject of resultSubjects) pairs.add(`${students[i].classId}|${subject.id}`);
  }
  for (const pair of pairs) {
    const [cid, sid] = pair.split("|");
    await recomputePositions({ schoolId: school.id, classId: cid!, subjectId: sid!, sessionId: session.id, termId: firstTerm.id });
  }

  // Publish every demo result (approval trail + report cards for all).
  const allResults = await prisma.result.findMany({
    where: { student: { schoolId: school.id }, academicSessionId: session.id, academicTermId: firstTerm.id },
  });
  for (const r of allResults) {
    await prisma.result.update({ where: { id: r.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    for (const [action, from, to] of [
      ["SUBMIT", "DRAFT", "SUBMITTED"],
      ["APPROVE", "SUBMITTED", "APPROVED"],
      ["PUBLISH", "APPROVED", "PUBLISHED"],
    ] as const) {
      await prisma.resultApprovalRecord.create({
        data: { resultId: r.id, action, fromStatus: from, toStatus: to, actorId: action === "SUBMIT" ? teacherUser.id : adminUser.id },
      });
    }
  }
  for (const student of students) {
    const card = await buildReportCard({
      studentId: student.id,
      sessionId: session.id,
      termId: firstTerm.id,
      generatedById: adminUser.id,
      forceRegenerate: true,
    });
    if (card) {
      await prisma.reportCard.update({
        where: { id: card.reportCardId },
        data: {
          isPublished: true,
          publishedAt: new Date(),
          classTeacherComment: "A diligent and focused student. Keep up the good work.",
          principalComment: "Performance meets the expected standard for the term.",
        },
      });
    }
  }

  // Legacy SECOND/THIRD term results so dashboards + AI analytics have history.
  const legacyTerms = ["SECOND", "THIRD"] as const;
  for (let i = 0; i < students.length; i++) {
    const profile = profileOf(i);
    const base = profile === "HIGH" ? 30 : profile === "AVG" ? 24 : profile === "STRUGGLING" ? 16 : 21;
    for (const subject of resultSubjects) {
      for (const term of legacyTerms) {
        const assignment = Math.floor(rng() * 8) + 10;
        const test = Math.floor(rng() * 10) + Math.max(8, base - 10);
        const exam = Math.floor(rng() * 15) + base;
        const total = assignment + test + exam;
        const grade = total >= 75 ? "A" : total >= 65 ? "B" : total >= 55 ? "C" : total >= 45 ? "D" : "F";
        await prisma.result.upsert({
          where: { studentId_subjectId_term_session: { studentId: students[i].id, subjectId: subject.id, term, session: SESSION_NAME } },
          update: { total, grade },
          create: {
            studentId: students[i].id,
            classId: students[i].classId!,
            subjectId: subject.id,
            term,
            session: SESSION_NAME,
            assignment,
            test,
            exam,
            total,
            grade,
            teacherId: teachers[0].id,
          },
        });
      }
    }
  }

  // ── 9. Finance: fees, invoices, payments, discounts, plans ───────────
  const feeCategories = await Promise.all(
    [
      { name: "Tuition", code: "TUITION", sortOrder: 1 },
      { name: "Admission Fee", code: "ADMISSION", sortOrder: 2 },
      { name: "Books", code: "BOOKS", sortOrder: 3 },
      { name: "Uniform", code: "UNIFORM", sortOrder: 4 },
      { name: "Development Levy", code: "DEVLEVY", sortOrder: 5 },
      { name: "Transportation", code: "TRANSPORT", sortOrder: 6 },
      { name: "Examination Fee", code: "EXAMFEE", sortOrder: 7 },
      { name: "ICT Fee", code: "ICT", sortOrder: 8 },
      { name: "PTA Levy", code: "PTA", sortOrder: 9 },
    ].map((c) => prisma.feeCategory.create({ data: { ...c, schoolId: school.id } }))
  );

  const feeTypes = [
    { name: "Tuition Fee", amount: 150000, isOptional: false },
    { name: "Books & Materials", amount: 35000, isOptional: false },
    { name: "Uniform", amount: 25000, isOptional: false },
    { name: "Transport", amount: 45000, isOptional: true },
    { name: "ICT Fee", amount: 20000, isOptional: true },
    { name: "Examination Fee", amount: 10000, isOptional: false },
  ];
  const feeCategoryByName = Object.fromEntries(feeCategories.map((c) => [c.name, c]));
  const fees = await Promise.all(
    feeTypes.map((f) =>
      prisma.fee.create({
        data: {
          name: f.name,
          amount: f.amount,
          isOptional: f.isOptional,
          term: "FIRST",
          session: SESSION_NAME,
          schoolId: school.id,
          dueDate: new Date("2025-09-30"),
          feeCategoryId: feeCategoryByName[["Tuition", "Books", "Uniform", "Transportation", "ICT Fee", "Examination Fee"][feeTypes.indexOf(f)]].id,
          isRecurring: f.name === "Transport",
          lateFee: f.name === "Tuition Fee" ? 5000 : undefined,
        },
      })
    )
  );

  // Fee records: a realistic PAID / PARTIAL / PENDING / OVERDUE / WAIVED mix.
  for (let i = 0; i < students.length; i++) {
    const profile = profileOf(i);
    for (const fee of fees) {
      const r = rng();
      const status =
        profile === "IRREGULAR" ? (r < 0.3 ? "PENDING" : r < 0.6 ? "OVERDUE" : "PARTIAL")
        : profile === "STRUGGLING" ? (r < 0.4 ? "PARTIAL" : r < 0.55 ? "PENDING" : r < 0.7 ? "OVERDUE" : "PAID")
        : r < 0.8 ? "PAID" : r < 0.92 ? "PARTIAL" : "PENDING";
      await prisma.feeRecord.create({
        data: {
          feeId: fee.id,
          studentId: students[i].id,
          amount: fee.amount,
          status: status as "PAID" | "PENDING" | "PARTIAL" | "OVERDUE" | "WAIVED",
          dueDate: fee.dueDate,
          paidAt: status === "PAID" ? new Date("2025-09-20") : null,
        },
      });
    }
  }

  // Bulk-bill every class for FIRST term.
  for (const cls of classes) {
    await generateInvoices({ schoolId: school.id, sessionId: session.id, termId: firstTerm.id, classId: cls.id, issuedById: adminUser.id });
  }

  // Payments: full for HIGH/AVG, half for IMPROVING/DECLINING, none for STRUGGLING/IRREGULAR.
  const openInvoices = await prisma.invoice.findMany({
    where: { sessionId: session.id, termId: firstTerm.id, status: "ISSUED" },
    include: { student: true },
    orderBy: { student: { lastName: "asc" } },
  });
  const invoiceByStudent = new Map<string, (typeof openInvoices)[number]>();
  for (const inv of openInvoices) {
    if (!invoiceByStudent.has(inv.studentId)) invoiceByStudent.set(inv.studentId, inv);
  }

  let paymentCounter = 0;
  const planStudents: string[] = [];
  for (let i = 0; i < students.length; i++) {
    const profile = profileOf(i);
    const inv = invoiceByStudent.get(students[i].id);
    if (!inv) continue;
    const due = Number(inv.amount) - Number(inv.discountAmount);
    if (profile === "HIGH" || profile === "AVG") {
      paymentCounter += 1;
      await recordPayment({
        schoolId: school.id,
        amount: due,
        method: paymentCounter % 2 === 0 ? "BANK_TRANSFER" : "CARD",
        reference: `EDF-DEMO-PAY-${String(paymentCounter).padStart(4, "0")}`,
        invoiceIds: [inv.id],
        receivedById: financeUser.id,
      });
    } else if (profile === "IMPROVING" || profile === "DECLINING") {
      paymentCounter += 1;
      const paid = Math.round(due * 0.5 * 100) / 100;
      await recordPayment({
        schoolId: school.id,
        amount: paid,
        method: "CASH",
        reference: `EDF-DEMO-PAY-${String(paymentCounter).padStart(4, "0")}`,
        invoiceIds: [inv.id],
        receivedById: financeUser.id,
      });
      planStudents.push(students[i].id);
    }
  }

  // Discounts: approved scholarships, one pending sibling discount, one waiver.
  const highStudentIds = students.filter((_, i) => profileOf(i) === "HIGH").slice(0, 3).map((s) => s.id);
  for (let k = 0; k < highStudentIds.length; k++) {
    const disc = await createDiscount({
      schoolId: school.id,
      name: `Merit Scholarship ${[25, 15, 10][k]}%`,
      type: "SCHOLARSHIP",
      value: [25, 15, 10][k],
      scope: "STUDENT",
      studentId: highStudentIds[k],
      reason: "Top of class (demo)",
      createdById: financeUser.id,
    });
    await reviewDiscount({ discountId: disc.id, schoolId: school.id, action: "APPROVE", actorId: financeUser.id });
  }
  const sibling = await createDiscount({
    schoolId: school.id,
    name: "Sibling Discount 10%",
    type: "SIBLING",
    value: 10,
    scope: "STUDENT",
    studentId: students[1].id,
    reason: "Second child enrolled (demo)",
    createdById: financeUser.id,
  });
  await reviewDiscount({ discountId: sibling.id, schoolId: school.id, action: "APPROVE", actorId: financeUser.id });

  // Payment plans for the partial payers.
  for (let k = 0; k < Math.min(planStudents.length, 3); k++) {
    const inv = invoiceByStudent.get(planStudents[k]);
    if (!inv) continue;
    const remaining = Math.round((Number(inv.amount) - Number(inv.discountAmount)) * 0.5 * 100) / 100;
    await createPaymentPlan({
      schoolId: school.id,
      studentId: planStudents[k],
      invoiceId: inv.id,
      totalAmount: remaining,
      installmentAmount: Math.round((remaining / 4) * 100) / 100,
      installmentCount: 4,
      frequency: "MONTHLY",
      createdById: financeUser.id,
    });
  }

  // Gateway config (architecture-ready, inactive).
  await prisma.paymentGatewayConfig.create({
    data: { schoolId: school.id, gateway: "paystack", isActive: false, testMode: true, publicKey: "pk_test_demo", secretKey: "sk_test_demo" },
  });

  // ── 10. Assignments & homework with submissions ──────────────────────
  const assignmentDefs = [
    { title: "Fractions Worksheet", desc: "Complete exercises 1-10 on fractions.", subject: "Mathematics", class: "Primary 3", dueOffset: -5 },
    { title: "Composition: My School", desc: "Write a 150-word composition about your school.", subject: "English Language", class: "Primary 3", dueOffset: -2 },
    { title: "Digestive System Diagram", desc: "Label the parts of the digestive system.", subject: "Basic Science", class: "JSS 1", dueOffset: 3 },
    { title: "Introduction to Scratch", desc: "Create a simple animation in Scratch.", subject: "Computer Studies", class: "JSS 1", dueOffset: 7 },
  ];
  const assignments = [];
  for (const def of assignmentDefs) {
    const cls = classes.find((c) => c.name === def.class)!;
    const subject = subjects.find((s) => s.name === def.subject)!;
    const due = new Date(today);
    due.setDate(due.getDate() + def.dueOffset);
    const assignment = await prisma.assignment.create({
      data: {
        title: def.title,
        description: def.desc,
        dueDate: due,
        maxScore: 20,
        schoolId: school.id,
        classId: cls.id,
        subjectId: subject.id,
        teacherId: teachers[0].id,
      },
    });
    assignments.push({ assignment, cls, subject });
  }
  // Submissions (graded) for the first assignment.
  const subStudents = students.filter((s) => s.classId === classes.find((c) => c.name === "Primary 3")!.id);
  for (let k = 0; k < Math.min(subStudents.length, 4); k++) {
    await prisma.assignmentSubmission.create({
      data: {
        content: "Attached my completed worksheet (demo submission).",
        submittedAt: new Date(today.getTime() - 3 * 86400000),
        grade: 14 + k,
        feedback: "Good attempt — review question 7 on improper fractions.",
        gradedAt: new Date(today.getTime() - 2 * 86400000),
        assignmentId: assignments[0].assignment.id,
        studentId: subStudents[k].id,
      },
    });
  }

  const homeworkDefs = [
    { title: "Counting 1-50", desc: "Practice counting and writing numbers 1-50.", subject: "Mathematics", class: "Primary 1", dueOffset: 2 },
    { title: "Reading: The Ant and the Grasshopper", desc: "Read the story and answer the questions.", subject: "English Language", class: "Primary 2", dueOffset: 4 },
    { title: "States of Matter", desc: "List 3 solids, 3 liquids and 3 gases at home.", subject: "Basic Science", class: "JSS 2", dueOffset: 6 },
  ];
  for (const def of homeworkDefs) {
    const cls = classes.find((c) => c.name === def.class)!;
    const subject = subjects.find((s) => s.name === def.subject)!;
    const due = new Date(today);
    due.setDate(due.getDate() + def.dueOffset);
    const homework = await prisma.homework.create({
      data: {
        title: def.title,
        description: def.desc,
        dueDate: due,
        schoolId: school.id,
        classId: cls.id,
        subjectId: subject.id,
        teacherId: teachers[0].id,
      },
    });
    if (def.class === "Primary 1") {
      await prisma.homeworkSubmission.create({
        data: {
          content: "Homework completed with parent's help (demo).",
          submittedAt: new Date(),
          homeworkId: homework.id,
          studentId: students[0].id,
        },
      });
    }
  }

  // ── 11. Timetable (no teacher conflicts) ─────────────────────────────
  const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  const PERIODS = [
    { start: "08:00", end: "08:40" },
    { start: "08:40", end: "09:20" },
    { start: "09:30", end: "10:10" },
    { start: "10:10", end: "10:50" },
  ];
  // subject index for (classIdx, dayIdx, periodIdx) — with 9 subjects and 9
  // classes the offset is unique per class, so no teacher is double-booked.
  for (let c = 0; c < classes.length; c++) {
    for (let day = 0; day < DAYS.length; day++) {
      for (let p = 0; p < PERIODS.length; p++) {
        const subjectIdx = (c + day * 2 + p) % subjects.length;
        await prisma.timetableEntry.create({
          data: {
            day: DAYS[day],
            startTime: PERIODS[p].start,
            endTime: PERIODS[p].end,
            schoolId: school.id,
            classId: classes[c].id,
            subjectId: subjects[subjectIdx].id,
            teacherId: teachers[subjectIdx].id,
            classroomId: classrooms[c].id,
            sessionId: session.id,
            termId: firstTerm.id,
          },
        });
      }
    }
  }

  // ── 12. Communications: announcements, messages, notifications ───────
  const primary3 = classes.find((c) => c.name === "Primary 3")!;
  await prisma.announcement.createMany({
    data: [
      {
        title: "Welcome to EduFlow Demo Academy",
        content: "We are excited to welcome all students and parents to the 2025/2026 academic session.",
        priority: "HIGH",
        audience: "ALL",
        schoolId: school.id,
        authorId: adminUser.id,
      },
      {
        title: "Parent Meeting",
        content: "The first Parent-Teacher meeting holds on Saturday, October 18 at 10:00 AM in the school hall.",
        priority: "HIGH",
        audience: "ALL",
        schoolId: school.id,
        authorId: adminUser.id,
      },
      {
        title: "Mid-Term Examination",
        content: "Mid-term tests run from November 10-14. Revision notes are available on each class portal.",
        priority: "NORMAL",
        audience: "ALL",
        schoolId: school.id,
        authorId: adminUser.id,
      },
      {
        title: "School Holiday",
        content: "School closes Friday, December 19 for the Christmas break. Resumes Monday, January 5.",
        priority: "NORMAL",
        audience: "ALL",
        schoolId: school.id,
        authorId: adminUser.id,
      },
      {
        title: "Fee Reminder",
        content: "Second-term fees are due by January 15. Payment plans are available from the finance office.",
        priority: "HIGH",
        audience: "ALL",
        schoolId: school.id,
        authorId: adminUser.id,
      },
      {
        title: "Primary 3 Excursion",
        content: "Primary 3 will visit the National Museum on November 21. Parental consent forms are due by November 14.",
        priority: "NORMAL",
        audience: "CLASS",
        targetClassId: primary3.id,
        schoolId: school.id,
        authorId: adminUser.id,
      },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        subject: "Welcome to your teacher portal",
        content: "Hello! This is a demo message. You can message parents, students and other staff from the Messages page.",
        senderId: adminUser.id,
        receiverId: teacherUser.id,
        conversationId: [adminUser.id, teacherUser.id].sort().join(":"),
      },
      {
        subject: "Re: Welcome to your teacher portal",
        content: "Thank you! Looking forward to a great term.",
        senderId: teacherUser.id,
        receiverId: adminUser.id,
        conversationId: [adminUser.id, teacherUser.id].sort().join(":"),
        read: true,
        readAt: new Date(),
      },
      {
        subject: "Fee payment confirmed",
        content: "Your child's first-term fee payment has been received. A receipt is available in Fees & Receipts.",
        senderId: adminUser.id,
        receiverId: parentUser.id,
        conversationId: [adminUser.id, parentUser.id].sort().join(":"),
      },
      {
        subject: "Parent-Teacher meeting",
        content: "Please confirm your attendance for the Parent-Teacher meeting on Saturday.",
        senderId: teacherUser.id,
        receiverId: parentUser.id,
        conversationId: [teacherUser.id, parentUser.id].sort().join(":"),
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: adminUser.id,
        schoolId: school.id,
        title: "Welcome, Demo Admin",
        message: "Your demo school is ready. Explore the admin dashboard, AI tools and reports.",
        type: "INFO",
        link: "/admin/dashboard",
      },
      {
        userId: teacherUser.id,
        schoolId: school.id,
        title: "New message from Admin",
        message: "Welcome to your teacher portal",
        type: "MESSAGE",
        link: "/messages",
      },
      {
        userId: parentUser.id,
        schoolId: school.id,
        title: "Fee payment confirmed",
        message: "Your child's first-term fee payment has been received.",
        type: "PAYMENT",
        link: "/parent/fees",
      },
      {
        userId: studentUser.id,
        schoolId: school.id,
        title: "Welcome to your student portal",
        message: "Track your timetable, homework, results and report cards here.",
        type: "INFO",
        link: "/student/dashboard",
      },
      {
        userId: financeUser.id,
        schoolId: school.id,
        title: "Invoices issued",
        message: "First-term invoices have been issued for all classes.",
        type: "INFO",
        link: "/admin/finance/dashboard",
      },
    ],
  });

  await prisma.userPreference.createMany({
    data: [adminUser, teacherUser, parentUser, studentUser, financeUser].map((u) => ({
      userId: u.id,
      language: "en",
      theme: "SYSTEM",
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      inAppNotifications: true,
      twoFactorEnabled: false,
    })),
  });

  await prisma.userActivityLog.createMany({
    data: [
      { userId: adminUser.id, schoolId: school.id, action: "LOGIN", entityType: "User" },
      { userId: adminUser.id, schoolId: school.id, action: "ANNOUNCEMENT_CREATED", entityType: "Announcement", metadata: { title: "Welcome to EduFlow Demo Academy" } },
      { userId: teacherUser.id, schoolId: school.id, action: "LOGIN", entityType: "User" },
      { userId: parentUser.id, schoolId: school.id, action: "LOGIN", entityType: "User" },
      { userId: studentUser.id, schoolId: school.id, action: "LOGIN", entityType: "User" },
    ],
  });

  await prisma.calendarEvent.createMany({
    data: [
      { title: "Mid-Term Tests", description: "Continuous assessment tests for all classes.", eventDate: new Date("2025-11-10"), startTime: "08:00", endTime: "12:00", type: "EXAM", schoolId: school.id },
      { title: "Christmas Break", description: "School closes for the holidays.", eventDate: new Date("2025-12-19"), type: "HOLIDAY", schoolId: school.id },
      { title: "Inter-House Sports", description: "Annual inter-house sports festival.", eventDate: new Date("2026-02-20"), type: "EVENT", schoolId: school.id },
    ],
  });

  // ── 13. Documents + knowledge base ───────────────────────────────────
  const fs = await import("fs");
  const pathMod = await import("path");
  const uploadsDir = pathMod.join(process.cwd(), "public", "uploads", "documents");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const handbookPath = pathMod.join(uploadsDir, "eduflow-demo-handbook.txt");
  const handbookText =
    "EDUFLOW DEMO ACADEMY - STUDENT HANDBOOK (demo)\n" +
    "1. School hours: 8:00am - 3:00pm, Monday to Friday.\n" +
    "2. Uniform: full school uniform with ID card at all times.\n" +
    "3. Homework is due the next school day unless stated otherwise.\n" +
    "4. Parents should contact the class teacher for academic concerns.\n" +
    "5. Fees are due at the start of each term.\n" +
    "6. The school nurse is available from 8:00am to 2:00pm daily.\n" +
    "7. All visitors must report to the school office.\n";
  fs.writeFileSync(handbookPath, handbookText);
  const timetablePath = pathMod.join(uploadsDir, "eduflow-demo-term-timetable.csv");
  fs.writeFileSync(timetablePath, "Day,Period,Subject\nMONDAY,1,Mathematics\nMONDAY,2,English Language\nTUESDAY,1,Basic Science\nWEDNESDAY,1,Mathematics\nWEDNESDAY,2,Social Studies\nTHURSDAY,1,English Language\nFRIDAY,1,Physical & Health Education\n");

  await prisma.schoolDocument.createMany({
    data: [
      {
        title: "Student Handbook 2025/2026",
        description: "Official school rules, hours and expectations (demo document).",
        category: "HANDBOOK",
        audience: "ALL",
        fileName: "eduflow-demo-handbook.txt",
        fileUrl: "/uploads/documents/eduflow-demo-handbook.txt",
        fileSize: handbookText.length,
        mimeType: "text/plain",
        schoolId: school.id,
        uploaderId: adminUser.id,
      },
      {
        title: "Term Timetable",
        description: "Sample weekly timetable for the current term (demo document).",
        category: "TIMETABLE",
        audience: "ALL",
        fileName: "eduflow-demo-term-timetable.csv",
        fileUrl: "/uploads/documents/eduflow-demo-term-timetable.csv",
        fileSize: 240,
        mimeType: "text/csv",
        schoolId: school.id,
        uploaderId: adminUser.id,
      },
    ],
  });

  await prisma.knowledgeBaseDocument.create({
    data: {
      title: "EduFlow Demo Academy Student Handbook",
      description: "Demo handbook used to test knowledge-base AI features.",
      sourceType: "TEXT",
      fileName: "eduflow-demo-handbook.txt",
      fileUrl: "/uploads/documents/eduflow-demo-handbook.txt",
      content: handbookText,
      chunks: chunkText(handbookText),
      schoolId: school.id,
      uploadedById: adminUser.id,
    },
  });
  await prisma.knowledgeBaseDocument.create({
    data: {
      title: "School Profile Summary",
      description: "Tenant summary for AI context (demo).",
      sourceType: "TEXT",
      content: `${DEMO_SCHOOL_NAME} is a demo primary and junior secondary school in Ikeja, Lagos with ${STUDENTS.length} students across ${CLASSES.length} classes and ${TEACHERS.length} teachers. Session ${SESSION_NAME}.`,
      chunks: chunkText(`${DEMO_SCHOOL_NAME} is a demo primary and junior secondary school in Ikeja, Lagos.`),
      schoolId: school.id,
      uploadedById: adminUser.id,
    },
  });

  // ── 14. AI demo artifacts ────────────────────────────────────────────
  await prisma.aIReportComment.createMany({
    data: [
      { content: "Chioma has demonstrated excellent understanding of mathematical concepts and maintains a positive attitude toward learning.", studentId: students[0].id, teacherId: teachers[0].id, commentType: "EXCELLENT", term: "FIRST" },
      { content: "Samuel is struggling with English comprehension; recommend extra reading practice and weekly dictation.", studentId: students[31].id, teacherId: teachers[1].id, commentType: "NEEDS_IMPROVEMENT", term: "FIRST" },
      { content: "Grace shows steady improvement in Basic Science this term.", studentId: students[36].id, teacherId: teachers[2].id, commentType: "AVERAGE", term: "FIRST" },
    ],
  });

  await prisma.performanceAnalysis.create({
    data: {
      strengths: "Mathematics, Problem-solving, Critical thinking",
      weaknesses: "English comprehension, Essay writing",
      riskLevel: "LOW",
      recommendations: "1. Extra reading comprehension exercises. 2. Join the debate club.",
      overallScore: 82.5,
      studentId: students[0].id,
      teacherId: teachers[0].id,
    },
  });
  await prisma.performanceAnalysis.create({
    data: {
      strengths: "Class participation, Practical work",
      weaknesses: "Consistent study habits, Timely submission of homework",
      riskLevel: "MEDIUM",
      recommendations: "1. Fixed homework schedule. 2. Weekly progress check with parents.",
      overallScore: 58,
      studentId: students[31].id,
      teacherId: teachers[0].id,
    },
  });
  await prisma.performanceAnalysis.create({
    data: {
      strengths: "Resilience, Science practicals",
      weaknesses: "Attendance, Mathematics fundamentals",
      riskLevel: "HIGH",
      recommendations: "1. Attendance intervention. 2. Remedial mathematics twice a week.",
      overallScore: 41,
      studentId: students[40].id,
      teacherId: teachers[0].id,
    },
  });

  await prisma.lessonPlan.create({
    data: {
      subject: "Mathematics",
      class: "Primary 1",
      topic: "Introduction to Fractions",
      duration: "40 minutes",
      objectives: "By the end of this lesson, students should be able to: 1. Identify halves and quarters. 2. Shade fractions of a shape. 3. Match fractions to pictures.",
      materials: "Fraction circles, flashcards, worksheet, whiteboard markers",
      introduction: "Share an orange and ask students how we can share it fairly between two people.",
      activities: "1. Demonstrate halves with the orange. 2. Students shade halves on worksheets. 3. Introduce quarters with paper folding.",
      teacherActivity: "Guide students step-by-step, checking each worksheet.",
      studentActivity: "Students fold paper into halves and quarters, then shade the parts.",
      assessment: "1. Oral questions. 2. Shading worksheet. 3. Exit ticket: draw half of a circle.",
      homework: "Find 3 objects at home that can be divided into halves.",
      schoolId: school.id,
      teacherId: teachers[0].id,
    },
  });
  await prisma.lessonPlan.create({
    data: {
      subject: "Basic Science",
      class: "JSS 1",
      topic: "The Digestive System",
      duration: "40 minutes",
      objectives: "By the end of this lesson, students should be able to: 1. Identify the parts of the digestive system. 2. Describe the function of each part. 3. Explain the process of digestion.",
      materials: "Charts of digestive system, flashcards, whiteboard markers, textbook",
      introduction: "Ask students what happens to food after they eat it.",
      activities: "1. Show the digestive system chart. 2. Explain each part and its function. 3. Students label a blank diagram.",
      teacherActivity: "Explain the digestive process step by step using the chart.",
      studentActivity: "Students label parts on their worksheet. Work in pairs to explain the process.",
      assessment: "1. Oral questions during lesson. 2. Labeled diagram worksheet. 3. Exit ticket.",
      homework: "Draw and label the digestive system.",
      schoolId: school.id,
      teacherId: teachers[2].id,
    },
  });

  // ── 15. AI defaults + SaaS wiring ────────────────────────────────────
  await prisma.aiSetting.create({
    data: {
      schoolId: school.id,
      provider: "openai",
      temperature: 0.7,
      maxTokens: 2048,
      streamingEnabled: true,
      fallbackProvider: true,
      monthlyBudgetCents: 20000,
      modulesEnabled: Object.fromEntries(Object.keys(DEFAULT_PROMPTS).map((k) => [k, true])),
    },
  });
  await prisma.promptTemplate.createMany({
    data: Object.entries(DEFAULT_PROMPTS).map(([key, def]) => ({
      schoolId: school.id,
      key,
      name: def.name,
      description: def.description,
      content: def.content,
      version: 1,
      isActive: true,
      isSystem: true,
      updatedById: adminUser.id,
    })),
  });

  const planData = [
    { name: "Starter", code: "STARTER", sortOrder: 1, description: "For small schools getting started.", priceMonthly: 2900, priceYearly: 29000, features: { maxStudents: 100, maxTeachers: 10, storageMb: 1024, aiTokensPerMonth: 100000, apiCallsPerMonth: 10000, modules: { LIBRARY: false, TRANSPORT: false, PAYROLL: false, AI: true, HOSTEL: false, CLINIC: false, INVENTORY: false, CERTIFICATES: true, MESSAGING: true, REPORTS: true, BILLING: true } } },
    { name: "Professional", code: "PROFESSIONAL", sortOrder: 2, description: "For growing schools that need more.", priceMonthly: 7900, priceYearly: 79000, features: { maxStudents: 500, maxTeachers: 50, storageMb: 5120, aiTokensPerMonth: 500000, apiCallsPerMonth: 50000, modules: { LIBRARY: true, TRANSPORT: true, PAYROLL: false, AI: true, HOSTEL: false, CLINIC: false, INVENTORY: false, CERTIFICATES: true, MESSAGING: true, REPORTS: true, BILLING: true } } },
    { name: "Business", code: "BUSINESS", sortOrder: 3, description: "For large schools with full modules.", priceMonthly: 19900, priceYearly: 199000, features: { maxStudents: 2000, maxTeachers: 200, storageMb: 20480, aiTokensPerMonth: 2000000, apiCallsPerMonth: 200000, modules: { LIBRARY: true, TRANSPORT: true, PAYROLL: true, AI: true, HOSTEL: true, CLINIC: true, INVENTORY: true, CERTIFICATES: true, MESSAGING: true, REPORTS: true, BILLING: true } } },
    { name: "Enterprise", code: "ENTERPRISE", sortOrder: 4, description: "Unlimited everything, custom support.", priceMonthly: 49900, priceYearly: 499000, features: { maxStudents: 100000, maxTeachers: 10000, storageMb: 102400, aiTokensPerMonth: 10000000, apiCallsPerMonth: 1000000, modules: { LIBRARY: true, TRANSPORT: true, PAYROLL: true, AI: true, HOSTEL: true, CLINIC: true, INVENTORY: true, CERTIFICATES: true, MESSAGING: true, REPORTS: true, BILLING: true } } },
  ];
  for (const p of planData) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, currency: "USD" },
    });
  }
  const plansById = await prisma.subscriptionPlan.findMany({ where: { code: { in: planData.map((p) => p.code) } } });
  const plansByCode = Object.fromEntries(plansById.map((p) => [p.code, p])) as Record<string, { id: string }>;
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, defaultTrialDays: 14, defaultPlanCode: "STARTER", currency: "USD", supportEmail: "support@eduflow.app" },
  });
  await prisma.subscription.create({
    data: {
      schoolId: school.id,
      planId: plansByCode.STARTER!.id,
      status: "ACTIVE",
      cycle: "MONTHLY",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingEmail: "demo.admin@eduflow.demo",
      amountMinor: 2900,
      currency: "USD",
    },
  });
  await prisma.schoolOnboarding.create({
    data: {
      schoolId: school.id,
      currentStep: 7,
      steps: { "1": { done: true }, "2": { done: true }, "3": { done: true }, "4": { done: true }, "5": { done: true }, "6": { done: true } },
      isComplete: true,
      completedAt: new Date(),
    },
  });

  // ── Summary ──────────────────────────────────────────────────────────
  console.log("✅ Demo seed complete!");
  console.log("🏫 School:   EduFlow Demo Academy (isolated demo tenant)");
  console.log("📧 Demo accounts (password below — NOT stored in frontend code):");
  console.log(`   Admin:   demo.admin@eduflow.demo / ${DEMO_PASSWORD}`);
  console.log(`   Teacher: demo.teacher@eduflow.demo / ${DEMO_PASSWORD}`);
  console.log(`   Parent:  demo.parent@eduflow.demo / ${DEMO_PASSWORD}`);
  console.log(`   Student: demo.student@eduflow.demo / ${DEMO_PASSWORD}`);
  console.log(`   Finance: demo.finance@eduflow.demo / ${DEMO_PASSWORD}`);
  console.log(`📊 ${students.length} students · ${teachers.length} teachers · ${classes.length} classes · ${subjects.length} subjects`);
  console.log(`📅 ${schoolDays.length} school days of attendance (${students.length} students each)`);
  console.log(`📝 ${allResults.length} published FIRST-term results + report cards · ${assessmentTypes.length} assessment types · ${feeCategories.length} fee categories`);
  console.log(`💰 ${openInvoices.length} invoices · ${paymentCounter} payments · 3 scholarships · ${Math.min(planStudents.length, 3)} payment plans`);
  console.log(`📣 6 announcements · 4 messages · 5 notifications · ${classSubjects.length} class-subject assignments · ${classes.length * DAYS.length * PERIODS.length} timetable entries`);
  console.log(`🤖 AI: ${Object.keys(DEFAULT_PROMPTS).length} prompt templates · 2 knowledge-base documents`);
}

main()
  .catch((e) => {
    console.error("❌ Demo seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
