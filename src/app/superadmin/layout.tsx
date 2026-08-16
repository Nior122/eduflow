import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SuperAdminNav } from "@/components/superadmin/nav";

/**
 * Super admin shell — SUPER_ADMIN only (middleware also gates /superadmin).
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    redirect("/unauthorized");
  }
  return (
    <div className="flex min-h-screen">
      <SuperAdminNav />
      <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
    </div>
  );
}
