import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as pdfjs from 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.min.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Configuration constants
const MAX_CHUNK_SIZE = parseInt(Deno.env.get('MAX_CHUNK_SIZE') || '1000');
const CHUNK_OVERLAP = parseInt(Deno.env.get('CHUNK_OVERLAP') || '200');
const EMBEDDING_MODEL_FALLBACK = Deno.env.get('EMBEDDING_MODEL_FALLBACK') || 'text-embedding-3-small';
const MAX_CONCURRENT_CHUNKS = parseInt(Deno.env.get('MAX_CONCURRENT_CHUNKS') || '5');

interface ProcessingError extends Error {
  code?: string;
  details?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let documentId: string | null = null;

  try {
    const body = await req.json();
    documentId = body.documentId;

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Document ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read environment variables with local-friendly fallbacks to avoid SUPABASE_* filtering in `supabase functions serve`
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
      || Deno.env.get('SB_URL')
      || Deno.env.get('LOCAL_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      || Deno.env.get('SB_SERVICE_ROLE_KEY')
      || Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
      || Deno.env.get('LOCAL_OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting processing for document: ${documentId}`);

    // Update document status to processing
    await updateDocumentStatus(supabase, documentId, 'processing');

    // Get document info with agent configuration
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select(`
        *,
        agents!inner (
          id,
          embed_model,
          gen_model,
          k,
          sim_threshold,
          fail_safe_threshold
        )
      `)
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      console.error('Document not found:', docError);
      await updateDocumentStatus(supabase, documentId, 'failed', 'Document not found');
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract agent configuration
    const agent = doc.agents;
    const embeddingModel = agent.embed_model || EMBEDDING_MODEL_FALLBACK;

    console.log('Processing document:', doc.title, 'with embedding model:', embeddingModel);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error('Failed to download file:', downloadError);
      await updateDocumentStatus(supabase, documentId, 'failed', 'Failed to download file');
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract text from PDF
    let extractedText: string;
    try {
      extractedText = await extractTextFromPDF(fileData);
      // Sanitize control characters that Postgres cannot store (e.g., \u0000)
      extractedText = sanitizeText(extractedText);
      console.log(`Extracted ${extractedText.length} characters from PDF (sanitized)`);
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      await updateDocumentStatus(supabase, documentId, 'failed', `PDF extraction failed: ${error.message}`);
      return new Response(JSON.stringify({ error: 'PDF text extraction failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create semantic chunks with overlap
    const chunks = createSemanticChunks(extractedText, MAX_CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`Created ${chunks.length} semantic chunks from document`);

    // Create document version
    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_no: doc.latest_version + 1,
        checksum: await generateChecksum(extractedText)
      })
      .select()
      .single();

    if (versionError) {
      console.error('Failed to create version:', versionError);
      await updateDocumentStatus(supabase, documentId, 'failed', 'Failed to create document version');
      return new Response(JSON.stringify({ error: 'Failed to create version' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process chunks in batches to avoid overwhelming the API
    const processedChunks = [];
    for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_CHUNKS) {
      const batch = chunks.slice(i, i + MAX_CONCURRENT_CHUNKS);

      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const chunkIndex = i + batchIndex;
        try {
          // Generate embedding with retry logic using agent's configured model
          const embedding = await generateEmbeddingWithRetry(chunk.content, openaiKey, embeddingModel);

          // Save chunk with content and embedding
          const { data: chunkData, error: chunkError } = await supabase
            .from('chunks')
            .insert({
              document_id: documentId,
              version_id: version.id,
              content: chunk.content,
              embedding: JSON.stringify(embedding), // Store as JSON for now
              page_start: chunk.pageStart || 1,
              page_end: chunk.pageEnd || 1,
              chunk_index: chunkIndex,
              token_count: estimateTokenCount(chunk.content),
              chunk_overlap_start: chunk.overlapStart || 0,
              chunk_overlap_end: chunk.overlapEnd || 0,
              embedding_model: embeddingModel, // Use agent's configured model
              processing_status: 'processed'
            })
            .select()
            .single();

          if (chunkError) {
            console.error(`Failed to save chunk ${chunkIndex}:`, chunkError);
            throw chunkError;
          }

          console.log(`Processed chunk ${chunkIndex + 1}/${chunks.length}`);
          return chunkData;
        } catch (error) {
          console.error(`Error processing chunk ${chunkIndex}:`, error);
          // Save chunk with error status
          await supabase.from('chunks').insert({
            document_id: documentId,
            version_id: version.id,
            content: chunk.content,
            page_start: chunk.pageStart || 1,
            page_end: chunk.pageEnd || 1,
            chunk_index: chunkIndex,
            token_count: estimateTokenCount(chunk.content),
            processing_status: 'failed'
          });
          throw error;
        }
      });

      try {
        const batchResults = await Promise.all(batchPromises);
        processedChunks.push(...batchResults);
      } catch (error) {
        console.error(`Batch processing failed for chunks ${i}-${i + batch.length - 1}:`, error);
        await updateDocumentStatus(supabase, documentId, 'failed', `Chunk processing failed: ${error.message}`);
        return new Response(JSON.stringify({ error: 'Chunk processing failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Update document status to processed and latest version
    await supabase
      .from('documents')
      .update({
        latest_version: version.version_no,
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        chunk_count: processedChunks.length,
        processing_error: null
      })
      .eq('id', documentId);

    console.log(`Document processing completed successfully. Processed ${processedChunks.length} chunks.`);

    return new Response(JSON.stringify({
      success: true,
      chunksProcessed: processedChunks.length,
      versionId: version.id,
      documentId: documentId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing document:', error);

    // Update document status to failed if we have a documentId
    if (documentId) {
      try {
        await updateDocumentStatus(
          createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
          documentId,
          'failed',
          error.message
        );
      } catch (updateError) {
        console.error('Failed to update document status:', updateError);
      }
    }

    return new Response(JSON.stringify({
      error: error.message,
      documentId: documentId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to update document processing status
async function updateDocumentStatus(
  supabase: any,
  documentId: string,
  status: 'pending' | 'processing' | 'processed' | 'failed',
  errorMessage?: string
) {
  const updateData: any = {
    processing_status: status,
    processing_error: errorMessage || null
  };

  if (status === 'processing') {
    updateData.processing_started_at = new Date().toISOString();
  } else if (status === 'processed') {
    updateData.processed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('documents')
    .update(updateData)
    .eq('id', documentId);

  if (error) {
    console.error('Failed to update document status:', error);
  }
}

// Extract text from PDF using pdfjs-dist
async function extractTextFromPDF(fileData: Blob): Promise<string> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Load PDF document
    const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      let pageText = '';
      for (const item of textContent.items) {
        if ('str' in item) {
          pageText += item.str + ' ';
        }
      }

      fullText += pageText.trim() + '\n\n';
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction failed, falling back to text extraction:', error);
    // Fallback to simple text extraction
    return await fileData.text();
  }
}

// Create semantic chunks with overlap
function createSemanticChunks(
  text: string,
  maxChunkSize: number,
  overlapSize: number
): Array<{
  content: string;
  pageStart?: number;
  pageEnd?: number;
  overlapStart: number;
  overlapEnd: number;
}> {
  const chunks = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  let currentChunk = '';
  let currentSize = 0;
  let chunkStart = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim() + '.';
    const sentenceSize = sentence.length;

    // If adding this sentence would exceed the chunk size, finalize the current chunk
    if (currentSize + sentenceSize > maxChunkSize && currentChunk.length > 0) {
      // Add overlap from the end of current chunk
      const overlapStart = Math.max(0, currentChunk.length - overlapSize);
      const overlapContent = currentChunk.substring(overlapStart);

      chunks.push({
        content: currentChunk.trim(),
        overlapStart: chunkStart > 0 ? overlapSize : 0,
        overlapEnd: overlapContent.length
      });

      // Start new chunk with overlap
      currentChunk = overlapContent + ' ' + sentence;
      currentSize = currentChunk.length;
      chunkStart = chunks.length;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentSize += sentenceSize;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      overlapStart: chunkStart > 0 ? overlapSize : 0,
      overlapEnd: 0
    });
  }

  return chunks;
}

// Generate embedding with retry logic
async function generateEmbeddingWithRetry(
  text: string,
  apiKey: string,
  embeddingModel: string = EMBEDDING_MODEL_FALLBACK,
  maxRetries: number = 3
): Promise<number[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: embeddingModel, // Use the provided embedding model
          input: text.substring(0, 8000), // Limit input size for OpenAI
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API');
      }

      return data.data[0].embedding;
    } catch (error) {
      console.error(`Embedding generation attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error('All embedding generation attempts failed');
}

// Estimate token count (rough approximation)
function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Remove control characters not allowed in Postgres text (preserve tabs/newlines)
function sanitizeText(text: string): string {
  try {
    // Remove NUL and other control chars except \n, \r, \t
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  } catch (_) {
    return text;
  }
}


async function generateChecksum(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}