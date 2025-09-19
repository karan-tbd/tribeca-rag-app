-- pgvector Verification Test Suite
-- Run this in Supabase SQL Editor or via psql

-- Test 1: Check pgvector extension
SELECT 'Test 1: pgvector Extension' as test_name;
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'vector';

-- Test 2: Basic vector operations
SELECT 'Test 2: Basic Vector Operations' as test_name;

-- Test vector creation and basic operations
SELECT 
  '[1,2,3]'::vector as vector_creation,
  '[1,2,3]'::vector <-> '[1,2,3]'::vector as euclidean_distance_same,
  '[1,2,3]'::vector <-> '[4,5,6]'::vector as euclidean_distance_different,
  '[1,2,3]'::vector <=> '[1,2,3]'::vector as cosine_distance_same,
  '[1,2,3]'::vector <=> '[4,5,6]'::vector as cosine_distance_different;

-- Test 3: Custom cosine similarity function
SELECT 'Test 3: Custom Functions' as test_name;
SELECT cosine_similarity('[1,0,0]'::vector, '[1,0,0]'::vector) as perfect_similarity;
SELECT cosine_similarity('[1,0,0]'::vector, '[0,1,0]'::vector) as orthogonal_similarity;

-- Test 4: Vector dimensions (OpenAI embedding size)
SELECT 'Test 4: Vector Dimensions' as test_name;
SELECT vector_dims('[1,2,3]'::vector) as small_vector_dims;

-- Create a test vector with 1536 dimensions (OpenAI text-embedding-3-small)
WITH test_vector AS (
  SELECT ('['|| string_agg(random()::text, ',') ||']')::vector as embedding
  FROM generate_series(1, 1536)
)
SELECT vector_dims(embedding) as openai_vector_dims
FROM test_vector;

-- Test 5: Chunks table vector operations
SELECT 'Test 5: Chunks Table Vector Operations' as test_name;

-- Check if chunks table has vector column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chunks' 
  AND table_schema = 'public' 
  AND column_name = 'embedding';

-- Test 6: Insert and query test vectors
SELECT 'Test 6: Vector Storage Test' as test_name;

-- Clean up any existing test data
DELETE FROM chunks WHERE content LIKE 'TEST_VECTOR_%';

-- Insert test vectors
INSERT INTO chunks (
  document_id, 
  version_id, 
  content, 
  embedding, 
  chunk_index, 
  token_count,
  embedding_model,
  processing_status
) VALUES 
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'TEST_VECTOR_AI_ML',
  ('[' || string_agg(
    CASE WHEN i <= 100 THEN '0.1' ELSE '0.01' END, 
    ','
  ) || ']')::vector,
  0,
  10,
  'text-embedding-3-small',
  'processed'
),
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'TEST_VECTOR_COOKING',
  ('[' || string_agg(
    CASE WHEN i >= 1400 THEN '0.1' ELSE '0.01' END, 
    ','
  ) || ']')::vector,
  1,
  8,
  'text-embedding-3-small',
  'processed'
)
FROM generate_series(1, 1536) as i;

-- Test 7: Similarity search
SELECT 'Test 7: Similarity Search' as test_name;

-- Create query vector (similar to first test vector)
WITH query_vector AS (
  SELECT ('[' || string_agg(
    CASE WHEN i <= 100 THEN '0.1' ELSE '0.01' END, 
    ','
  ) || ']')::vector as qv
  FROM generate_series(1, 1536) as i
)
SELECT 
  content,
  chunk_index,
  (embedding <=> qv) as cosine_distance,
  1 - (embedding <=> qv) as cosine_similarity
FROM chunks, query_vector
WHERE content LIKE 'TEST_VECTOR_%'
ORDER BY embedding <=> qv
LIMIT 5;

-- Test 8: Performance test
SELECT 'Test 8: Performance Test' as test_name;

-- Time a similarity search
EXPLAIN (ANALYZE, BUFFERS) 
WITH query_vector AS (
  SELECT ('[' || string_agg(random()::text, ',') || ']')::vector as qv
  FROM generate_series(1, 1536)
)
SELECT content, (embedding <=> qv) as distance
FROM chunks, query_vector
WHERE content LIKE 'TEST_VECTOR_%'
ORDER BY embedding <=> qv
LIMIT 1;

-- Test 9: Index information
SELECT 'Test 9: Index Information' as test_name;

SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'chunks' 
  AND schemaname = 'public';

-- Test 10: Vector statistics
SELECT 'Test 10: Vector Statistics' as test_name;

SELECT 
  COUNT(*) as total_chunks_with_embeddings,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as chunks_with_vectors,
  AVG(vector_dims(embedding)) as avg_vector_dimensions
FROM chunks
WHERE embedding IS NOT NULL;

-- Cleanup test data
DELETE FROM chunks WHERE content LIKE 'TEST_VECTOR_%';

-- Summary
SELECT 'pgvector Verification Complete!' as summary;
SELECT 'Check results above for any errors or unexpected values' as note;
