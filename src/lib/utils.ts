import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "₦0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function calculateGrade(total: number): string {
  if (total >= 75) return "A";
  if (total >= 70) return "B+";
  if (total >= 65) return "B";
  if (total >= 60) return "C+";
  if (total >= 55) return "C";
  if (total >= 50) return "D";
  if (total >= 40) return "E";
  return "F";
}

export function getAttendanceColor(status: string): string {
  switch (status) {
    case "PRESENT": return "text-green-500 bg-green-50 dark:bg-green-950/30";
    case "ABSENT": return "text-red-500 bg-red-50 dark:bg-red-950/30";
    case "LATE": return "text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30";
    case "EXCUSED": return "text-blue-500 bg-blue-50 dark:bg-blue-950/30";
    default: return "text-gray-500 bg-gray-50 dark:bg-gray-950/30";
  }
}

export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case "SUPER_ADMIN": return "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400";
    case "SCHOOL_ADMIN": return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400";
    case "TEACHER": return "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400";
    case "PARENT": return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400";
    case "STUDENT": return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400";
    default: return "bg-gray-100 text-gray-700 dark:bg-gray-950/30 dark:text-gray-400";
  }
}
