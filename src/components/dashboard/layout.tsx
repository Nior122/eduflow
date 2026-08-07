"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  FileSpreadsheet,
  DollarSign,
  Megaphone,
  BarChart3,
  Brain,
  LogOut,
  ChevronLeft,
  Menu,
  BookMarked,
  Home,
  Sparkles,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { getInitials } from "@/lib/utils";
import { useMemo, useState } from "react";

type NavItem = {
  label: string;
  icon: React.ElementType;
  href: string;
  roles?: string[];
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { label: "Students", icon: Users, href: "/admin/students", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { label: "Teachers", icon: GraduationCap, href: "/admin/teachers", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { label: "Classes", icon: BookOpen, href: "/admin/classes", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { label: "Subjects", icon: BookMarked, href: "/admin/subjects", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { label: "Fees", icon: DollarSign, href: "/admin/fees", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { label: "Reports", icon: BarChart3, href: "/admin/reports", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
  { label: "Announcements", icon: Megaphone, href: "/admin/announcements", roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },

  { label: "Dashboard", icon: LayoutDashboard, href: "/teacher/dashboard", roles: ["TEACHER"] },
  { label: "Attendance", icon: ClipboardCheck, href: "/teacher/attendance", roles: ["TEACHER"] },
  { label: "Results", icon: FileSpreadsheet, href: "/teacher/results", roles: ["TEACHER"] },
  { label: "Lesson Plans", icon: BookMarked, href: "/teacher/lesson-plans", roles: ["TEACHER"] },
  { label: "AI Reports", icon: Brain, href: "/teacher/report-comments", roles: ["TEACHER"] },

  { label: "Dashboard", icon: LayoutDashboard, href: "/parent/dashboard", roles: ["PARENT"] },

  { label: "Dashboard", icon: LayoutDashboard, href: "/student/dashboard", roles: ["STUDENT"] },
  { label: "Homework Help", icon: Sparkles, href: "/student/homework-assistant", roles: ["STUDENT"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = session?.user?.role || "SCHOOL_ADMIN";
  const schoolId = session?.user?.schoolId;

  const filteredNav = useMemo(
    () => navItems.filter((item) => !item.roles || item.roles.includes(role)),
    [role]
  );

  const isTeacherRoute = pathname.startsWith("/teacher");
  const isParentRoute = pathname.startsWith("/parent");
  const isStudentRoute = pathname.startsWith("/student");
  const isAdminRoute = pathname.startsWith("/admin");

  const getRoleTitle = () => {
    if (isAdminRoute) return "Admin Dashboard";
    if (isTeacherRoute) return "Teacher Portal";
    if (isParentRoute) return "Parent Portal";
    if (isStudentRoute) return "Student Portal";
    return "Dashboard";
  };

  const user = session?.user;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-16",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <Link href="/" className={cn("flex items-center gap-2", !sidebarOpen && "justify-center w-full")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            {sidebarOpen && <span className="text-lg font-bold">EduFlow</span>}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sidebar-accent"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  !sidebarOpen && "justify-center px-2"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-2">
          <div className={cn("flex items-center gap-3 rounded-lg px-3 py-2", !sidebarOpen && "justify-center")}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.image || ""} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{getRoleTitle()}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => signOut()}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors w-full mt-1",
              !sidebarOpen && "justify-center"
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn("transition-all duration-300", sidebarOpen ? "lg:ml-64" : "lg:ml-16")}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-xl px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{getRoleTitle()}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
