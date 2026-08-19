// src/lib/ai/errors.ts — consistent, human-readable AI error responses.
// Every AI route must return valid JSON on success AND failure. Never an
// empty body: an uncaught exception in a route handler makes Next.js
// return a 500 with an empty body, which breaks naive `res.json()` clients.
import { NextResponse } from "next/server";

/** Map a thrown provider/network error to a friendly user-facing message. */
export function friendlyAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "AI request failed");
  if (/no api key|api key|unauthorized|authentication|401|403/i.test(message)) {
    return "AI provider authentication failed. Check the provider API key.";
  }
  if (/429|rate.?limit/i.test(message)) {
    return "AI provider rate limit reached. Try again shortly.";
  }
  if (/timeout|timed out|aborted/i.test(message)) {
    return "AI request timed out. Try again.";
  }
  if (/5\d\d|temporarily unavailable|unavailable|fetch failed|econnrefused|enotfound|socket|econnreset/i.test(message)) {
    return "AI provider temporarily unavailable. Try again shortly.";
  }
  return message || "AI request failed";
}

/**
 * JSON error response for AI route failures.
 * Status 502 (Bad Gateway) — the failure happened while calling the
 * upstream AI provider, not in this application.
 */
export function aiErrorResponse(error: unknown, fallback = "AI request failed"): NextResponse {
  const message = friendlyAiError(error) || fallback;
  // Server-side visibility (Vercel function logs). Never logs keys/secrets.
  if (error instanceof Error) console.error("[ai] route error:", message, "|", error.message);
  else console.error("[ai] route error:", message, error);
  return NextResponse.json({ error: message }, { status: 502 });
}
