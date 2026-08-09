import type { UserRole } from "@prisma/client";

/**
 * PHASE 6 — Shared messaging helpers.
 */

export const MESSAGE_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "FINANCE_OFFICER",
  "TEACHER",
  "PARENT",
  "STUDENT",
];

/** Stable conversation key for a sender/receiver pair. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export type MessageAttachment = {
  name: string;
  url: string;
  size: number;
  mime?: string | null;
};

export function parseAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is MessageAttachment =>
      !!v && typeof v === "object" && typeof (v as MessageAttachment).name === "string" && typeof (v as MessageAttachment).url === "string"
  );
}
