import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/notifications";
import { getUsage, recordUsage } from "@/lib/saas/usage";
import { parsePlanFeatures } from "@/lib/saas/plans";

/**
 * POST /api/upload — generic authenticated file upload (attachments,
 * documents, avatar images). Stores under public/uploads/<folder> and
 * returns the public URL. 10 MB cap, extension allowlist.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const folderRaw = form.get("folder");
  const folder =
    typeof folderRaw === "string" && /^[a-z0-9-]{1,40}$/.test(folderRaw)
      ? folderRaw
      : "misc";

  try {
    // Phase 9: storage quota (plan limit in MB, metered in KB).
    const school = await prisma.school.findUnique({
      where: { id: session.user.schoolId },
      select: { subscription: { select: { plan: { select: { features: true } } } } },
    });
    const planFeatures = parsePlanFeatures(school?.subscription?.plan?.features);
    const usedKb = await getUsage(session.user.schoolId, "STORAGE_KB");
    const incomingKb = Math.ceil(file.size / 1024);
    if (usedKb + incomingKb > planFeatures.storageMb * 1024) {
      return NextResponse.json(
        { error: `Storage quota reached (${planFeatures.storageMb} MB). Upgrade your subscription for more storage.` },
        { status: 403 }
      );
    }

    const saved = await saveUpload(file, { folder });
    await recordUsage(session.user.schoolId, "STORAGE_KB", incomingKb);
    await logActivity({
      userId: session.user.id,
      schoolId: session.user.schoolId,
      action: "UPLOAD_FILE",
      entityType: "UPLOAD",
      metadata: { fileName: saved.fileName, url: saved.url },
    });
    return NextResponse.json({ upload: saved }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
