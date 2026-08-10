/**
 * EduFlow AI — retrieval (Phase 7).
 * Lightweight, dependency-free chunking + keyword scoring used by the
 * Knowledge Base (RAG). Suitable for school-scale document sets; swap for
 * embeddings (e.g. pgvector) at larger scale.
 */

export function chunkText(text: string, size = 800, overlap = 100): string[] {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

export type RetrievedPassage = { text: string; source: string; score: number };

export function scoreChunks(query: string, doc: { id: string; title: string; chunks: unknown }): RetrievedPassage[] {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  const chunks = Array.isArray(doc.chunks) ? (doc.chunks as string[]) : [];
  return chunks
    .map((text, i) => {
      const lower = text.toLowerCase();
      const score = terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0) + (i === 0 ? 0.5 : 0);
      return { text, source: doc.title, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function mergePassages(results: RetrievedPassage[][], limit = 5): RetrievedPassage[] {
  const flat = results.flat().sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: RetrievedPassage[] = [];
  for (const p of flat) {
    const key = p.source + "|" + p.text.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
