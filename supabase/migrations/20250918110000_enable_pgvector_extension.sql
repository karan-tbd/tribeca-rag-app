-- Enable pgvector extension for vector operations
-- This must be run before any migrations that use the vector type

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is available
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RAISE EXCEPTION 'pgvector extension is not available. Please ensure it is installed on your Supabase instance.';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON EXTENSION vector IS 'pgvector extension for vector similarity search operations';
