-- Add missing columns to documents table for processing pipeline (idempotent)
DO $$
BEGIN
  -- processing_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN processing_status TEXT DEFAULT 'pending';
  END IF;

  -- Ensure CHECK constraint on processing_status values
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_processing_status_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_processing_status_check
      CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed'));
  END IF;

  -- Other columns
  ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_error TEXT,
    ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;
END $$;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_agent_processing ON public.documents(agent_id, processing_status);
