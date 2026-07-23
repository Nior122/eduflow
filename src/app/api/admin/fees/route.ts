import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fees = await prisma.fee.findMany({
    where: { schoolId: session.user.schoolId },
    include: { _count: { select: { feeRecords: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ fees });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const fee = await prisma.fee.create({
      data: { ...body, amount: parseFloat(body.amount), schoolId: session.user.schoolId },
    });
    return NextResponse.json({ fee }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create fee" }, { status: 500 });
  }
}
