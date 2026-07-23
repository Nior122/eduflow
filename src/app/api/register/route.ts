import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const { name, email, schoolName, password } = await req.json();

    if (!email || !password || !name || !schoolName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const slug = generateSlug(schoolName) + "-" + Date.now().toString(36);

    const school = await prisma.school.create({
      data: {
        name: schoolName,
        slug,
      },
    });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "SCHOOL_ADMIN",
        schoolId: school.id,
      },
    });

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      school: { id: school.id, name: school.name },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
