-- Add embedding_model column to chunks table
ALTER TABLE public.chunks 
ADD COLUMN embedding_model text DEFAULT 'text-embedding-3-small';