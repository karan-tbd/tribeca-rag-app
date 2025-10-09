// Shared chunking utilities for Edge Functions
// Token-based chunking with configurable overlap via environment variables.
// Tokens are approximated as 4 characters (fast heuristic suitable for sizing).

// deno-lint-ignore no-explicit-any
declare const Deno: any;

export function envNum(name: string, fallback: number): number {
  const v = Deno?.env?.get?.(name);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getChunkingParams() {
  // MAX_CHUNK_SIZE and CHUNK_OVERLAP are defined in .env/.env.example as token counts
  const maxTokens = envNum('MAX_CHUNK_SIZE', 1000);
  const overlapTokens = envNum('CHUNK_OVERLAP', Math.round(maxTokens * 0.1));
  return { maxTokens, overlapTokens };
}

// Rough token estimation: 1 token ≈ 4 characters
function approxTokens(chars: number) {
  return Math.ceil(chars / 4);
}

export type ChunkRecord = {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
  tokenCount: number;
  overlapStart: number; // overlap length at the start of this chunk in characters
  overlapEnd: number;   // overlap length at the end of this chunk in characters
};

export function chunkTextTokenOverlap(text: string, maxTokens: number, overlapTokens: number): ChunkRecord[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const chunks: ChunkRecord[] = [];

  let current = '';
  let currentTokens = 0;
  let chunkIndex = 0;
  let startChar = 0;

  for (const sentence of sentences) {
    const sentenceTokens = approxTokens(sentence.length);

    if (currentTokens + sentenceTokens > maxTokens && current.length > 0) {
      // finalize current chunk
      const endChar = startChar + current.length;
      chunks.push({
        content: current.trim(),
        index: chunkIndex++,
        startChar,
        endChar,
        tokenCount: approxTokens(current.length),
        overlapStart: 0,
        overlapEnd: 0,
      });

      // start new chunk with overlap
      const overlapChars = overlapTokens * 4;
      const overlapText = current.slice(-overlapChars);
      current = overlapText + (overlapText ? ' ' : '') + sentence.trim();
      currentTokens = approxTokens(current.length);
      startChar = endChar - overlapText.length;
    } else {
      current += (current ? ' ' : '') + sentence.trim();
      currentTokens += sentenceTokens;
    }
  }

  if (current.trim().length > 0) {
    chunks.push({
      content: current.trim(),
      index: chunkIndex,
      startChar,
      endChar: startChar + current.length,
      tokenCount: approxTokens(current.length),
      overlapStart: 0,
      overlapEnd: 0,
    });
  }

  // Populate approximate overlap metadata for neighbors
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      const prev = chunks[i - 1];
      const cur = chunks[i];
      const overlap = Math.max(0, prev.endChar - cur.startChar);
      prev.overlapEnd = overlap;
      cur.overlapStart = overlap;
    }
  }

  return chunks;
}

