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

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("SEEDING DISABLED IN PRODUCTION");
    return;
  }
  if (process.env.SEED_CONFIRM !== "yes") {
    console.log("WARNING: seed wipes all data - run with SEED_CONFIRM=yes to proceed");
    return;
  }
  console.log("🌱 Seeding EduFlow database...");

  // Clean existing data (children before parents, incl. Phase 2/3/4 models)
  await prisma.$transaction([
    prisma.performanceAnalysis.deleteMany(),
    prisma.aIReportComment.deleteMany(),
    prisma.lessonPlan.deleteMany(),
    prisma.message.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.financeAuditLog.deleteMany(),
    prisma.receipt.deleteMany(),
    prisma.invoicePayment.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.discount.deleteMany(),
    prisma.paymentPlan.deleteMany(),
    prisma.latePayment.deleteMany(),
    prisma.paymentGatewayConfig.deleteMany(),
    prisma.numberSequence.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.feeRecord.deleteMany(),
    prisma.fee.deleteMany(),
    prisma.feeCategory.deleteMany(),
    prisma.resultApprovalRecord.deleteMany(),
    prisma.result.deleteMany(),
    prisma.assessmentScore.deleteMany(),
    prisma.termAssessmentConfig.deleteMany(),
    prisma.examinationClass.deleteMany(),
    prisma.examination.deleteMany(),
    prisma.gradeBand.deleteMany(),
    prisma.assessmentType.deleteMany(),
    prisma.promotionRecord.deleteMany(),
    prisma.graduationRecord.deleteMany(),
    prisma.transcript.deleteMany(),
    prisma.reportCard.deleteMany(),
    prisma.teacherAssignment.deleteMany(),
    prisma.staffAttendance.deleteMany(),
    prisma.homeworkSubmission.deleteMany(),
    prisma.homework.deleteMany(),
    prisma.assignmentSubmission.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.calendarEvent.deleteMany(),
    prisma.timetableEntry.deleteMany(),
    prisma.classroom.deleteMany(),
    prisma.studentTimeline.deleteMany(),
    prisma.academicTerm.deleteMany(),
    prisma.academicSession.deleteMany(),
    prisma.department.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.classSubject.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.class.deleteMany(),
    prisma.student.deleteMany(),
    prisma.teacher.deleteMany(),
    prisma.parent.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.aiUsageLog.deleteMany(),
    prisma.aiConversation.deleteMany(),
    prisma.promptTemplate.deleteMany(),
    prisma.aiSetting.deleteMany(),
    prisma.knowledgeBaseDocument.deleteMany(),
    prisma.questionBank.deleteMany(),
    prisma.generatedExam.deleteMany(),
    prisma.schoolDocument.deleteMany(),
    prisma.userPreference.deleteMany(),
    prisma.userActivityLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.school.deleteMany(),
  ]);

  // Create School
  const school = await prisma.school.create({
    data: {
      name: "Sunrise International School",
      slug: "sunrise-international",
      address: "42 Education Avenue, Lagos",
      phone: "+234-800-EDUFLOW",
      email: "info@sunriseinternational.edu.ng",
      motto: "Empowering Minds, Shaping Futures",
      principal: "Dr. Grace Adeyemi",
      category: "PRIMARY",
    },
  });

  const passwordHash = await hash("password123", 12);

  // Create Users
  const adminUser = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@eduflow.com",
      passwordHash,
      role: "SCHOOL_ADMIN",
      schoolId: school.id,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      name: "Jane Teacher",
      email: "teacher@eduflow.com",
      passwordHash,
      role: "TEACHER",
      schoolId: school.id,
    },
  });

  const parentUser = await prisma.user.create({
    data: {
      name: "Parent User",
      email: "parent@eduflow.com",
      passwordHash,
      role: "PARENT",
      schoolId: school.id,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      name: "Student User",
      email: "student@eduflow.com",
      passwordHash,
      role: "STUDENT",
      schoolId: school.id,
    },
  });

  const financeUser = await prisma.user.create({
    data: {
      name: "Finance Officer",
      email: "finance@eduflow.com",
      passwordHash,
      role: "FINANCE_OFFICER",
      schoolId: school.id,
    },
  });

  // ─── Phase 4: academic session + terms ─────────────────────────────
  const session = await prisma.academicSession.create({
    data: {
      name: "2025/2026",
      startDate: new Date("2025-09-08"),
      endDate: new Date("2026-07-24"),
      isActive: true,
      schoolId: school.id,
      terms: {
        create: [
          { name: "FIRST", startDate: new Date("2025-09-08"), endDate: new Date("2025-12-19"), isActive: true },
          { name: "SECOND", startDate: new Date("2026-01-05"), endDate: new Date("2026-04-03") },
          { name: "THIRD", startDate: new Date("2026-04-20"), endDate: new Date("2026-07-24") },
        ],
      },
    },
  });

  // Create Classes
  const classNames = [
    { name: "Primary 1", category: "PRIMARY" as const },
    { name: "Primary 2", category: "PRIMARY" as const },
    { name: "Primary 3", category: "PRIMARY" as const },
    { name: "Primary 4", category: "PRIMARY" as const },
    { name: "Primary 5", category: "PRIMARY" as const },
    { name: "Primary 6", category: "PRIMARY" as const },
    { name: "JSS 1", category: "JUNIOR_SECONDARY" as const },
    { name: "JSS 2", category: "JUNIOR_SECONDARY" as const },
    { name: "JSS 3", category: "JUNIOR_SECONDARY" as const },
    { name: "SS 1", category: "SENIOR_SECONDARY" as const },
    { name: "SS 2", category: "SENIOR_SECONDARY" as const },
    { name: "SS 3", category: "SENIOR_SECONDARY" as const },
  ];

  const classes = await Promise.all(
    classNames.map((c) =>
      prisma.class.create({ data: { ...c, schoolId: school.id } })
    )
  );

  // Create Subjects
  const subjectNames = [
    "Mathematics", "English Language", "Physics", "Chemistry", "Biology",
    "Basic Science", "Social Studies", "Civic Education", "History",
    "Geography", "Computer Science", "Agricultural Science",
    "French", "Music", "Art & Design", "Physical Education",
  ];

  const subjects = await Promise.all(
    subjectNames.map((name) =>
      prisma.subject.create({ data: { name, schoolId: school.id } })
    )
  );

  // Create Teacher
  const teacher = await prisma.teacher.create({
    data: {
      firstName: "Jane",
      lastName: "Teacher",
      email: "teacher@eduflow.com",
      phone: "+234-800-TEACHER",
      qualification: "B.Ed. Mathematics",
      specialization: "Mathematics",
      schoolId: school.id,
      userId: teacherUser.id,
    },
  });

  // Assign teacher to classes & subjects (class i ↔ subject i % 4)
  await Promise.all(
    classes.map((cls, i) =>
      prisma.classSubject.create({
        data: {
          classId: cls.id,
          subjectId: subjects[i % 4].id,
          teacherId: teacher.id,
        },
      })
    )
  );

  // Create Students
  const studentNames = [
    { first: "David", last: "Okafor" },
    { first: "Sarah", last: "Adebayo" },
    { first: "Michael", last: "Chukwu" },
    { first: "Blessing", last: "Ogunlade" },
    { first: "Emeka", last: "Nwachukwu" },
    { first: "Chioma", last: "Eze" },
    { first: "Tunde", last: "Balogun" },
    { first: "Ngozi", last: "Okonkwo" },
    { first: "Kelechi", last: "Amadi" },
    { first: "Folake", last: "Akinlade" },
    { first: "Segun", last: "Ogunbiyi" },
    { first: "Adaeze", last: "Igwe" },
    { first: "Chinedu", last: "Okafor" },
    { first: "Yetunde", last: "Adebisi" },
    { first: "Ifeanyi", last: "Okeke" },
    { first: "Temidayo", last: "Adebayo" },
    { first: "Oluwaseun", last: "Fashola" },
    { first: "Chiamaka", last: "Nwosu" },
    { first: "Ebuka", last: "Obinna" },
    { first: "Zainab", last: "Abdullahi" },
  ];

  const students = await Promise.all(
    studentNames.map((s, i) =>
      prisma.student.create({
        data: {
          firstName: s.first,
          lastName: s.last,
          admissionNumber: `SUN/${String(i + 1).padStart(4, "0")}`,
          schoolId: school.id,
          classId: classes[i % classes.length].id,
          gender: i % 2 === 0 ? "MALE" : "FEMALE",
          email: `${s.first.toLowerCase()}.${s.last.toLowerCase()}@student.edu`,
        },
      })
    )
  );

  // Link one student to parent & student users
  await prisma.student.update({
    where: { id: students[0].id },
    data: { userId: studentUser.id },
  });

  // Create Parent and link
  const parent = await prisma.parent.create({
    data: {
      firstName: "Parent",
      lastName: "User",
      email: "parent@eduflow.com",
      phone: "+234-800-PARENT",
      schoolId: school.id,
      userId: parentUser.id,
    },
  });

  await prisma.student.update({
    where: { id: students[0].id },
    data: { parentId: parent.id },
  });

  // Create Attendance
  const today = new Date();
  for (let i = 0; i < 20; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends

    for (const student of students.slice(0, 10)) {
      const status = Math.random() > 0.15 ? "PRESENT" : Math.random() > 0.5 ? "ABSENT" : "LATE";
      await prisma.attendance.create({
        data: {
          studentId: student.id,
          classId: student.classId!,
          date,
          status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
          teacherId: teacher.id,
        },
      });
    }
  }

  // ─── Phase 4: assessment structure + grading scale ─────────────────
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

  // Demo examination
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
      termId: (
        await prisma.academicTerm.findFirstOrThrow({ where: { sessionId: session.id, name: "FIRST" } })
      ).id,
      createdById: adminUser.id,
      classes: {
        create: classes.slice(0, 6).map((c) => ({ classId: c.id })),
      },
    },
  });

  // ─── Phase 4: scores + computed results (FIRST term demo) ──────────
  const firstTerm = await prisma.academicTerm.findFirstOrThrow({
    where: { sessionId: session.id, name: "FIRST" },
  });

  // Two students per class for classes 0-3 (real position competition) + one per class for 4-9.
  const demoStudents = [...students.slice(0, 10), ...students.slice(12, 16)];
  const demoSubjects = subjects.slice(0, 4);
  const rng = mulberry32(42);

  // Raw scores per assessment type (bounds match the type's maxScore).
  const scoreBounds: Record<string, [number, number]> = {
    ASSIGNMENT: [3, 10],
    CLASS_TEST: [8, 20],
    PROJECT: [4, 10],
    EXAM: [20, 60],
  };

  for (const student of demoStudents) {
    for (const subject of demoSubjects) {
      for (const at of assessmentTypes) {
        const [lo, hi] = scoreBounds[at.code ?? ""] ?? [0, at.maxScore];
        const score = Math.round((lo + rng() * (hi - lo)) * 10) / 10;
        await prisma.assessmentScore.create({
          data: {
            studentId: student.id,
            subjectId: subject.id,
            classId: student.classId!,
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

  // Compute weighted results + positions for every class×subject pair.
  for (const student of demoStudents) {
    for (const subject of demoSubjects) {
      await upsertComputedResult({
        schoolId: school.id,
        studentId: student.id,
        subjectId: subject.id,
        classId: student.classId!,
        sessionId: session.id,
        termId: firstTerm.id,
        termName: "FIRST",
        sessionName: session.name,
        teacherId: teacher.id,
      });
    }
  }
  const pairs = new Set(
    demoStudents.map((s) => s.classId!).map((c, i) => `${c}|${demoSubjects[i % 4].id}`)
  );
  for (const pair of pairs) {
    const [cid, sid] = pair.split("|");
    await recomputePositions({
      schoolId: school.id,
      classId: cid,
      subjectId: sid,
      sessionId: session.id,
      termId: firstTerm.id,
    });
  }

  // Demo workflow: publish results for the first 5 students so report
  // cards can be generated; the rest stay DRAFT for the approval demo.
  const publishedIds = demoStudents
    .filter((st) => classes.indexOf(classes.find((c) => c.id === st.classId)!) < 4)
    .map((st) => st.id);
  const publishedResults = await prisma.result.findMany({
    where: {
      studentId: { in: publishedIds },
      academicSessionId: session.id,
      academicTermId: firstTerm.id,
    },
  });
  for (const r of publishedResults) {
    await prisma.result.update({
      where: { id: r.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await prisma.resultApprovalRecord.create({
      data: {
        resultId: r.id,
        action: "SUBMIT",
        fromStatus: "DRAFT",
        toStatus: "SUBMITTED",
        actorId: teacherUser.id,
      },
    });
    await prisma.resultApprovalRecord.create({
      data: {
        resultId: r.id,
        action: "APPROVE",
        fromStatus: "SUBMITTED",
        toStatus: "APPROVED",
        actorId: adminUser.id,
      },
    });
    await prisma.resultApprovalRecord.create({
      data: {
        resultId: r.id,
        action: "PUBLISH",
        fromStatus: "APPROVED",
        toStatus: "PUBLISHED",
        actorId: adminUser.id,
      },
    });
  }

  // Generate demo report cards for the published students.
  for (const student of publishedIds.map((id) => ({ id }))) {
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

  // Legacy results for the dashboard (SECOND/THIRD terms + extra subjects)
  const terms = ["SECOND", "THIRD"] as const; // FIRST is computed by the Phase 4 engine
  for (const student of students.slice(0, 10)) {
    for (const subject of subjects.slice(0, 4)) {
      for (const term of terms) {
        const assignment = Math.floor(Math.random() * 20) + 10;
        const test = Math.floor(Math.random() * 20) + 10;
        const exam = Math.floor(Math.random() * 40) + 20;
        const total = assignment + test + exam;
        const grade = total >= 75 ? "A" : total >= 65 ? "B" : total >= 55 ? "C" : total >= 45 ? "D" : "F";

        await prisma.result.upsert({
          where: { studentId_subjectId_term_session: { studentId: student.id, subjectId: subject.id, term, session: session.name } },
          update: { total, grade },
          create: {
            studentId: student.id,
            classId: student.classId!,
            subjectId: subject.id,
            term,
            session: session.name,
            assignment,
            test,
            exam,
            total,
            grade,
            teacherId: teacher.id,
          },
        });
      }
    }
  }

  // Create Fees
  const feeTypes = [
    { name: "Tuition Fee", amount: 150000 },
    { name: "Books & Materials", amount: 35000 },
    { name: "Uniform", amount: 25000 },
    { name: "Transport", amount: 45000, isOptional: true },
  ];

  const fees = await Promise.all(
    feeTypes.map((f) =>
      prisma.fee.create({
        data: {
          name: f.name,
          amount: f.amount,
          isOptional: f.isOptional || false,
          term: "FIRST",
          session: session.name,
          schoolId: school.id,
          dueDate: new Date("2025-09-30"),
        },
      })
    )
  );

  // Phase 5: finance demo
  const feeCategories = await Promise.all(
    [
      { name: "Tuition", code: "TUITION", sortOrder: 1 },
      { name: "Admission Fee", code: "ADMISSION", sortOrder: 2 },
      { name: "Books", code: "BOOKS", sortOrder: 3 },
      { name: "Uniform", code: "UNIFORM", sortOrder: 4 },
      { name: "Development Levy", code: "DEVLEVY", sortOrder: 5 },
      { name: "Transportation", code: "TRANSPORT", sortOrder: 6 },
      { name: "Hostel", code: "HOSTEL", sortOrder: 7 },
      { name: "Laboratory", code: "LAB", sortOrder: 8 },
      { name: "Sports", code: "SPORTS", sortOrder: 9 },
      { name: "Examination Fee", code: "EXAMFEE", sortOrder: 10 },
      { name: "Library", code: "LIBRARY", sortOrder: 11 },
      { name: "PTA Levy", code: "PTA", sortOrder: 12 },
      { name: "ICT Fee", code: "ICT", sortOrder: 13 },
      { name: "Graduation Fee", code: "GRAD", sortOrder: 14 },
    ].map((c) => prisma.feeCategory.create({ data: { ...c, schoolId: school.id } }))
  );

  // attach categories + flags to the seeded fees
  const categoryNames = ["Tuition", "Books", "Uniform", "Transportation"];
  for (let i = 0; i < fees.length; i++) {
    const cat = feeCategories.find((c) => c.name === categoryNames[i]) ?? feeCategories[0];
    await prisma.fee.update({
      where: { id: fees[i].id },
      data: {
        feeCategoryId: cat.id,
        isRecurring: fees[i].name === "Transportation",
        lateFee: fees[i].name === "Tuition" ? 5000 : null,
      },
    });
  }

  // bulk-bill FIRST term for classes 0-2
  for (const cls of classes.slice(0, 3)) {
    await generateInvoices({
      schoolId: school.id,
      sessionId: session.id,
      termId: firstTerm.id,
      classId: cls.id,
      issuedById: adminUser.id,
    });
  }

  // payments: full for the first open invoice, partial for the second
  const openInvoices = await prisma.invoice.findMany({
    where: { sessionId: session.id, termId: firstTerm.id, status: "ISSUED" },
    orderBy: { student: { lastName: "asc" } },
  });
  if (openInvoices.length >= 2) {
    const due0 = Number(openInvoices[0].amount) - Number(openInvoices[0].discountAmount);
    await recordPayment({
      schoolId: school.id,
      amount: due0,
      method: "BANK_TRANSFER",
      reference: "TFR-DEMO-0001",
      invoiceIds: [openInvoices[0].id],
      receivedById: financeUser.id,
    });
    const due1 = Number(openInvoices[1].amount) - Number(openInvoices[1].discountAmount);
    await recordPayment({
      schoolId: school.id,
      amount: Math.round(due1 * 0.5 * 100) / 100,
      method: "CASH",
      reference: "TFR-DEMO-0002",
      invoiceIds: [openInvoices[1].id],
      receivedById: financeUser.id,
    });

    // approved scholarship + payment plan for the partial payer
    const scholarship = await createDiscount({
      schoolId: school.id,
      name: "Merit Scholarship 25%",
      type: "SCHOLARSHIP",
      value: 25,
      scope: "STUDENT",
      studentId: openInvoices[0].studentId,
      reason: "Top 5% performance (demo)",
      createdById: financeUser.id,
    });
    await reviewDiscount({ discountId: scholarship.id, schoolId: school.id, action: "APPROVE", actorId: financeUser.id });

    const remaining = due1 - Math.round(due1 * 0.5 * 100) / 100;
    await createPaymentPlan({
      schoolId: school.id,
      studentId: openInvoices[1].studentId,
      invoiceId: openInvoices[1].id,
      totalAmount: remaining,
      installmentAmount: Math.round((remaining / 4) * 100) / 100,
      installmentCount: 4,
      frequency: "MONTHLY",
      createdById: financeUser.id,
    });
  }

  // gateway config (architecture-ready, inactive)
  await prisma.paymentGatewayConfig.create({
    data: {
      schoolId: school.id,
      gateway: "paystack",
      isActive: false,
      testMode: true,
      publicKey: "pk_test_demo",
      secretKey: "sk_test_demo",
    },
  });

  // Create Fee Records
  for (const student of students.slice(0, 10)) {
    for (const fee of fees) {
      const status = Math.random() > 0.3 ? "PAID" : "PENDING";
      await prisma.feeRecord.create({
        data: {
          feeId: fee.id,
          studentId: student.id,
          amount: fee.amount,
          status: status as "PAID" | "PENDING" | "PARTIAL" | "OVERDUE" | "WAIVED",
          dueDate: fee.dueDate,
          paidAt: status === "PAID" ? new Date() : null,
        },
      });
    }
  }

  // Create Payment
  await prisma.payment.create({
    data: {
      amount: 255000,
      method: "BANK_TRANSFER",
      reference: "PAY-001",
      schoolId: school.id,
    },
  });

  // Create Announcements
  await prisma.announcement.createMany({
    data: [
      {
        title: "Welcome to New Academic Session",
        content: "We are excited to welcome all students and staff to the 2025/2026 academic session. May this be a productive year!",
        priority: "HIGH",
        audience: "ALL",
        schoolId: school.id,
        authorId: adminUser.id,
      },
      {
        title: "Mid-Term Break Schedule",
        content: "School will be closed from March 15-19 for mid-term break. Resume on March 20.",
        priority: "NORMAL",
        audience: "ALL",
        schoolId: school.id,
        authorId: adminUser.id,
      },
      {
        title: "PTA Meeting Announcement",
        content: "The next PTA meeting holds on Saturday, February 20 at 10:00 AM in the school hall. All parents are expected to attend.",
        priority: "HIGH",
        audience: "ALL",
        schoolId: school.id,
        authorId: adminUser.id,
      },
    ],
  });

  // Create AI Report Comments
  await prisma.aIReportComment.create({
    data: {
      content: "David has demonstrated excellent understanding of mathematical concepts and maintains a positive attitude toward learning. He should continue improving his reading skills.",
      studentId: students[0].id,
      teacherId: teacher.id,
    },
  });

  // Create Lesson Plan
  await prisma.lessonPlan.create({
    data: {
      subject: "Basic Science",
      class: "Primary 5",
      topic: "The Digestive System",
      duration: "40 minutes",
      objectives: "By the end of this lesson, students should be able to: 1. Identify the parts of the digestive system. 2. Describe the function of each part. 3. Explain the process of digestion.",
      materials: "Charts of digestive system, flashcards, whiteboard markers, textbook",
      introduction: "Ask students what happens to food after they eat it. Show a picture of the digestive system and ask if they recognize any parts.",
      activities: "1. Show the digestive system chart. 2. Explain each part and its function. 3. Students label a blank diagram.",
      teacherActivity: "Explain the digestive process step by step using the chart. Ask questions throughout to check understanding.",
      studentActivity: "Students label parts on their worksheet. Work in pairs to explain the process to each other.",
      assessment: "1. Oral questions during lesson. 2. Labeled diagram worksheet. 3. Exit ticket: Name one thing you learned about digestion.",
      homework: "Draw and label the digestive system. Write a short paragraph explaining what happens to an apple after you eat it.",
      schoolId: school.id,
      teacherId: teacher.id,
    },
  });

  // Create Performance Analysis
  await prisma.performanceAnalysis.create({
    data: {
      strengths: "Mathematics, Problem-solving, Critical thinking",
      weaknesses: "English comprehension, Essay writing",
      riskLevel: "MEDIUM",
      recommendations: "1. Extra reading comprehension exercises. 2. Join the debate club to improve expression. 3. Weekly practice essays with teacher feedback.",
      overallScore: 72.5,
      studentId: students[0].id,
    },
  });


  // ─── PHASE 6: COMMUNICATION & PORTALS DEMO DATA ─────────────────────────
  const fs = await import("fs");
  const pathMod = await import("path");
  const uploadsDir = pathMod.join(process.cwd(), "public", "uploads", "documents");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const handbookPath = pathMod.join(uploadsDir, "demo-school-handbook.txt");
  fs.writeFileSync(
    handbookPath,
    "SUNRISE INTERNATIONAL SCHOOL \u2014 STUDENT HANDBOOK (demo)\n\n1. School hours: 8:00am - 3:00pm, Monday to Friday.\n2. Uniform: full school uniform with ID card at all times.\n3. Homework is due the next school day unless stated otherwise.\n4. Parents should contact the class teacher for academic concerns.\n5. Fees are due at the start of each term.\n"
  );
  const timetablePath = pathMod.join(uploadsDir, "demo-term-timetable.csv");
  fs.writeFileSync(
    timetablePath,
    "Day,Period,Subject\nMONDAY,1,Mathematics\nMONDAY,2,English\nTUESDAY,1,Science\nWEDNESDAY,1,Mathematics\nWEDNESDAY,2,Social Studies\nTHURSDAY,1,English\nFRIDAY,1,Physical Education\n"
  );

  await prisma.schoolDocument.createMany({
    data: [
      {
        title: "Student Handbook 2025/2026",
        description: "Official school rules, hours and expectations (demo document).",
        category: "HANDBOOK",
        audience: "ALL",
        fileName: "demo-school-handbook.txt",
        fileUrl: "/uploads/documents/demo-school-handbook.txt",
        fileSize: 320,
        mimeType: "text/plain",
        schoolId: school.id,
        uploaderId: adminUser.id,
      },
      {
        title: "Term Timetable",
        description: "Sample weekly timetable for the current term (demo document).",
        category: "TIMETABLE",
        audience: "ALL",
        fileName: "demo-term-timetable.csv",
        fileUrl: "/uploads/documents/demo-term-timetable.csv",
        fileSize: 214,
        mimeType: "text/csv",
        schoolId: school.id,
        uploaderId: adminUser.id,
      },
    ],
  });

  await prisma.userPreference.createMany({
    data: [adminUser, teacherUser, parentUser, studentUser].map((u) => ({
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
      { userId: adminUser.id, schoolId: school.id, action: "ANNOUNCEMENT_CREATED", entityType: "Announcement", metadata: { title: "Welcome to the new term" } },
      { userId: teacherUser.id, schoolId: school.id, action: "LOGIN", entityType: "User" },
      { userId: parentUser.id, schoolId: school.id, action: "LOGIN", entityType: "User" },
      { userId: studentUser.id, schoolId: school.id, action: "LOGIN", entityType: "User" },
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
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: adminUser.id,
        schoolId: school.id,
        title: "Welcome back!",
        message: "EduFlow Phase 6 is live \u2014 messaging, notifications, documents and your activity timeline.",
        type: "INFO",
        link: "/profile",
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
    ],
  });


  // ─── PHASE 7: EDUFLOW AI DEFAULTS ─────────────────────────────
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

  const handbookText =
    "SUNRISE INTERNATIONAL SCHOOL \u2014 STUDENT HANDBOOK (demo)\n" +
    "1. School hours: 8:00am - 3:00pm, Monday to Friday.\n" +
    "2. Uniform: full school uniform with ID card at all times.\n" +
    "3. Homework is due the next school day unless stated otherwise.\n" +
    "4. Parents should contact the class teacher for academic concerns.\n" +
    "5. Fees are due at the start of each term.";
  await prisma.knowledgeBaseDocument.create({
    data: {
      title: "Student Handbook (demo)",
      description: "School rules and expectations \u2014 seed knowledge-base entry for RAG.",
      sourceType: "TEXT",
      content: handbookText,
      chunks: chunkText(handbookText),
      schoolId: school.id,
      uploadedById: adminUser.id,
    },
  });

  console.log("✅ Seeding complete!");
  console.log("📧 Demo accounts:");
  console.log("   Admin:   admin@eduflow.com / password123");
  console.log("   Teacher: teacher@eduflow.com / password123");
  console.log("   Parent:  parent@eduflow.com / password123");
  console.log("   Student: student@eduflow.com / password123");
  console.log(`📊 Phase 4: ${assessmentTypes.length} assessment types, 6 grade bands, ${publishedResults.length} published results, 5 report cards`);
  console.log(`💰 Phase 5: ${feeCategories.length} fee categories, ${openInvoices.length} invoices, 2 demo payments with receipts, 1 approved scholarship, 1 payment plan`);
  console.log(`📣 Phase 6: 2 school documents, 4 user preferences, 5 activity logs, 3 demo messages, 4 notifications`);
  console.log(`🤖 Phase 7: AI settings row, ${Object.keys(DEFAULT_PROMPTS).length} system prompt templates, 1 knowledge-base document`);
}

/** Deterministic PRNG so the seed is reproducible. */
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

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
