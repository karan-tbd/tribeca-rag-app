-- Add processing status and error tracking to documents table
-- Note: This migration requires pgvector extension to be enabled first

-- Add processing status columns to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP;

-- Add check constraint for processing_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_processing_status_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_processing_status_check
      CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed'));
  END IF;
END $$;

-- Add content and embedding storage to chunks table
ALTER TABLE public.chunks
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS embedding vector(1536), -- OpenAI text-embedding-3-small dimension (adjust if using different models)
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS embedding_model TEXT, -- Will be set from agent configuration, no default
  ADD COLUMN IF NOT EXISTS chunk_overlap_start INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunk_overlap_end INTEGER DEFAULT 0;

-- Add check constraint for chunks processing_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chunks_processing_status_check'
  ) THEN
    ALTER TABLE public.chunks
      ADD CONSTRAINT chunks_processing_status_check
      CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed'));
  END IF;
END $$;

-- Add indexes for efficient retrieval and similarity search
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_user_agent ON public.documents(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON public.chunks(document_id);
-- Index for chunks by document_id (no WHERE clause needed as all chunks should have valid document_id due to FK)
CREATE INDEX IF NOT EXISTS idx_chunks_document_id_processing ON public.chunks(document_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_chunks_processing_status ON public.chunks(processing_status);

-- Add function to calculate cosine similarity (for future vector search)
CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector)
RETURNS float
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT 1 - (a <=> b);
$$;

-- Add function to update document processing status
CREATE OR REPLACE FUNCTION update_document_processing_status(
  doc_id UUID,
  status TEXT,
  error_msg TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.documents 
  SET 
    processing_status = status,
    processing_error = error_msg,
    processed_at = CASE WHEN status = 'processed' THEN now() ELSE processed_at END,
    processing_started_at = CASE WHEN status = 'processing' THEN now() ELSE processing_started_at END
  WHERE id = doc_id;
END;
$$;

-- Add function to update chunk count
CREATE OR REPLACE FUNCTION update_document_chunk_count(doc_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.documents 
  SET chunk_count = (
    SELECT COUNT(*) 
    FROM public.chunks 
    WHERE document_id = doc_id AND processing_status = 'processed'
  )
  WHERE id = doc_id;
END;
$$;

-- Add RLS policies for new columns
-- (Existing policies should cover the new columns automatically)

-- Add trigger to automatically update chunk count when chunks are inserted/updated
CREATE OR REPLACE FUNCTION trigger_update_chunk_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update chunk count for the document
  PERFORM update_document_chunk_count(
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.document_id
      ELSE NEW.document_id
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for chunk count updates
DROP TRIGGER IF EXISTS trigger_chunks_update_count ON public.chunks;
CREATE TRIGGER trigger_chunks_update_count
  AFTER INSERT OR UPDATE OR DELETE ON public.chunks
  FOR EACH ROW EXECUTE FUNCTION trigger_update_chunk_count();

-- Add comment for documentation
COMMENT ON COLUMN public.documents.processing_status IS 'Status of document processing: pending, processing, processed, failed';
COMMENT ON COLUMN public.documents.processing_error IS 'Error message if processing failed';
COMMENT ON COLUMN public.chunks.content IS 'The actual text content of the chunk';
COMMENT ON COLUMN public.chunks.embedding IS 'OpenAI embedding vector for semantic search';
COMMENT ON COLUMN public.chunks.chunk_overlap_start IS 'Number of characters overlapping with previous chunk';
COMMENT ON COLUMN public.chunks.chunk_overlap_end IS 'Number of characters overlapping with next chunk';
