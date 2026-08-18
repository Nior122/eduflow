/**
 * EduFlow AI — provider abstraction (Phase 7).
 *
 * One normalized interface over OpenAI, Anthropic, Google Gemini, Groq,
 * OpenRouter, GitHub Models and Cloudflare AI. Providers are selected by
 * configuration only; API keys always come from environment variables and
 * are never exposed to clients. All implementations use the platform
 * `fetch` API (no SDKs), support streaming via SSE, tool calling and a
 * small retry policy (429/5xx).
 */
import type {
  AiMessage,
  AiProviderId,
  AiRequest,
  AiResult,
  AiStreamEvent,
  AiTool,
  AiToolCall,
} from "./types";

export const AI_PROVIDERS: Record<
  AiProviderId,
  { label: string; envKey: string; envAccount?: string; defaultModel: string; baseUrl: string }
> = {
  openai:     { label: "OpenAI", envKey: "OPENAI_API_KEY", defaultModel: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  anthropic:  { label: "Anthropic", envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-3-5-haiku-latest", baseUrl: "https://api.anthropic.com" },
  gemini:     { label: "Google Gemini", envKey: "GEMINI_API_KEY", defaultModel: "gemini-1.5-flash", baseUrl: "https://generativelanguage.googleapis.com" },
  groq:       { label: "Groq", envKey: "GROQ_API_KEY", defaultModel: "llama-3.3-70b-versatile", baseUrl: "https://api.groq.com/openai/v1" },
  openrouter: { label: "OpenRouter", envKey: "OPENROUTER_API_KEY", defaultModel: "meta-llama/llama-3.3-70b-instruct", baseUrl: "https://openrouter.ai/api/v1" },
  github:     { label: "GitHub Models", envKey: "GITHUB_TOKEN", defaultModel: "gpt-4o-mini", baseUrl: "https://models.inference.ai.azure.com" },
  cloudflare: { label: "Cloudflare AI", envKey: "CLOUDFLARE_API_TOKEN", envAccount: "CLOUDFLARE_ACCOUNT_ID", defaultModel: "@cf/meta/llama-3.1-8b-instruct", baseUrl: "https://api.cloudflare.com/client/v4/accounts" },
};

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AiProviderId[];

export function providerKey(id: AiProviderId): string | null {
  const p = AI_PROVIDERS[id];
  const key = process.env[p.envKey];
  if (!key) return null;
  if (p.envAccount && !process.env[p.envAccount]) return null;
  return key;
}

export function availableProviders(): AiProviderId[] {
  return AI_PROVIDER_IDS.filter((p) => providerKey(p));
}

export function resolveModel(id: AiProviderId, model?: string | null): string {
  return model || AI_PROVIDERS[id].defaultModel;
}

// ─── helpers ─────────────────────────────────────────────────────────

function newId(): string {
  return `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeJsonParse(s: string | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  let last: Response | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Hard timeout per attempt so a hung provider cannot hang the route.
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
      if (res.status === 429 || res.status >= 500) {
        last = res;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      } else {
        return res;
      }
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  if (lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));
  throw await errorFrom(last!);
}

async function errorFrom(res: Response): Promise<Error> {
  const status = res.status;
  let reason = "";
  if (status === 401 || status === 403) reason = "AI provider authentication failed";
  else if (status === 429) reason = "AI provider rate limit reached";
  else if (status === 404) reason = "AI provider endpoint or model not found";
  else if (status >= 500) reason = "AI provider temporarily unavailable";
  const body = await res.text().catch(() => "");
  return new Error(`${reason || `AI provider error (${status})`}${body ? `: ${body.slice(0, 300)}` : ""}`);
}

export function truncateText(text: string, max = 12000): string {
  return text.length > max ? text.slice(0, max) : text;
}

// ─── OpenAI-compatible family (openai, groq, openrouter, github, cloudflare) ──

function openAiBase(id: AiProviderId): string {
  if (id === "cloudflare") {
    return `${AI_PROVIDERS.cloudflare.baseUrl}/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`;
  }
  return AI_PROVIDERS[id].baseUrl;
}

function toOpenAiMessages(messages: AiMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      out.push({ role: "system", content: m.content });
    } else if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "tool") {
      out.push({ role: "tool", tool_call_id: m.toolCallId ?? "", content: m.content });
    } else {
      out.push({
        role: "assistant",
        content: m.content || null,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
              })),
            }
          : {}),
      });
    }
  }
  return out;
}

function openAiTools(tools: AiTool[] | undefined) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function openAiBody(req: AiRequest, stream: boolean): Record<string, unknown> {
  return {
    model: resolveModel(req.provider, req.model),
    messages: toOpenAiMessages(req.messages),
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 2048,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(openAiTools(req.tools) ? { tools: openAiTools(req.tools) } : {}),
  };
}

function parseOpenAiToolCalls(message: Record<string, unknown> | undefined): AiToolCall[] {
  const raw = Array.isArray(message?.tool_calls) ? (message.tool_calls as Record<string, unknown>[]) : [];
  return raw.map((tc) => {
    const fn = (tc.function ?? {}) as Record<string, unknown>;
    return {
      id: typeof tc.id === "string" ? tc.id : newId(),
      name: typeof fn.name === "string" ? fn.name : "",
      arguments: safeJsonParse(typeof fn.arguments === "string" ? fn.arguments : undefined),
    };
  });
}

async function completeOpenAiCompat(req: AiRequest): Promise<AiResult> {
  const res = await fetchWithRetry(`${openAiBase(req.provider)}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerKey(req.provider)}` },
    body: JSON.stringify(openAiBody(req, false)),
  });
  if (!res.ok) throw await errorFrom(res);
  const data = (await res.json()) as {
    choices?: { message?: Record<string, unknown> }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const message = data.choices?.[0]?.message;
  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  return {
    text: typeof message?.content === "string" ? message.content : "",
    toolCalls: parseOpenAiToolCalls(message),
    usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
  };
}

async function* streamOpenAiCompat(req: AiRequest): AsyncGenerator<AiStreamEvent> {
  const res = await fetchWithRetry(`${openAiBase(req.provider)}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerKey(req.provider)}` },
    body: JSON.stringify(openAiBody(req, true)),
  });
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const toolAcc = new Map<number, { id: string; name: string; args: string }>();
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        let chunk: {
          choices?: { delta?: Record<string, unknown> }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        try {
          chunk = JSON.parse(payload) as typeof chunk;
        } catch {
          continue;
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens ?? 0,
            completionTokens: chunk.usage.completion_tokens ?? 0,
            totalTokens: (chunk.usage.prompt_tokens ?? 0) + (chunk.usage.completion_tokens ?? 0),
          };
        }
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;
        if (typeof delta.content === "string" && delta.content) {
          yield { type: "text", delta: delta.content };
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const raw of delta.tool_calls as Record<string, unknown>[]) {
            const idx = typeof raw.index === "number" ? raw.index : 0;
            const acc = toolAcc.get(idx) ?? { id: "", name: "", args: "" };
            if (typeof raw.id === "string") acc.id = raw.id;
            const fn = (raw.function ?? {}) as Record<string, unknown>;
            if (typeof fn.name === "string") acc.name = fn.name;
            if (typeof fn.arguments === "string") acc.args += fn.arguments;
            toolAcc.set(idx, acc);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  for (const acc of toolAcc.values()) {
    if (acc.name) {
      yield { type: "tool_call", tool: { id: acc.id || newId(), name: acc.name, arguments: safeJsonParse(acc.args) } };
    }
  }
  yield { type: "done", usage };
}

// ─── Anthropic ───────────────────────────────────────────────────────

function toAnthropic(messages: AiMessage[]): { system: string; messages: Record<string, unknown>[] } {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      out.push({ role: "user", content: [{ type: "tool_result", tool_use_id: m.toolCallId ?? "", content: m.content }] });
    } else if (m.role === "assistant") {
      const content: Record<string, unknown>[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      out.push({ role: "assistant", content });
    } else {
      out.push({ role: "user", content: m.content });
    }
  }
  return { system, messages: out };
}

function anthropicHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": providerKey("anthropic") ?? "",
    "anthropic-version": "2023-06-01",
  };
}

function anthropicTools(tools: AiTool[] | undefined) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
}

async function completeAnthropic(req: AiRequest): Promise<AiResult> {
  const { system, messages } = toAnthropic(req.messages);
  const res = await fetchWithRetry(`${AI_PROVIDERS.anthropic.baseUrl}/v1/messages`, {
    method: "POST",
    headers: anthropicHeaders(),
    body: JSON.stringify({
      model: resolveModel("anthropic", req.model),
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
      system: system || undefined,
      messages,
      ...(anthropicTools(req.tools) ? { tools: anthropicTools(req.tools) } : {}),
    }),
  });
  if (!res.ok) throw await errorFrom(res);
  const data = (await res.json()) as {
    content?: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  let text = "";
  const toolCalls: AiToolCall[] = [];
  for (const block of data.content ?? []) {
    if (block.type === "text" && block.text) text += block.text;
    if (block.type === "tool_use" && block.name) {
      toolCalls.push({
        id: block.id ?? newId(),
        name: block.name,
        arguments: block.input && typeof block.input === "object" ? (block.input as Record<string, unknown>) : {},
      });
    }
  }
  const promptTokens = data.usage?.input_tokens ?? 0;
  const completionTokens = data.usage?.output_tokens ?? 0;
  return { text, toolCalls, usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens } };
}

async function* streamAnthropic(req: AiRequest): AsyncGenerator<AiStreamEvent> {
  const { system, messages } = toAnthropic(req.messages);
  const res = await fetchWithRetry(`${AI_PROVIDERS.anthropic.baseUrl}/v1/messages`, {
    method: "POST",
    headers: anthropicHeaders(),
    body: JSON.stringify({
      model: resolveModel("anthropic", req.model),
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
      system: system || undefined,
      messages,
      stream: true,
      ...(anthropicTools(req.tools) ? { tools: anthropicTools(req.tools) } : {}),
    }),
  });
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const toolAcc = new Map<number, { id: string; name: string; args: string }>();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      let eventType = "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("event:")) {
          eventType = trimmed.slice(6).trim();
          continue;
        }
        if (!trimmed.startsWith("data:")) continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(trimmed.slice(5).trim()) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (eventType === "message_start" && typeof data.message === "object") {
          const usage = (data.message as Record<string, unknown>).usage as Record<string, unknown> | undefined;
          inputTokens = typeof usage?.input_tokens === "number" ? usage.input_tokens : 0;
        } else if (eventType === "message_delta" && typeof data.usage === "object") {
          const usage = data.usage as Record<string, unknown>;
          outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
        } else if (eventType === "content_block_start" && typeof data.content_block === "object") {
          const block = data.content_block as Record<string, unknown>;
          const idx = typeof data.index === "number" ? data.index : 0;
          if (block.type === "tool_use") {
            toolAcc.set(idx, { id: typeof block.id === "string" ? block.id : newId(), name: typeof block.name === "string" ? block.name : "", args: "" });
          }
        } else if (eventType === "content_block_delta" && typeof data.delta === "object") {
          const delta = data.delta as Record<string, unknown>;
          const idx = typeof data.index === "number" ? data.index : 0;
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            yield { type: "text", delta: delta.text };
          } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
            const acc = toolAcc.get(idx) ?? { id: newId(), name: "", args: "" };
            acc.args += delta.partial_json;
            toolAcc.set(idx, acc);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  for (const acc of toolAcc.values()) {
    if (acc.name) {
      yield { type: "tool_call", tool: { id: acc.id, name: acc.name, arguments: safeJsonParse(acc.args) } };
    }
  }
  yield { type: "done", usage: { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens + outputTokens } };
}

// ─── Google Gemini ───────────────────────────────────────────────────

function toGemini(messages: AiMessage[]): { system: string; contents: Record<string, unknown>[] } {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: m.name ?? "tool", response: safeJsonParse(m.content) } }],
      });
    } else if (m.role === "assistant") {
      const parts: Record<string, unknown>[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls ?? []) parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
      contents.push({ role: "model", parts });
    } else {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    }
  }
  return { system, contents };
}

function geminiUrl(req: AiRequest, stream: boolean): string {
  const model = resolveModel("gemini", req.model);
  return `${AI_PROVIDERS.gemini.baseUrl}/v1beta/models/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}?key=${providerKey("gemini")}`;
}

function geminiBody(req: AiRequest): Record<string, unknown> {
  const { system, contents } = toGemini(req.messages);
  return {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      temperature: req.temperature ?? 0.7,
      maxOutputTokens: req.maxTokens ?? 2048,
      ...(req.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
    ...(req.tools?.length
      ? {
          tools: [
            {
              functionDeclarations: req.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            },
          ],
        }
      : {}),
  };
}

function parseGeminiParts(parts: Record<string, unknown>[] | undefined): { text: string; toolCalls: AiToolCall[] } {
  let text = "";
  const toolCalls: AiToolCall[] = [];
  for (const part of parts ?? []) {
    if (typeof part.text === "string") text += part.text;
    if (part.functionCall && typeof part.functionCall === "object") {
      const fc = part.functionCall as Record<string, unknown>;
      if (typeof fc.name === "string") {
        toolCalls.push({
          id: newId(),
          name: fc.name,
          arguments: fc.args && typeof fc.args === "object" ? (fc.args as Record<string, unknown>) : {},
        });
      }
    }
  }
  return { text, toolCalls };
}

async function completeGemini(req: AiRequest): Promise<AiResult> {
  const res = await fetchWithRetry(geminiUrl(req, false), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody(req)),
  });
  if (!res.ok) throw await errorFrom(res);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: Record<string, unknown>[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const { text, toolCalls } = parseGeminiParts(data.candidates?.[0]?.content?.parts);
  const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  return { text, toolCalls, usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens } };
}

async function* streamGemini(req: AiRequest): AsyncGenerator<AiStreamEvent> {
  const res = await fetchWithRetry(geminiUrl(req, true), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody(req)),
  });
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let sawText = false;
  const seenFunctions = new Map<string, AiToolCall>();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        let chunk: {
          candidates?: { content?: { parts?: Record<string, unknown>[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };
        try {
          chunk = JSON.parse(payload) as typeof chunk;
        } catch {
          continue;
        }
        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount ?? 0;
          completionTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
        }
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (typeof part.text === "string" && part.text) {
            sawText = true;
            yield { type: "text", delta: part.text };
          }
          if (part.functionCall && typeof part.functionCall === "object") {
            const fc = part.functionCall as Record<string, unknown>;
            if (typeof fc.name === "string") {
              const existing = seenFunctions.get(fc.name) ?? { id: newId(), name: fc.name, arguments: {} };
              if (fc.args && typeof fc.args === "object") {
                existing.arguments = { ...existing.arguments, ...(fc.args as Record<string, unknown>) };
              }
              seenFunctions.set(fc.name, existing);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  for (const tc of seenFunctions.values()) {
    yield { type: "tool_call", tool: tc };
  }
  yield {
    type: "done",
    usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
  };
}

// ─── unified entry points ────────────────────────────────────────────

export async function complete(req: AiRequest): Promise<AiResult> {
  if (!providerKey(req.provider)) {
    throw new Error(
      `No API key configured for AI provider "${req.provider}" - set ${AI_PROVIDERS[req.provider].envKey} in the environment`
    );
  }
  if (req.provider === "anthropic") return completeAnthropic(req);
  if (req.provider === "gemini") return completeGemini(req);
  return completeOpenAiCompat(req);
}

export async function* stream(req: AiRequest): AsyncGenerator<AiStreamEvent> {
  if (!providerKey(req.provider)) {
    throw new Error(
      `No API key configured for AI provider "${req.provider}" - set ${AI_PROVIDERS[req.provider].envKey} in the environment`
    );
  }
  if (req.provider === "anthropic") {
    yield* streamAnthropic(req);
    return;
  }
  if (req.provider === "gemini") {
    yield* streamGemini(req);
    return;
  }
  yield* streamOpenAiCompat(req);
}
