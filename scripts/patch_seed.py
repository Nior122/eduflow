# One-off patch for prisma/seed.ts (Phase 6 demo data). ASCII-safe script.
import io

p = "prisma/seed.ts"
s = io.open(p, encoding="utf-8").read()

# 1) wipe the new Phase 6 tables too (order: before users)
old = """    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
    prisma.school.deleteMany(),
  ]);"""
new = """    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.schoolDocument.deleteMany(),
    prisma.userPreference.deleteMany(),
    prisma.userActivityLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.school.deleteMany(),
  ]);"""
assert s.count(old) == 1, "wipe anchor"
s = s.replace(old, new)

# 2) Phase 6 demo block before the completion log
CHECK = "\u2705 Seeding complete!"
old = """  console.log("%s");""" % CHECK
block = '''
  // \u2500\u2500\u2500 PHASE 6: COMMUNICATION & PORTALS DEMO DATA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const fs = await import("fs");
  const pathMod = await import("path");
  const uploadsDir = pathMod.join(process.cwd(), "public", "uploads", "documents");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const handbookPath = pathMod.join(uploadsDir, "demo-school-handbook.txt");
  fs.writeFileSync(
    handbookPath,
    "SUNRISE INTERNATIONAL SCHOOL \\u2014 STUDENT HANDBOOK (demo)\\n\\n1. School hours: 8:00am - 3:00pm, Monday to Friday.\\n2. Uniform: full school uniform with ID card at all times.\\n3. Homework is due the next school day unless stated otherwise.\\n4. Parents should contact the class teacher for academic concerns.\\n5. Fees are due at the start of each term.\\n"
  );
  const timetablePath = pathMod.join(uploadsDir, "demo-term-timetable.csv");
  fs.writeFileSync(
    timetablePath,
    "Day,Period,Subject\\nMONDAY,1,Mathematics\\nMONDAY,2,English\\nTUESDAY,1,Science\\nWEDNESDAY,1,Mathematics\\nWEDNESDAY,2,Social Studies\\nTHURSDAY,1,English\\nFRIDAY,1,Physical Education\\n"
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
        message: "EduFlow Phase 6 is live \\u2014 messaging, notifications, documents and your activity timeline.",
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

  console.log("%s");''' % CHECK
assert s.count(old) == 1, "complete-log anchor"
s = s.replace(old, block)

# 3) summary line
old2 = """  console.log(`\U0001F4B0 Phase 5: ${feeCategories.length} fee categories, ${openInvoices.length} invoices, 2 demo payments with receipts, 1 approved scholarship, 1 payment plan`);"""
new2 = old2 + """
  console.log(`\U0001F4E3 Phase 6: 2 school documents, 4 user preferences, 5 activity logs, 3 demo messages, 4 notifications`);"""
assert s.count(old2) == 1, "phase5 summary anchor"
s = s.replace(old2, new2)

io.open(p, "w", encoding="utf-8").write(s)
print("seed patched OK")
