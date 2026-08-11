import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, libraryCategorySchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/notifications";

const CATALOG_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE_OFFICER", "TEACHER", "PARENT", "STUDENT"] as const;
const ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/library/categories — active categories with book counts. */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, CATALOG_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const categories = await prisma.libraryCategory.findMany({
    where: { schoolId, isActive: true },
    include: { _count: { select: { books: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ categories });
}

/** POST /api/library/categories — create a category. */
export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.id;
  if (!schoolId || !userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(libraryCategorySchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const category = await prisma.libraryCategory.create({
      data: { schoolId, name: parsed.data.name, description: parsed.data.description ?? null },
    });
    await logActivity({ userId, schoolId, action: "LIBRARY_CATEGORY_CREATED", entityType: "LibraryCategory", entityId: category.id });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    console.error("Failed to create category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
