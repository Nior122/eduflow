"use client";

/**
 * Minimal markdown renderer for AI output (Phase 7).
 * Handles code fences, headings, bold/italic, bullets, numbered lists and
 * paragraphs — no extra dependencies.
 */
import { cn } from "@/lib/utils";

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={i}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      nodes.push(<em key={i}>{part.slice(1, -1)}</em>);
    } else {
      nodes.push(part);
    }
  });
  return nodes;
}

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let codeBuf: string[] = [];
  let listBuf: { ordered: boolean; items: React.ReactNode[] } | null = null;

  const flushCode = (key: string) => {
    if (!codeBuf.length) return;
    blocks.push(
      <pre key={key} className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono">
        {codeBuf.join("\n")}
      </pre>
    );
    codeBuf = [];
  };
  const flushList = (key: string) => {
    if (!listBuf) return;
    const items = listBuf.items;
    blocks.push(
      listBuf.ordered ? (
        <ol key={key} className="my-1.5 list-decimal space-y-0.5 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={key} className="my-1.5 list-disc space-y-0.5 pl-5">
          {items}
        </ul>
      )
    );
    listBuf = null;
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = `b${i}`;

    if (line.trim().startsWith("```")) {
      if (codeBuf.length || line.trim() !== "```") {
        if (!codeBuf.length && line.trim().length > 3) {
          // opening fence with language tag — start after it
        } else {
          flushCode(key);
          return;
        }
      }
      codeBuf = [];
      return;
    }

    const codeMatch = line.match(/^```(\w*)/);
    if (codeMatch) {
      flushList(key);
      codeBuf = [];
      return;
    }

    if (line.startsWith("    ") || line.startsWith("\t")) {
      flushList(key);
      codeBuf.push(line.replace(/^(\s{4}|\t)/, ""));
      return;
    }

    if (!line.trim()) {
      flushCode(key);
      flushList(key);
      blocks.push(<div key={key} className="h-2" />);
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)/);
    if (heading) {
      flushCode(key);
      flushList(key);
      const level = heading[1].length;
      const cls = level === 1 ? "text-base font-bold mt-2 mb-1" : level === 2 ? "text-sm font-bold mt-2 mb-1" : "text-sm font-semibold mt-1.5 mb-0.5";
      blocks.push(
        <p key={key} className={cls}>
          {renderInline(heading[2])}
        </p>
      );
      return;
    }

    const bullet = line.match(/^[-*•]\s+(.*)/);
    if (bullet) {
      flushCode(key);
      if (listBuf && !listBuf.ordered) {
        listBuf.items.push(<li key={key}>{renderInline(bullet[1])}</li>);
      } else {
        flushList(key);
        listBuf = { ordered: false, items: [<li key={key}>{renderInline(bullet[1])}</li>] };
      }
      return;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)/);
    if (numbered) {
      flushCode(key);
      if (listBuf && listBuf.ordered) {
        listBuf.items.push(<li key={key}>{renderInline(numbered[1])}</li>);
      } else {
        flushList(key);
        listBuf = { ordered: true, items: [<li key={key}>{renderInline(numbered[1])}</li>] };
      }
      return;
    }

    flushCode(key);
    flushList(key);
    blocks.push(<p key={key} className="my-1 whitespace-pre-wrap break-words">{renderInline(line)}</p>);
  });

  flushCode("last-code");
  flushList("last-list");

  return <div className={cn("text-sm leading-relaxed", className)}>{blocks}</div>;
}
