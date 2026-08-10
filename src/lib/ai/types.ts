/**
 * EduFlow AI — shared types (Phase 7).
 */

export type AiProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "openrouter"
  | "github"
  | "cloudflare";

export type AiRole = "system" | "user" | "assistant" | "tool";

export type AiToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AiMessage = {
  role: AiRole;
  content: string;
  /** role=tool: id of the tool call this result answers. */
  toolCallId?: string;
  /** role=tool: tool name. */
  name?: string;
  /** role=assistant: tool calls made by the model (provider history). */
  toolCalls?: AiToolCall[];
};

export type AiTool = {
  name: string;
  description: string;
  /** JSON schema of the arguments. */
  parameters: Record<string, unknown>;
};

export type AiRequest = {
  provider: AiProviderId;
  model?: string | null;
  temperature?: number;
  maxTokens?: number;
  messages: AiMessage[];
  tools?: AiTool[];
  jsonMode?: boolean;
};

export type AiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AiResult = {
  text: string;
  toolCalls: AiToolCall[];
  usage: AiUsage;
};

export type AiStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; tool: AiToolCall }
  | { type: "done"; usage: AiUsage }
  | { type: "error"; message: string };
