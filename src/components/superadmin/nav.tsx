"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  TicketPercent,
  LifeBuoy,
  Settings,
  ScrollText,
  DatabaseBackup,
  LogOut,
  GraduationCap,
} from "lucide-react";

const items = [
  { label: "Overview", href: "/superadmin", icon: LayoutDashboard },
  { label: "Schools", href: "/superadmin/schools", icon: Building2 },
  { label: "Plans", href: "/superadmin/plans", icon: CreditCard },
  { label: "Coupons", href: "/superadmin/coupons", icon: TicketPercent },
  { label: "Support tickets", href: "/superadmin/tickets", icon: LifeBuoy },
  { label: "Audit log", href: "/superadmin/audit", icon: ScrollText },
  { label: "Backups", href: "/superadmin/backups", icon: DatabaseBackup },
  { label: "Platform settings", href: "/superadmin/settings", icon: Settings },
];

export function SuperAdminNav() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <GraduationCap className="h-5 w-5 text-primary" />
        <div>
          <div className="text-sm font-bold">EduFlow</div>
          <div className="text-xs text-sidebar-foreground/60">Platform Admin</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t p-3">
        <Link href="/admin/dashboard" className="block rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
          Back to app
        </Link>
        <button
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
