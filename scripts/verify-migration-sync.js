#!/usr/bin/env node

/**
 * Verify that the remote Supabase schema matches critical expectations from local migrations.
 *
 * Read-only checks using the Supabase Service Role key (no data writes).
 *
 * Env required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   bun scripts/verify-migration-sync.js
 *   OR
 *   node scripts/verify-migration-sync.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  console.error('   Add them to your .env (remote production) before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkTableExists(table) {
  // Use a HEAD select to avoid transferring data; will error if table doesn't exist
  const { error } = await supabase.from(table).select('id', { head: true, count: 'exact' }).limit(1);
  if (error) throw new Error(`Table '${table}' not accessible/found: ${error.message}`);
}

async function checkColumnExists(table, column) {
  // Selecting a specific column with HEAD will fail if the column doesn't exist
  const { error } = await supabase.from(table).select(column, { head: true }).limit(1);
  if (error) throw new Error(`Column '${table}.${column}' missing/inaccessible: ${error.message}`);
}

async function main() {
  console.log('🔍 Verifying remote Supabase schema (read-only)...\n');

  const checks = [];

  // Critical tables expected from migrations
  const expectedTables = ['documents', 'chunks'];
  // Optional tables (present in some setups)
  const optionalTables = ['agents', 'sessions', 'messages', 'users'];

  // Documents columns
  const documentColumns = [
    'processing_status',
    'processed_at',
    'chunk_count',
    'processing_error',
    'processing_started_at',
  ];

  // Chunks columns
  const chunkColumns = [
    'content',
    'embedding',
    'processing_status',
    'embedding_model',
    'chunk_overlap_start',
    'chunk_overlap_end',
  ];

  // Queue table checks
  for (const t of expectedTables) {
    checks.push({
      name: `Table exists: ${t}`,
      fn: () => checkTableExists(t),
    });
  }

  for (const t of optionalTables) {
    checks.push({
      name: `Table (optional) exists: ${t}`,
      fn: async () => {
        try {
          await checkTableExists(t);
          return { optional: true, ok: true };
        } catch (e) {
          return { optional: true, ok: false, skip: true, message: e.message };
        }
      },
    });
  }

  // Column checks (only run if base tables exist)
  for (const c of documentColumns) {
    checks.push({
      name: `Column exists: documents.${c}`,
      fn: () => checkColumnExists('documents', c),
    });
  }
  for (const c of chunkColumns) {
    checks.push({
      name: `Column exists: chunks.${c}`,
      fn: () => checkColumnExists('chunks', c),
    });
  }

  // Execute checks sequentially to keep output readable
  let failures = 0;
  for (const check of checks) {
    try {
      const res = await check.fn();
      if (res?.skip) {
        console.log(`• ${check.name}: (optional not found) — skipping`);
      } else {
        console.log(`✓ ${check.name}`);
      }
    } catch (err) {
      failures += 1;
      console.log(`✗ ${check.name}`);
      console.log(`   → ${err.message}`);
    }
  }

  // Guidance for items that require SQL-level verification
  console.log('\nℹ️ Additional items to verify via SQL (dashboard or CLI):');
  console.log('   - pgvector extension enabled: SELECT extname FROM pg_extension WHERE extname = \'vector\';');
  console.log('   - Functions exist: update_document_processing_status, update_document_chunk_count, cosine_similarity');
  console.log('   - Trigger exists/active: trigger_chunks_update_count on public.chunks');
  console.log('   - RLS policies active for user-scoped tables');

  if (failures === 0) {
    console.log('\n✅ Remote schema matches expected critical tables/columns.');
    process.exit(0);
  } else {
    console.log(`\n❌ ${failures} check(s) failed. See messages above.`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

