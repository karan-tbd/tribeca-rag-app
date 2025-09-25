import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Integration-like test that verifies the match_chunks RPC exists and is callable.
// This test is environment-aware: it will be skipped automatically if Supabase
// env vars are not provided (to keep CI stable without local Supabase).

describe('RPC: match_chunks', () => {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const shouldRun = Boolean(SUPABASE_URL && SERVICE_ROLE);

  (shouldRun ? it : it.skip)(
    'invokes match_chunks and returns an array (empty when no docs/chunks)',
    async () => {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

      // Pass null for query_embedding to avoid vector dimension constraints when the DB is empty.
      const { data, error } = await supabase.rpc('match_chunks', {
        query_embedding: null,
        doc_ids: [], // No documents → expect empty result without error
        match_count: 3,
        similarity_threshold: 0.1,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBe(0);
    },
  );
});

