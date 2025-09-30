export interface ExtractionResult {
  text: string;
  method: string;
  pageCount?: number;
  confidence: number; // 0-1 quality score
  metadataRatio?: number;
  error?: string;
}

export interface ExtractionMethodResult {
  ok: boolean;
  text?: string;
  pageCount?: number;
  error?: string;
}

