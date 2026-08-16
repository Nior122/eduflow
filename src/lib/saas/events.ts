// ─── Phase 9: webhook event catalog ──────────────────────────────────
// Canonical event names a school can subscribe to. New domains append
// here and call queueWebhookEvent(...) at the moment of change.
export const WEBHOOK_EVENTS = [
  "student.created",
  "student.updated",
  "teacher.created",
  "payment.received",
  "result.published",
  "attendance.recorded",
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];
