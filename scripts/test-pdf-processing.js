#!/usr/bin/env node

/**
 * Integration test script for PDF processing pipeline
 * This script tests the complete flow from document upload to processing completion
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';
const TEST_AGENT_ID = process.env.TEST_AGENT_ID || 'test-agent-id';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Helper function to create a test PDF file
function createTestPDF() {
  const testContent = `
# Test Document

This is a test PDF document for validating the PDF processing pipeline.

## Section 1: Introduction

This document contains multiple sections and paragraphs to test the chunking algorithm.
The text should be properly extracted and divided into semantic chunks with appropriate overlap.

## Section 2: Content

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

## Section 3: Conclusion

This concludes our test document. The processing pipeline should successfully extract this text,
create appropriate chunks, generate embeddings, and store everything in the database.
`;
  
  return new Blob([testContent], { type: 'text/plain' }); // Simplified for testing
}

// Test functions
async function testDocumentUpload() {
  console.log('🔄 Testing document upload...');
  
  try {
    const testFile = createTestPDF();
    const fileName = `test-document-${Date.now()}.pdf`;
    const storagePath = `${TEST_USER_ID}/${fileName}`;
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, testFile);
    
    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    // Create document record
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: TEST_USER_ID,
        agent_id: TEST_AGENT_ID,
        storage_path: storagePath,
        title: 'Test Document',
        mime: 'application/pdf',
        processing_status: 'pending',
        chunk_count: 0
      })
      .select()
      .single();
    
    if (dbError) {
      throw new Error(`Database insert failed: ${dbError.message}`);
    }
    
    console.log('✅ Document uploaded successfully:', document.id);
    return document;
  } catch (error) {
    console.error('❌ Document upload failed:', error.message);
    throw error;
  }
}

async function testDocumentProcessing(documentId) {
  console.log('🔄 Testing document processing...');
  
  try {
    // Trigger processing
    const { data: result, error: processError } = await supabase.functions.invoke('process-document', {
      body: { documentId }
    });
    
    if (processError) {
      throw new Error(`Processing invocation failed: ${processError.message}`);
    }
    
    console.log('✅ Processing triggered successfully');
    
    // Wait for processing to complete (with timeout)
    const maxWaitTime = 60000; // 60 seconds
    const pollInterval = 2000; // 2 seconds
    let waitTime = 0;
    
    while (waitTime < maxWaitTime) {
      const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();
      
      if (fetchError) {
        throw new Error(`Failed to fetch document status: ${fetchError.message}`);
      }
      
      console.log(`📊 Processing status: ${document.processing_status}`);
      
      if (document.processing_status === 'processed') {
        console.log('✅ Document processed successfully');
        console.log(`📈 Chunks created: ${document.chunk_count}`);
        return document;
      } else if (document.processing_status === 'failed') {
        throw new Error(`Processing failed: ${document.processing_error}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      waitTime += pollInterval;
    }
    
    throw new Error('Processing timeout - document did not complete within 60 seconds');
  } catch (error) {
    console.error('❌ Document processing failed:', error.message);
    throw error;
  }
}

async function testChunkRetrieval(documentId) {
  console.log('🔄 Testing chunk retrieval...');
  
  try {
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index');
    
    if (chunksError) {
      throw new Error(`Failed to retrieve chunks: ${chunksError.message}`);
    }
    
    console.log(`✅ Retrieved ${chunks.length} chunks`);
    
    // Validate chunk structure
    for (const chunk of chunks) {
      if (!chunk.content || !chunk.embedding || chunk.token_count <= 0) {
        throw new Error(`Invalid chunk structure: ${JSON.stringify(chunk)}`);
      }
    }
    
    console.log('✅ All chunks have valid structure');
    return chunks;
  } catch (error) {
    console.error('❌ Chunk retrieval failed:', error.message);
    throw error;
  }
}

async function testCleanup(documentId) {
  console.log('🔄 Cleaning up test data...');
  
  try {
    // Get document info for storage cleanup
    const { data: document } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', documentId)
      .single();
    
    // Delete from storage
    if (document?.storage_path) {
      await supabase.storage
        .from('documents')
        .remove([document.storage_path]);
    }
    
    // Delete document (cascades to chunks)
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);
    
    if (deleteError) {
      console.warn('⚠️ Cleanup warning:', deleteError.message);
    } else {
      console.log('✅ Test data cleaned up successfully');
    }
  } catch (error) {
    console.warn('⚠️ Cleanup failed:', error.message);
  }
}

// Main test runner
async function runIntegrationTest() {
  console.log('🚀 Starting PDF Processing Integration Test\n');
  
  let documentId = null;
  
  try {
    // Test 1: Document Upload
    const document = await testDocumentUpload();
    documentId = document.id;
    
    // Test 2: Document Processing
    await testDocumentProcessing(documentId);
    
    // Test 3: Chunk Retrieval
    await testChunkRetrieval(documentId);
    
    console.log('\n🎉 All tests passed! PDF processing pipeline is working correctly.');
    
  } catch (error) {
    console.error('\n💥 Integration test failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (documentId) {
      await testCleanup(documentId);
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest().catch(console.error);
}

export { runIntegrationTest };
