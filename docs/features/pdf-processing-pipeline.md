# PDF Processing Pipeline

## Overview

The PDF Processing Pipeline is a comprehensive system that transforms uploaded PDF documents into searchable, retrievable chunks for RAG (Retrieval-Augmented Generation) queries. This implementation provides robust text extraction, semantic chunking, embedding generation, and real-time status tracking.

## Features

### 1. Robust PDF Text Extraction
- **Primary Method**: Uses pdf.js for accurate text extraction from PDF files
- **Fallback Method**: Simple text extraction for corrupted or unsupported PDFs
- **Error Handling**: Graceful degradation with detailed error reporting

### 2. Semantic Chunking with Overlap
- **Intelligent Splitting**: Breaks text at sentence boundaries for better semantic coherence
- **Configurable Size**: Default 1000 tokens per chunk (configurable via environment)
- **Overlap Strategy**: 200-token overlap between chunks to maintain context
- **Metadata Preservation**: Tracks overlap regions and chunk relationships

### 3. OpenAI Embedding Generation
- **Model**: Uses agent's configured `embed_model` (e.g., text-embedding-3-small, text-embedding-3-large)
- **Agent-Specific**: Each agent can use different embedding models for their documents
- **Batch Processing**: Processes chunks in configurable batches (default: 5 concurrent)
- **Retry Logic**: Exponential backoff for API failures
- **Rate Limiting**: Respects OpenAI API limits

### 4. Real-time Status Tracking
- **Processing States**: pending → processing → processed/failed
- **Progress Indicators**: Visual progress bars in UI
- **Error Reporting**: Detailed error messages for failed processing
- **Real-time Updates**: WebSocket subscriptions for live status updates

### 5. Database Integration
- **Atomic Transactions**: Ensures data consistency during processing
- **Chunk Storage**: Stores content, embeddings, and metadata
- **Version Control**: Tracks document versions and checksums
- **Performance Optimization**: Efficient indexes for retrieval

## Architecture

### Database Schema

```sql
-- Documents table with processing status
ALTER TABLE documents ADD COLUMN 
  processing_status TEXT DEFAULT 'pending',
  processed_at TIMESTAMP,
  chunk_count INTEGER DEFAULT 0,
  processing_error TEXT;

-- Chunks table with content and embeddings
ALTER TABLE chunks ADD COLUMN 
  content TEXT,
  embedding vector(1536),
  processing_status TEXT DEFAULT 'pending',
  embedding_model TEXT DEFAULT 'text-embedding-3-small';
```

### Edge Function Architecture

```typescript
// Main processing flow
1. Update document status to 'processing'
2. Fetch document with agent configuration (embed_model, etc.)
3. Download PDF from Supabase Storage
4. Extract text using pdf.js (with fallback)
5. Create semantic chunks with overlap
6. Generate embeddings using agent's configured model
7. Store chunks with metadata and embedding model info
8. Update document status to 'processed'
```

### UI Integration

```typescript
// Real-time status updates
const subscription = supabase
  .channel('document_changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'documents'
  }, handleStatusUpdate)
  .subscribe();
```

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...

# Processing Parameters
MAX_CHUNK_SIZE=1000          # Maximum tokens per chunk
CHUNK_OVERLAP=200            # Overlap between chunks
EMBEDDING_MODEL_FALLBACK=text-embedding-3-small  # Fallback if agent has no model configured
MAX_CONCURRENT_CHUNKS=5      # Concurrent embedding requests
```

### Feature Flags

```typescript
// Enable PDF processing
ENABLE_PDF_PROCESSING: true
```

### Agent-Based Configuration

The PDF processing pipeline uses the agent's configuration for embedding generation:

```typescript
// Agent configuration (from agents table)
{
  embed_model: "text-embedding-3-small",  // Used for document processing
  gen_model: "gpt-4o-mini",               // Used for chat responses
  k: 5,                                   // Number of chunks to retrieve
  sim_threshold: 0.75,                    // Similarity threshold for retrieval
  fail_safe_threshold: 0.5                // Fail-safe threshold for low confidence
}
```

**Benefits of Agent-Based Configuration:**
- **Flexibility**: Different agents can use different embedding models
- **Consistency**: Documents are processed with the same model the agent will use for retrieval
- **Optimization**: Agents can be optimized for specific use cases (e.g., code vs. documents)
- **Cost Control**: Use smaller models for less critical agents, larger models for important ones

## Usage

### 1. Document Upload

```typescript
// Upload PDF file
const { data, error } = await supabase
  .from('documents')
  .insert({
    user_id: user.id,
    agent_id: agentId,
    storage_path: path,
    title: fileName,
    processing_status: 'pending'
  });

