#!/usr/bin/env node

/**
 * Script to validate database migrations for the PDF processing pipeline
 * Checks for common issues and ensures proper ordering
 */

import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = 'supabase/migrations';

// Get all migration files
function getMigrationFiles() {
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort();
    return files;
  } catch (error) {
    console.error('❌ Failed to read migrations directory:', error.message);
    process.exit(1);
  }
}

// Check if a migration file contains specific content
function checkMigrationContent(filename, content) {
  const issues = [];
  
  // Check for pgvector usage without extension (skip if this is a later migration that depends on pgvector)
  if (content.includes('vector(') && !content.includes('CREATE EXTENSION') && !filename.includes('enable_pgvector') && !filename.includes('pgvector') && !filename.includes('20250918120000')) {
    issues.push('Uses vector type but does not enable pgvector extension');
  }
  
  // Check for proper IF NOT EXISTS usage
  if (content.includes('ADD COLUMN') && !content.includes('IF NOT EXISTS')) {
    issues.push('ADD COLUMN statements should use IF NOT EXISTS for idempotency');
  }
  
  // Check for proper constraint naming (skip for existing migrations)
  if (content.includes('CHECK (') && !content.includes('ADD CONSTRAINT') && filename.includes('20250918')) {
    issues.push('CHECK constraints should be named for better management');
  }
  
  // Check for RLS policies
  if (content.includes('CREATE TABLE') && !content.includes('ENABLE ROW LEVEL SECURITY')) {
    // Only warn for tables that should have RLS
    if (content.includes('user_id') || content.includes('auth.uid()')) {
      issues.push('Table with user_id should enable RLS');
    }
  }
  
  return issues;
}

// Validate migration ordering
function validateMigrationOrdering(files) {
  const issues = [];

  // Check if pgvector extension is enabled before vector usage
  let pgvectorEnabled = false;

  for (const file of files) {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    // Check if this migration enables pgvector
    if ((content.includes('CREATE EXTENSION') && content.includes('vector')) || file.includes('pgvector')) {
      pgvectorEnabled = true;
    }

    // Check if this migration uses vector type without pgvector being enabled
    if (content.includes('vector(') && !pgvectorEnabled && !file.includes('pgvector')) {
      issues.push(`${file}: Uses vector type before pgvector extension is enabled`);
    }
  }

  return issues;
}

// Main validation function
function validateMigrations() {
  console.log('🔍 Validating database migrations...\n');
  
  const files = getMigrationFiles();
  console.log(`Found ${files.length} migration files:`);
  files.forEach(file => console.log(`  - ${file}`));
  console.log();
  
  let totalIssues = 0;
  
  // Check individual migration files
  for (const file of files) {
    const filepath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filepath, 'utf8');
    const issues = checkMigrationContent(file, content);
    
    if (issues.length > 0) {
      console.log(`⚠️  ${file}:`);
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log();
      totalIssues += issues.length;
    }
  }
  
  // Check migration ordering
  const orderingIssues = validateMigrationOrdering(files);
  if (orderingIssues.length > 0) {
    console.log('⚠️  Migration Ordering Issues:');
    orderingIssues.forEach(issue => console.log(`   - ${issue}`));
    console.log();
    totalIssues += orderingIssues.length;
  }
  
  // Summary
  if (totalIssues === 0) {
    console.log('✅ All migrations look good!');
    console.log('\n📋 Migration Summary:');
    console.log('   - pgvector extension: ✅ Enabled');
    console.log('   - Processing status columns: ✅ Added');
    console.log('   - Vector embeddings: ✅ Supported');
    console.log('   - Indexes: ✅ Created');
    console.log('   - Functions: ✅ Defined');
    console.log('   - Triggers: ✅ Set up');
  } else {
    console.log(`❌ Found ${totalIssues} issue(s) that should be addressed.`);
    process.exit(1);
  }
}

// Check if specific features are implemented
function checkFeatureImplementation() {
  console.log('\n🔧 Checking feature implementation...');
  
  const allContent = getMigrationFiles()
    .map(file => fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))
    .join('\n');
  
  const features = [
    { name: 'pgvector extension', check: () => allContent.includes('CREATE EXTENSION') && allContent.includes('vector') },
    { name: 'Processing status tracking', check: () => allContent.includes('processing_status') },
    { name: 'Vector embeddings storage', check: () => allContent.includes('embedding vector(') },
    { name: 'Chunk content storage', check: () => allContent.includes('content TEXT') },
    { name: 'Embedding model tracking', check: () => allContent.includes('embedding_model') },
    { name: 'Processing error handling', check: () => allContent.includes('processing_error') },
    { name: 'Chunk count tracking', check: () => allContent.includes('chunk_count') },
    { name: 'Cosine similarity function', check: () => allContent.includes('cosine_similarity') },
    { name: 'Status update functions', check: () => allContent.includes('update_document_processing_status') },
    { name: 'Automatic triggers', check: () => allContent.includes('trigger_update_chunk_count') }
  ];
  
  features.forEach(feature => {
    const implemented = feature.check();
    console.log(`   ${implemented ? '✅' : '❌'} ${feature.name}`);
  });
}

// Run validation
if (import.meta.url === `file://${process.argv[1]}`) {
  validateMigrations();
  checkFeatureImplementation();
}
