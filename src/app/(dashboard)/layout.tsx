import DashboardLayout from "@/components/dashboard/layout";

/**
 * Shared dashboard layout for every role portal (Phase 6): this group
 * layout replaces the per-role wrapper layouts so shared pages
 * (/messages, /notifications, /announcements, /documents, /profile,
 * /activity) render inside the sidebar shell for all roles.
 */
export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
