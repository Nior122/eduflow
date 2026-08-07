import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, schoolSettingsSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });
  return NextResponse.json({ school });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(schoolSettingsSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const updateData: Prisma.SchoolUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.logo !== undefined && { logo: data.logo ?? null }),
      ...(data.address !== undefined && { address: data.address ?? null }),
      ...(data.phone !== undefined && { phone: data.phone ?? null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.website !== undefined && { website: data.website ?? null }),
      ...(data.motto !== undefined && { motto: data.motto ?? null }),
      ...(data.principal !== undefined && { principal: data.principal ?? null }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.timeZone !== undefined && { timeZone: data.timeZone ?? null }),
      ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor ?? null }),
      ...(data.secondaryColor !== undefined && { secondaryColor: data.secondaryColor ?? null }),
      ...(data.gradeSystem !== undefined && { gradeSystem: data.gradeSystem ?? null }),
      ...(data.attendanceRules !== undefined && { attendanceRules: data.attendanceRules ?? null }),
    };
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const school = await prisma.school.update({ where: { id: schoolId }, data: updateData });
    return NextResponse.json({ school });
  } catch (error) {
    console.error("Failed to update school settings:", error);
    return NextResponse.json({ error: "Failed to update school settings" }, { status: 500 });
  }
}
