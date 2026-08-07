import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { validate, registerSchoolSchema } from "@/lib/validations";
import { rateLimit, ipKey } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ipKey(ip, "register"), { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = validate(registerSchoolSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { name, email, password, schoolName } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const slug = generateSlug(schoolName) + "-" + Date.now().toString(36);

    // School + admin user in one transaction — no orphan schools.
    const { user, school } = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({ data: { name: schoolName, slug } });
      const user = await tx.user.create({
        data: { name, email, passwordHash, role: "SCHOOL_ADMIN", schoolId: school.id },
      });
      return { user, school };
    });

    return NextResponse.json(
      {
        user: { id: user.id, name: user.name, email: user.email },
        school: { id: school.id, name: school.name },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
