# PDF Processing Architecture

## Overview
The PDF processing service uses a multi-library approach with automatic fallbacks to ensure reliable text extraction in edge runtime environments.

## Architecture

### PDFExtractionService
Located in `supabase/functions/_shared/pdf-extraction-service.ts`

**Extraction Chain:**
1. **pdf.js** (primary) - Fast, edge-optimized
2. **pdf-parse** (fallback) - Node.js compatible alternative  
3. **MuPDF WASM** (complex PDFs) - Handles advanced layouts
4. **Poppler.js** (OCR-heavy) - Best for scanned documents

### Quality Validation
- **Confidence Scoring**: 0-1 based on text patterns and metadata detection
- **Metadata Detection**: Rejects extractions with >30% PDF internals
- **Minimum Length**: Requires 50+ characters for valid extraction

### Edge Runtime Optimizations
- Disabled font loading and evaluation for pdf.js
- Dynamic imports for library compatibility
- Memory cleanup after processing
- Timeout handling for large files

## Configuration

```typescript
interface ExtractionResult {
  text: string;
  method: string;
  pageCount?: number;
  confidence: number; // 0-1 quality score
}
```

## Error Handling
- Graceful degradation through fallback chain
- Returns best available result if all methods partially fail
- Comprehensive logging for debugging extraction issues

## Performance
- Average processing time: 2-5 seconds per PDF
- Memory usage optimized for edge runtime
- Automatic cleanup prevents memory leaks

