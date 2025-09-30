import { ExtractionResult, ExtractionMethodResult } from "./types.ts";

// Utility: race a promise against a timeout
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]) as T;
}

// Simple quality scoring to detect metadata-heavy outputs and unreadable text
export function scoreExtractionText(text: string): { confidence: number; metadataRatio: number; length: number } {
  const t = (text || '').trim();
  const length = t.length;
  if (length === 0) return { confidence: 0, metadataRatio: 1, length: 0 };

  // Heuristics for PDF internals
  const metaPatterns = [/\bxref\b/gi, /\bobj\b/gi, /\bendobj\b/gi, /\bstream\b/gi, /\bendstream\b/gi, /<</g, />>/g, /\/Type\b/g, /%PDF-/g];
  let metaHits = 0;
  for (const r of metaPatterns) {
    const matches = t.match(r);
    if (matches) metaHits += matches.length;
  }
  // Very rough metadata ratio: meta token hits over approximate token count
  const approxTokens = Math.max(1, Math.ceil(length / 5));
  const metadataRatio = Math.min(1, metaHits / approxTokens);

  // Readability: letters, digits, spaces vs. punctuation noise
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  const digits = (t.match(/[0-9]/g) || []).length;
  const spaces = (t.match(/\s/g) || []).length;
  const readable = letters + digits + spaces;
  const readability = Math.min(1, readable / length);

  // Base score
  let confidence = 0.6 * readability + 0.4 * (1 - metadataRatio);
  // Penalize very short outputs
  if (length < 50) confidence *= length / 50;

  return { confidence: Number(confidence.toFixed(3)), metadataRatio, length };
}

async function extractWithPdfJs(blob: Blob): Promise<ExtractionMethodResult> {
  try {
    const ab = await blob.arrayBuffer();
    const uint8 = new Uint8Array(ab);
    // Dynamic import for Edge
    // deno-lint-ignore no-explicit-any
    const pdfjsLib: any = await import('https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs');
    try {
      if (pdfjsLib?.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      }
    } catch (_) {}
    // deno-lint-ignore no-explicit-any
    const loadingTask = (pdfjsLib as any).getDocument({ data: uint8, useSystemFonts: true, isEvalSupported: false });
    const pdf = await loadingTask.promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageText = (content.items || []).map((it: any) => (it && (it.str ?? ''))).join(' ');
      text += pageText + '\n';
    }
    try { await (pdf as any).cleanup?.(); } catch (_) {}
    return { ok: true, text: text.trim(), pageCount: pdf.numPages };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

// Optional/Best-effort: pdf-parse via ESM — may not work in Edge; guarded with try/catch
async function extractWithPdfParse(blob: Blob): Promise<ExtractionMethodResult> {
  try {
    // Many ESM builds of pdf-parse depend on Node buffers; this is best-effort and may throw.
    const ab = await blob.arrayBuffer();
    const uint8 = new Uint8Array(ab);
    // @ts-ignore dynamic import best-effort
    const pdfParse: any = await import('https://esm.sh/pdf-parse@1.1.1');
    const res = await pdfParse.default(uint8);
    if (res?.text) return { ok: true, text: String(res.text) };
    return { ok: false, error: 'pdf-parse returned empty' };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

// Placeholder/Best-effort: MuPDF WASM extraction
async function extractWithMuPdf(blob: Blob): Promise<ExtractionMethodResult> {
  try {
    // Attempt to import a WASM-capable MuPDF binding (may fail on Edge)
    // Using a placeholder path; gracefully fail if not available
    // @ts-ignore dynamic import best-effort
    const MuPDF: any = await import('https://esm.sh/mupdf-js@latest');
    if (!MuPDF?.extractText) throw new Error('MuPDF extractText not available');
    const ab = await blob.arrayBuffer();
    const text = await MuPDF.extractText(new Uint8Array(ab));
    if (text) return { ok: true, text: String(text) };
    return { ok: false, error: 'MuPDF returned empty' };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

// Placeholder/Best-effort: Poppler.js extraction (OCR-heavy PDFs)
async function extractWithPoppler(blob: Blob): Promise<ExtractionMethodResult> {
  try {
    // Poppler.js often requires FS/WASM setup; we keep this as best-effort
    // @ts-ignore dynamic import best-effort
    const Poppler: any = await import('https://esm.sh/poppler.js@latest');
    if (!Poppler?.extractText) throw new Error('Poppler extractText not available');
    const ab = await blob.arrayBuffer();
    const text = await Poppler.extractText(new Uint8Array(ab));
    if (text) return { ok: true, text: String(text) };
    return { ok: false, error: 'Poppler returned empty' };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function extractWithBlobText(blob: Blob): Promise<ExtractionMethodResult> {
  try {
    const t = await blob.text();
    return { ok: true, text: t };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function extractPdfWithFallback(blob: Blob): Promise<ExtractionResult> {
  const methods: Array<{ name: string; fn: (b: Blob) => Promise<ExtractionMethodResult>; timeoutMs: number }>
    = [
      { name: 'pdf.js', fn: extractWithPdfJs, timeoutMs: 15000 },
      { name: 'pdf-parse', fn: extractWithPdfParse, timeoutMs: 8000 },
      { name: 'MuPDF', fn: extractWithMuPdf, timeoutMs: 8000 },
      { name: 'Poppler.js', fn: extractWithPoppler, timeoutMs: 8000 },
      { name: 'Blob.text', fn: extractWithBlobText, timeoutMs: 3000 },
    ];

  let best: ExtractionResult | null = null;
  const minLength = 50;
  const maxMetaRatio = 0.3;

  for (const m of methods) {
    try {
      const res = await withTimeout(m.fn(blob), m.timeoutMs, m.name);
      if (!res.ok || !res.text) {
        console.warn(`[extract] ${m.name} failed: ${res.error || 'unknown error'}`);
        continue;
      }
      const { confidence, metadataRatio, length } = scoreExtractionText(res.text);
      const candidate: ExtractionResult = {
        text: res.text,
        method: m.name,
        pageCount: res.pageCount,
        confidence,
        metadataRatio,
      };

      // Accept if passes thresholds
      if (length >= minLength && (metadataRatio ?? 1) <= maxMetaRatio && confidence >= 0.4) {
        return candidate;
      }

      // Otherwise track the best so far
      if (!best || candidate.confidence > best.confidence) {
        best = candidate;
      }
    } catch (e) {
      console.warn(`[extract] ${m.name} error:`, (e as Error)?.message || e);
      continue;
    }
  }

  // Graceful degradation: return best available result (may be low confidence)
  return best ?? { text: '', method: 'none', confidence: 0, metadataRatio: 1 };
}