// Trigger processing
await supabase.functions.invoke('process-document', {
  body: { documentId: data.id }
});
```

### 2. Status Monitoring

```typescript
// Check processing status
const { data: document } = await supabase
  .from('documents')
  .select('processing_status, chunk_count, processing_error')
  .eq('id', documentId)
  .single();

// Real-time updates
useEffect(() => {
  const subscription = supabase
    .channel('document_changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'documents',
      filter: `agent_id=eq.${agentId}`
    }, handleUpdate)
    .subscribe();
    
  return () => subscription.unsubscribe();
}, [agentId]);
```

### 3. Chunk Retrieval

```typescript
// Get processed chunks
const { data: chunks } = await supabase
  .from('chunks')
  .select('content, embedding, chunk_index, token_count')
  .eq('document_id', documentId)
  .eq('processing_status', 'processed')
  .order('chunk_index');
```

## Error Handling

### Common Error Scenarios

1. **PDF Extraction Failure**
   - Corrupted PDF files
   - Password-protected PDFs
   - Unsupported PDF formats

2. **OpenAI API Errors**
   - Rate limiting
   - API key issues
   - Network timeouts

3. **Database Errors**
   - Connection issues
   - Constraint violations
   - Storage failures

### Error Recovery

```typescript
// Automatic retry with exponential backoff
async function generateEmbeddingWithRetry(text, apiKey, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateEmbedding(text, apiKey);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Process multiple chunks concurrently
2. **Connection Pooling**: Reuse database connections
3. **Caching**: Cache embeddings for duplicate content
4. **Indexing**: Efficient database indexes for retrieval

### Monitoring Metrics

- Processing time per document
- Chunk generation rate
- Embedding API latency
- Error rates by type
- Memory usage patterns

## Testing

### Unit Tests
- Text extraction accuracy
- Chunking algorithm correctness
- Embedding generation
- Error handling scenarios

### Integration Tests
- End-to-end processing flow
- Database transaction integrity
- API rate limiting behavior
- Real-time status updates

### Performance Tests
- Large document processing (100+ pages)
- Concurrent processing requests
- Memory usage optimization
- Processing time benchmarks

## Future Enhancements

### Planned Features

1. **Vector Database Integration**: Pinecone/Weaviate for similarity search
2. **Advanced Chunking**: Hierarchical and semantic-aware chunking
3. **Multi-format Support**: Word documents, PowerPoint, etc.
4. **Batch Upload**: Process multiple documents simultaneously
5. **Content Analysis**: Automatic tagging and categorization

### Performance Improvements

1. **Streaming Processing**: Process large documents in streams
2. **Parallel Processing**: Multi-threaded chunk processing
3. **Smart Caching**: Cache embeddings and intermediate results
4. **Compression**: Optimize storage for embeddings

## Troubleshooting

### Common Issues

1. **Processing Stuck**: Check OpenAI API status and rate limits
2. **Empty Chunks**: Verify PDF text extraction is working
3. **Missing Embeddings**: Check API key and model availability
4. **UI Not Updating**: Verify WebSocket connection and subscriptions

### Debug Commands

```bash
# Check processing status
curl -X POST "${SUPABASE_URL}/functions/v1/process-document" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"documentId": "your-document-id"}'

# Run integration tests
node scripts/test-pdf-processing.js

# Check database state
psql -c "SELECT processing_status, chunk_count FROM documents WHERE id = 'your-document-id';"
```

## Security Considerations

1. **API Key Protection**: Store OpenAI keys securely
2. **File Validation**: Validate file types and sizes
3. **Access Control**: Ensure users can only process their own documents
4. **Rate Limiting**: Prevent abuse of processing resources
5. **Data Privacy**: Handle sensitive document content appropriately
