import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, studentImportSchema } from "@/lib/validations";
import { provisionUser, generateAdmissionNumber } from "@/lib/provision";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(studentImportSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { rows } = parsed.data;

    // Map class names to ids for this school (case-insensitive).
    const classes = await prisma.class.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
    });
    const classMap = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c.id]));

    const results: Array<{ row: number; ok: boolean; admissionNumber?: string; error?: string }> = [];

    for (const [index, row] of rows.entries()) {
      const rowNo = index + 1;
      try {
        const classId = row.className ? classMap.get(row.className.trim().toLowerCase()) : undefined;
        const admissionNumber = row.admissionNumber || generateAdmissionNumber();

        await prisma.$transaction(async (tx) => {
          const creds = await provisionUser(
            {
              email: row.email ?? "",
              role: "STUDENT",
              schoolId,
              name: `${row.firstName} ${row.lastName}`,
              phone: row.phone ?? null,
            },
            tx
          );
          const importedStudent = await tx.student.create({
            data: {
              firstName: row.firstName,
              lastName: row.lastName,
              middleName: row.middleName ?? null,
              email: creds.loginEmail,
              phone: row.phone ?? null,
              gender: row.gender ?? null,
              dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
              admissionNumber,
              classId: classId ?? null,
              schoolId,
              userId: creds.userId,
            },
          });
          await tx.studentTimeline.create({
            data: {
              studentId: importedStudent.id,
              event: "Imported",
              note: `Bulk import (row ${rowNo})`,
            },
          });
        });
        results.push({ row: rowNo, ok: true, admissionNumber });
      } catch (error) {
        const message =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
            ? "Duplicate admission number or email"
            : error instanceof Error
              ? error.message
              : "Failed to import";
        results.push({ row: rowNo, ok: false, error: message });
      }
    }

    const created = results.filter((r) => r.ok).length;
    return NextResponse.json(
      { created, failed: rows.length - created, results },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to import students:", error);
    return NextResponse.json({ error: "Failed to import students" }, { status: 500 });
  }
}
