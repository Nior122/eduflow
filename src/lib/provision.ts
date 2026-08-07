import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Prisma, UserRole } from "@prisma/client";

export function generateTempPassword(): string {
  return randomBytes(6).toString("hex");
}

export function generateReference(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

/** Auto-generated admission number, e.g. ADM-2026-4F2A9B. */
export function generateAdmissionNumber(): string {
  const year = new Date().getFullYear();
  return `ADM-${year}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Creates a login account (User row) for a newly created student/teacher/parent.
 * Uses the provided email when available, otherwise a deterministic auto
 * address scoped to the school. The generated temp password is returned
 * exactly once to the caller (the admin UI shows it in a dialog).
 */
export async function provisionUser(
  opts: { email: string; role: UserRole; schoolId: string; name: string; phone?: string | null },
  tx?: Prisma.TransactionClient
): Promise<{ userId: string; tempPassword: string; loginEmail: string }> {
  const db = tx ?? prisma;
  const loginEmail =
    opts.email.trim() || `auto-${opts.schoolId.slice(0, 6)}-${Date.now().toString(36)}@eduflow.local`;
  const tempPassword = generateTempPassword();
  const user = await db.user.create({
    data: {
      email: loginEmail,
      passwordHash: await hash(tempPassword, 12),
      role: opts.role,
      schoolId: opts.schoolId,
      name: opts.name,
      phone: opts.phone ?? null,
      isActive: true,
    },
  });
  return { userId: user.id, tempPassword, loginEmail };
}
