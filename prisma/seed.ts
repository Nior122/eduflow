import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { upsertComputedResult } from "../src/lib/exams/calculator";
import { recomputePositions } from "../src/lib/exams/positions";
import { buildReportCard } from "../src/lib/exams/report-card";

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
    prisma.payment.deleteMany(),
    prisma.feeRecord.deleteMany(),
    prisma.fee.deleteMany(),
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

  console.log("✅ Seeding complete!");
  console.log("📧 Demo accounts:");
  console.log("   Admin:   admin@eduflow.com / password123");
  console.log("   Teacher: teacher@eduflow.com / password123");
  console.log("   Parent:  parent@eduflow.com / password123");
  console.log("   Student: student@eduflow.com / password123");
  console.log(`📊 Phase 4: ${assessmentTypes.length} assessment types, 6 grade bands, ${publishedResults.length} published results, 5 report cards`);
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
