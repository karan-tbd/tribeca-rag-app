# Agent Prompt: Robust PDF Processing Service Implementation

## Objective
Implement a robust multi-library PDF processing service to replace the current failing pdf.js implementation in the edge runtime environment. The new service should have multiple fallback mechanisms to ensure reliable text extraction from PDFs.

## Current Problem
The existing `extractPdfText` function in `supabase/functions/process-document/index.ts` uses pdf.js with a simple fallback to `blob.text()`, which often returns PDF metadata instead of actual content in edge runtime environments, causing document ingestion failures.

## Implementation Requirements

### 1. Create Multi-Library PDF Extraction Service
- **File**: `supabase/functions/_shared/pdf-extraction-service.ts`
- **Libraries to integrate**:
  - pdf.js (primary, with edge runtime optimizations)
  - pdf-parse (secondary fallback)
  - MuPDF WASM (for complex PDFs)
  - Poppler.js (for OCR-heavy PDFs)

### 2. Key Features to Implement
- **Confidence scoring system** (0-1) to evaluate extraction quality
- **Metadata detection** to avoid processing PDF internals
- **Automatic fallback chain** - try each library until valid text is found
- **Edge runtime compatibility** for all libraries
- **Graceful degradation** - return best available result if all methods partially fail

### 3. Quality Validation
- Minimum text length threshold (50 characters)
- Metadata ratio detection (reject if >30% looks like metadata)
- Readable text pattern matching for confidence scoring

### 4. Integration Points
- Update `supabase/functions/process-document/index.ts` to use new service
- Add comprehensive error logging with extraction method used
- Maintain backward compatibility with existing document processing flow

### 5. Testing Requirements
- Test with various PDF types (text-based, scanned, complex layouts)
- Verify edge runtime compatibility
- Test fallback mechanisms with intentionally broken libraries
- Performance benchmarking for each extraction method

### 6. Documentation Updates
- Update technical documentation with new architecture
- Add troubleshooting guide for PDF processing failures
- Document configuration options for each extraction library

### 7. Monitoring & Observability
- Log extraction method used and confidence scores
- Track success/failure rates by extraction method
- Add metrics for processing time per method

## Success Criteria
- ✅ PDF text extraction success rate >95%
- ✅ No more blob metadata being processed as content
- ✅ Graceful handling of edge runtime limitations
- ✅ Comprehensive fallback system working
- ✅ All existing document processing tests passing
- ✅ Performance maintained or improved

## Files to Modify
1. `supabase/functions/_shared/pdf-extraction-service.ts` (new)
2. `supabase/functions/process-document/index.ts` (update)
3. `docs/technical/pdf-processing.md` (update)
4. `supabase/functions/_shared/types.ts` (add interfaces)
5. Test files for PDF processing

## Priority
**P0 - Critical** - This blocks reliable document ingestion, which is core to the RAG functionality.

