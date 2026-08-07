import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

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

  // Clean existing data
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
    prisma.result.deleteMany(),
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

  // Assign teacher to classes & subjects
  await Promise.all(
    classes.slice(0, 4).map((cls, i) =>
      prisma.classSubject.create({
        data: {
          classId: cls.id,
          subjectId: subjects[i].id,
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

  // Create Results
  const terms = ["FIRST", "SECOND", "THIRD"] as const;
  for (const student of students.slice(0, 10)) {
    for (const subject of subjects.slice(0, 4)) {
      for (const term of terms) {
        const assignment = Math.floor(Math.random() * 20) + 10;
        const test = Math.floor(Math.random() * 20) + 10;
        const exam = Math.floor(Math.random() * 40) + 20;
        const total = assignment + test + exam;
        const grade = total >= 75 ? "A" : total >= 65 ? "B" : total >= 55 ? "C" : total >= 45 ? "D" : "F";

        await prisma.result.create({
          data: {
            studentId: student.id,
            classId: student.classId!,
            subjectId: subject.id,
            term,
            session: "2025/2026",
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
          session: "2025/2026",
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
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
