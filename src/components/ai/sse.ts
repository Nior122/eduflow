/**
 * EduFlow AI — client-side SSE consumer (Phase 7).
 * Parses the text/event-stream responses produced by the AI routes.
 */

export type SseEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; tool: { name: string; arguments: Record<string, unknown> } }
  | { type: "done"; usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; conversationId?: string | null }
  | { type: "error"; message: string }
  | { type: "sources"; sources: string[] }
  | { type: "meta"; documentId: string };

export async function consumeSse(
  url: string,
  body: unknown,
  onEvent: (ev: SseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        onEvent(JSON.parse(payload) as SseEvent);
      } catch {
        /* ignore malformed frames */
      }
    }
  }
}
