-- Create RPC for pgvector similarity search over chunks
-- Uses cosine distance operator <=> and returns similarity

-- Drop older variants if they exist to avoid ambiguity during upgrades/resets
DROP FUNCTION IF EXISTS public.match_chunks(vector, uuid[], integer, double precision);
DROP FUNCTION IF EXISTS public.match_chunks(vector, uuid[], integer, real);
DROP FUNCTION IF EXISTS public.match_chunks(vector, uuid[], integer, float);
DROP FUNCTION IF EXISTS public.match_chunks(text, uuid[], integer, double precision);

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding text,
  doc_ids uuid[],
  match_count integer DEFAULT 5,
  similarity_threshold double precision DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  version_id uuid,
  page_start integer,
  page_end integer,
  chunk_index integer,
  content text,
  distance double precision,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_id,
    c.version_id,
    c.page_start,
    c.page_end,
    c.chunk_index,
    c.content,
    (c.embedding <=> (query_embedding::vector)) AS distance,
    1 - (c.embedding <=> (query_embedding::vector)) AS similarity
  FROM public.chunks c
  WHERE c.processing_status = 'processed'
    AND c.embedding IS NOT NULL
    AND c.document_id = ANY (doc_ids)
    AND (c.embedding <=> (query_embedding::vector)) <= (1 - similarity_threshold)
  ORDER BY c.embedding <=> (query_embedding::vector)
  LIMIT match_count;
$$;

-- Allow typical roles to execute (Edge Function uses service role; grant for completeness)
GRANT EXECUTE ON FUNCTION public.match_chunks(text, uuid[], integer, double precision) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.match_chunks(text, uuid[], integer, double precision)
IS 'Returns top-k chunks by cosine similarity for given documents with pgvector (filters by similarity_threshold).';

