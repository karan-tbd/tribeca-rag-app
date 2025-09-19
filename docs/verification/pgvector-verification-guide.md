# pgvector Verification Guide

This guide helps you verify that pgvector is working correctly in your Supabase instance.

## Quick Verification Methods

### Method 1: Supabase SQL Editor (Recommended)

1. **Open Supabase Studio**: Go to http://127.0.0.1:54323
2. **Navigate to SQL Editor**: Click on "SQL Editor" in the sidebar
3. **Run the verification queries below**

#### Test 1: Check pgvector Extension
```sql
-- Check if pgvector extension is installed
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'vector';
```
**Expected Result**: Should return one row with `extname = 'vector'`

#### Test 2: Basic Vector Operations
```sql
-- Test basic vector creation and operations
SELECT 
  '[1,2,3]'::vector as vector_creation,
  '[1,2,3]'::vector <-> '[1,2,3]'::vector as euclidean_distance_same,
  '[1,2,3]'::vector <-> '[4,5,6]'::vector as euclidean_distance_different,
  '[1,2,3]'::vector <=> '[1,2,3]'::vector as cosine_distance_same,
  '[1,2,3]'::vector <=> '[4,5,6]'::vector as cosine_distance_different;
```
**Expected Results**:
- `euclidean_distance_same`: 0
- `euclidean_distance_different`: > 0
- `cosine_distance_same`: 0
- `cosine_distance_different`: > 0

#### Test 3: Custom Cosine Similarity Function
```sql
-- Test our custom cosine similarity function
SELECT cosine_similarity('[1,0,0]'::vector, '[1,0,0]'::vector) as perfect_similarity;
SELECT cosine_similarity('[1,0,0]'::vector, '[0,1,0]'::vector) as orthogonal_similarity;
```
**Expected Results**:
- `perfect_similarity`: 1.0
- `orthogonal_similarity`: 0.0

#### Test 4: OpenAI-Compatible Vector Dimensions
```sql
-- Test 1536-dimension vectors (OpenAI text-embedding-3-small)
WITH test_vector AS (
  SELECT ('['|| string_agg(random()::text, ',') ||']')::vector as embedding
  FROM generate_series(1, 1536)
)
SELECT vector_dims(embedding) as openai_vector_dims
FROM test_vector;
```
**Expected Result**: `openai_vector_dims = 1536`

#### Test 5: Chunks Table Vector Column
```sql
-- Verify chunks table has vector column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chunks' 
  AND table_schema = 'public' 
  AND column_name = 'embedding';
```
**Expected Result**: Should show `embedding` column with `data_type = 'USER-DEFINED'`

### Method 2: Command Line Verification

If you have `psql` installed, you can connect directly:

```bash
# Connect to local Supabase database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Then run the SQL queries from Method 1
```

### Method 3: Application-Level Test

You can test pgvector through your application by uploading a PDF document and checking if:

1. **Document Processing Completes**: The document status changes to "processed"
2. **Chunks Are Created**: Check that chunks are created with embeddings
3. **Vector Data Is Stored**: Verify that the `embedding` column contains vector data

## Verification Checklist

Use this checklist to confirm pgvector is working correctly:

### ✅ Extension Installation
- [ ] pgvector extension is installed and enabled
- [ ] Vector type is available (`vector` data type works)
- [ ] Vector operators work (`<->`, `<=>`, `<#>`)

### ✅ Custom Functions
- [ ] `cosine_similarity()` function exists and works
- [ ] Function returns correct values (1.0 for identical vectors, 0.0 for orthogonal)

### ✅ Database Schema
- [ ] `chunks` table has `embedding` column of type `vector(1536)`
- [ ] Vector data can be inserted and retrieved
- [ ] Vector dimensions are correct (1536 for OpenAI embeddings)

### ✅ Performance
- [ ] Vector operations complete in reasonable time (< 100ms for simple queries)
- [ ] Similarity searches work correctly
- [ ] Results are ranked by similarity

### ✅ Integration
- [ ] PDF processing creates embeddings
- [ ] Embeddings are stored in database
- [ ] Agent configuration affects embedding model selection

## Common Issues and Solutions

### Issue: "type vector does not exist"
**Solution**: pgvector extension is not installed. Check migration logs and ensure the extension migration ran successfully.

### Issue: "function cosine_similarity does not exist"
**Solution**: The custom function migration didn't run. Check that all migrations were applied.

### Issue: "vector dimension mismatch"
**Solution**: Ensure you're using 1536-dimension vectors for OpenAI text-embedding-3-small model.

### Issue: Slow vector operations
**Solution**: Consider adding vector indexes for large datasets (not needed for small test datasets).

## Performance Benchmarks

For reference, here are typical performance expectations:

- **Vector insertion**: < 10ms per vector
- **Cosine similarity calculation**: < 1ms for 1536-dimension vectors
- **Similarity search (< 1000 vectors)**: < 50ms
- **Similarity search (< 10000 vectors)**: < 200ms

## Next Steps

Once pgvector is verified as working:

1. **Test PDF Processing**: Upload a PDF and verify embeddings are generated
2. **Test Similarity Search**: Query documents and check that relevant chunks are returned
3. **Monitor Performance**: Check query times and optimize if needed
4. **Plan Pinecone Migration**: Consider when to migrate to Pinecone for production scale

## Troubleshooting

If any tests fail:

1. **Check Supabase Logs**: Look for errors in the Supabase console
2. **Verify Migrations**: Ensure all database migrations ran successfully
3. **Check Dependencies**: Confirm pgvector is available in your Supabase instance
4. **Test Incrementally**: Start with simple vector operations and build up complexity

## Success Indicators

pgvector is working correctly when:

- ✅ All SQL queries execute without errors
- ✅ Vector operations return expected results
- ✅ Performance is within acceptable ranges
- ✅ PDF processing creates and stores embeddings
- ✅ Similarity searches return relevant results

Your pgvector setup is ready for production use! 🎉
