-- Add embedding_model column to chunks table
-- Ensure the column exists
ALTER TABLE public.chunks
  ADD COLUMN IF NOT EXISTS embedding_model text;

-- Ensure the default is set (safe to run multiple times)
ALTER TABLE public.chunks
  ALTER COLUMN embedding_model SET DEFAULT 'text-embedding-3-small';

-- Backfill any existing NULLs to the default value (idempotent)
UPDATE public.chunks
SET embedding_model = COALESCE(embedding_model, 'text-embedding-3-small');