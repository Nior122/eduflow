/**
 * EduFlow — Demo Account Reset (auth-focused, production-safe)
 * ─────────────────────────────────────────────────────────────────────
 * Repairs the demo logins WITHOUT touching unrelated data or AI.
 * For each demo account it:
 *   1. Finds-or-creates the isolated demo school (EduFlow Demo Academy).
 *   2. Upserts the User row by EMAIL (lowercased) — so re-running NEVER
 *      creates duplicates — and rewrites the password hash using the SAME
 *      official function the app's registration uses (bcryptjs hash,
 *      12 rounds), so login verification always matches.
 *   3. Sets the correct role, schoolId, isActive=true and emailVerified.
 *   4. Ensures the portal profile rows (Teacher / Parent with a linked
 *      child / Student with a class) exist and are wired to the user.
 *
 * RUN against whichever database the TARGET environment uses — for the
 * Vercel production app, run it with the production DATABASE_URL set:
 *   SEED_CONFIRM=yes npm run db:reset-demo-auth
 *   # optional custom password:
 *   SEED_CONFIRM=yes DEMO_SEED_PASSWORD=YourStrongPassword123! npm run db:reset-demo-auth
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_SCHOOL_SLUG = "eduflow-demo-academy";
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? "EduflowDemo#2026";

const DEMO_ACCOUNTS = [
  { key: "ADMIN", email: "demo.admin@eduflow.demo", name: "Demo Admin", role: "SCHOOL_ADMIN" },
  { key: "TEACHER", email: "demo.teacher@eduflow.demo", name: "Jane Teacher", role: "TEACHER" },
  { key: "PARENT", email: "demo.parent@eduflow.demo", name: "Ngozi Eze", role: "PARENT" },
  { key: "STUDENT", email: "demo.student@eduflow.demo", name: "Chioma Eze", role: "STUDENT" },
  { key: "FINANCE", email: "demo.finance@eduflow.demo", name: "Demo Finance Officer", role: "FINANCE_OFFICER" },
] as const;

async function main() {
  if (process.env.SEED_CONFIRM !== "yes") {
    console.log("WARNING: demo auth reset updates demo users - run with SEED_CONFIRM=yes to proceed");
    return;
  }
  if (process.env.NODE_ENV === "production") {
    console.log("⚠️  Running demo auth reset against a production database. Only demo users will be touched.");
  }

  const passwordHash = await hash(DEMO_PASSWORD, 12);

  // 1. Find-or-create the demo school (slug is @unique -> safe).
  let school = await prisma.school.findUnique({ where: { slug: DEMO_SCHOOL_SLUG } });
  if (!school) {
    school = await prisma.school.create({
      data: {
        name: "EduFlow Demo Academy",
        slug: DEMO_SCHOOL_SLUG,
        address: "1 EduFlow Crescent, Ikeja, Lagos",
        phone: "+234-800-DEMO-EDU",
        email: "demo@eduflow.demo",
        motto: "Learn. Grow. Succeed.",
        principal: "Dr. Grace Adeyemi",
        category: "PRIMARY",
      },
    });
    console.log("   ✓ created demo school");
  }

  // 2. Upsert each demo user (email @unique -> idempotent, no duplicates).
  const users: Record<string, { id: string; role: string }> = {};
  for (const acc of DEMO_ACCOUNTS) {
    const email = acc.email.toLowerCase().trim();
    const passwordAt = new Date();
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: acc.role, schoolId: school.id, isActive: true, emailVerified: passwordAt },
      create: { name: acc.name, email, passwordHash, role: acc.role, schoolId: school.id, isActive: true, emailVerified: passwordAt },
    });
    users[acc.key] = { id: user.id, role: user.role };
    console.log(`   ✓ ${acc.key} user ready (${user.email})`);
  }

  // 3. Ensure portal profile rows + userId wiring.
  await prisma.teacher.upsert({
    where: { email: "demo.teacher@eduflow.demo" },
    update: { firstName: "Jane", lastName: "Teacher", userId: users.TEACHER.id, schoolId: school.id },
    create: {
      firstName: "Jane", lastName: "Teacher", email: "demo.teacher@eduflow.demo",
      userId: users.TEACHER.id, schoolId: school.id, qualification: "B.Ed",
      specialization: "Mathematics", staffId: "EDF-DEMO-T001", yearsOfExperience: 5,
    },
  });

  const parent = await prisma.parent.upsert({
    where: { email: "demo.parent@eduflow.demo" },
    update: { firstName: "Ngozi", lastName: "Eze", userId: users.PARENT.id, schoolId: school.id },
    create: {
      firstName: "Ngozi", lastName: "Eze", email: "demo.parent@eduflow.demo",
      userId: users.PARENT.id, schoolId: school.id, occupation: "Pharmacist",
    },
  });

  // Ensure a class + one demo student with a login, linked to the parent.
  let demoClass = await prisma.class.findFirst({ where: { name: "Primary 1", schoolId: school.id } });
  if (!demoClass) {
    demoClass = await prisma.class.create({
      data: { name: "Primary 1", category: "PRIMARY", capacity: 35, isActive: true, schoolId: school.id },
    });
  }

  await prisma.student.upsert({
    where: { admissionNumber: "EUF-DEMO-0001" },
    update: { firstName: "Chioma", lastName: "Eze", userId: users.STUDENT.id, schoolId: school.id, classId: demoClass.id, parentId: parent.id, isActive: true },
    create: {
      firstName: "Chioma", lastName: "Eze", dateOfBirth: new Date("2019-06-15"), gender: "FEMALE",
      admissionNumber: "EUF-DEMO-0001", schoolId: school.id, classId: demoClass.id,
      parentId: parent.id, userId: users.STUDENT.id,
    },
  });

  console.log("\n✅ Demo auth reset complete — accounts recreated with the app's official hashing.");
  console.log("   Password below is printed server-side only and is NEVER in frontend code:");
  console.log(`   Admin:   demo.admin@eduflow.demo / ${DEMO_PASSWORD}`);
  console.log(`   Teacher: demo.teacher@eduflow.demo / ${DEMO_PASSWORD}`);
  console.log(`   Parent:  demo.parent@eduflow.demo / ${DEMO_PASSWORD}`);
  console.log(`   Student: demo.student@eduflow.demo / ${DEMO_PASSWORD}`);
  console.log(`   Finance: demo.finance@eduflow.demo / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Demo auth reset failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
