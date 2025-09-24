-- Recreate missing processing functions and trigger (idempotent)
-- Safe to run multiple times; uses OR REPLACE and conditional trigger drop

-- Ensure pgvector extension exists (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Cosine similarity helper for vector search
CREATE OR REPLACE FUNCTION public.cosine_similarity(a vector, b vector)
RETURNS float
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT 1 - (a <=> b);
$$;

-- Update document processing status
CREATE OR REPLACE FUNCTION public.update_document_processing_status(
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

-- Recalculate processed chunk count for a document
CREATE OR REPLACE FUNCTION public.update_document_chunk_count(doc_id UUID)
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

-- Trigger function: keep chunk_count in sync
CREATE OR REPLACE FUNCTION public.trigger_update_chunk_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.update_document_chunk_count(
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.document_id
      ELSE NEW.document_id
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on chunks table (recreated each time to ensure it exists)
DROP TRIGGER IF EXISTS trigger_chunks_update_count ON public.chunks;
CREATE TRIGGER trigger_chunks_update_count
  AFTER INSERT OR UPDATE OR DELETE ON public.chunks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_chunk_count();

