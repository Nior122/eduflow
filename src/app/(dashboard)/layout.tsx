import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/layout";

/**
 * Shared dashboard layout for every role portal (Phase 6): this group
 * layout replaces the per-role wrapper layouts so shared pages
 * (/messages, /notifications, /announcements, /documents, /profile,
 * /activity) render inside the sidebar shell for all roles.
 *
 * Phase 9: new schools with an incomplete onboarding wizard are sent to
 * /onboarding until their setup is finished.
 */
export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user?.role === "SCHOOL_ADMIN" && session.user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: session.user.schoolId },
      select: { onboardingComplete: true },
    });
    if (school && !school.onboardingComplete) {
      redirect("/onboarding");
    }
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}
