-- Ensure documents.chunk_count reflects only the latest version's processed chunks
-- Rather than all chunks across all versions

BEGIN;

CREATE OR REPLACE FUNCTION public.update_document_chunk_count(doc_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_latest_no integer;
  v_version_id uuid;
BEGIN
  -- Get the latest version number from documents
  SELECT latest_version INTO v_latest_no
  FROM public.documents
  WHERE id = doc_id;

  IF v_latest_no IS NULL THEN
    -- No versions yet; set zero
    UPDATE public.documents SET chunk_count = 0 WHERE id = doc_id;
    RETURN;
  END IF;

  -- Resolve the version row id for the latest version number
  SELECT id INTO v_version_id
  FROM public.document_versions
  WHERE document_id = doc_id AND version_no = v_latest_no
  ORDER BY created_at DESC
  LIMIT 1;

  -- Update chunk_count to the number of processed chunks in the latest version only
  UPDATE public.documents 
  SET chunk_count = (
    SELECT COUNT(*)
    FROM public.chunks 
    WHERE document_id = doc_id 
      AND processing_status = 'processed'
      AND (version_id = v_version_id)
  )
  WHERE id = doc_id;
END;
$$;

COMMIT;

