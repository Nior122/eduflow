// ─── Phase 4: result approval workflow ───────────────────────────────
// DRAFT → SUBMITTED → APPROVED → PUBLISHED → LOCKED
import type { ResultStatus } from "@prisma/client";

export const RESULT_STATUSES: ResultStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "PUBLISHED",
  "LOCKED",
];

export const STATUS_LABEL: Record<ResultStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

export const STATUS_BADGE: Record<ResultStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  APPROVED: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  LOCKED: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};

const TRANSITIONS: Record<ResultStatus, ResultStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED"],
  APPROVED: ["PUBLISHED"],
  PUBLISHED: ["LOCKED"],
  LOCKED: [],
};

export function canTransition(from: ResultStatus, to: ResultStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatus(from: ResultStatus): ResultStatus | null {
  return TRANSITIONS[from][0] ?? null;
}

/** Roles allowed to perform each workflow action. */
export const ACTION_ROLES: Record<string, readonly string[]> = {
  SUBMIT: ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"],
  APPROVE: ["SCHOOL_ADMIN", "SUPER_ADMIN"],
  PUBLISH: ["SCHOOL_ADMIN", "SUPER_ADMIN"],
  LOCK: ["SCHOOL_ADMIN", "SUPER_ADMIN"],
  REJECT: ["SCHOOL_ADMIN", "SUPER_ADMIN"],
};

export function actionFor(from: ResultStatus, to: ResultStatus): string {
  if (from === "DRAFT" && to === "SUBMITTED") return "SUBMIT";
  if (from === "SUBMITTED" && to === "APPROVED") return "APPROVE";
  if (from === "APPROVED" && to === "PUBLISHED") return "PUBLISH";
  if (from === "PUBLISHED" && to === "LOCKED") return "LOCK";
  return to;
}
