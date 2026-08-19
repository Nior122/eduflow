/**
 * EduFlow — safe fetch helpers.
 *
 * Never call `response.json()` blindly: an error response with an empty
 * or non-JSON body (a Next.js 401/403/500 crash page, a proxy error, a
 * timed-out edge function) makes `res.json()` throw
 * "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
 *
 * `parseJsonBody` never throws: it reads the text once and resolves to an
 * empty object on empty/invalid bodies, so callers can safely read
 * `data.error` / `data.message` (or use optional chaining).
 *
 * It accepts `Response | Request` (both expose `.text()`) so it works as a
 * drop-in for `res.json()` in route handlers (Request bodies) and in
 * client pages (Response bodies). The default type is `any` on purpose —
 * it must be a drop-in replacement for `res.json()` at existing call sites
 * (which were typed `any`).
 */
export async function parseJsonBody<T = any>(res: Response | Request): Promise<T> {
  try {
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

/**
 * fetch + parseJsonBody in one call, tagged with the response status so
 * callers can branch on `ok` without a second read of the body.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(input, init);
  return { ok: res.ok, status: res.status, data: await parseJsonBody<T>(res) };
}
