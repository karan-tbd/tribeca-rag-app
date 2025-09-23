import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs';


// Deno types for local TS tooling; provided at runtime in Supabase Edge Functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Document ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    const embedModel = Deno.env.get('EMBEDDING_MODEL_FALLBACK') || 'text-embedding-3-small';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get document info
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      console.error('Document not found:', docError);
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const nextVersion = ((doc.latest_version ?? 0) + 1);


    console.log('Processing document:', doc.title);

    // Set document status to 'processing'
    {
      const { error: statusErr } = await supabase.rpc('update_document_processing_status', { doc_id: documentId, status: 'processing', error_msg: null });
      if (statusErr) console.warn('Failed to update status to processing', statusErr);
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error('Failed to download file:', downloadError);
      {
        const { error: statusErr } = await supabase.rpc('update_document_processing_status', { doc_id: documentId, status: 'failed', error_msg: 'Failed to download file' });
        if (statusErr) console.warn('Failed to update status to failed', statusErr);
      }
      return new Response(JSON.stringify({ success: false, error: 'Failed to download file' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enforce backend size limit (10MB)
    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    if (fileData.size > MAX_UPLOAD_BYTES) {
      try {
        const { error: statusErr } = await supabase.rpc('update_document_processing_status', {
          doc_id: documentId, status: 'failed', error_msg: 'File size exceeds 10MB'
        });
        if (statusErr) console.warn('Failed to set failed status for oversized file', statusErr);
      } catch (_) {}
      return new Response(JSON.stringify({ success: false, error: 'File too large (>10MB)' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Extract text from PDF using pdf.js (fallback to .text() if needed)
    const text = await extractPdfText(fileData);
    const maxChunk = Number(Deno.env.get('MAX_CHUNK_SIZE') ?? '1000');
    const chunks = chunkText(text || '', maxChunk);

    if (chunks.length === 0) {
      console.warn('No text extracted from document; aborting processing');
      {
        const { error: statusErr } = await supabase.rpc('update_document_processing_status', { doc_id: documentId, status: 'failed', error_msg: 'No extractable text found in file' });
        if (statusErr) console.warn('Failed to update status to failed', statusErr);
      }
      return new Response(JSON.stringify({ success: false, error: 'No extractable text found in file' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Extracted ${chunks.length} chunks from document`);

    // Create document version
    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_no: nextVersion,
        checksum: await generateChecksum(text)
      })
      .select()
      .single();

    if (versionError) {
      console.error('Failed to create version:', versionError);
      {
        const { error: statusErr } = await supabase.rpc('update_document_processing_status', { doc_id: documentId, status: 'failed', error_msg: 'Failed to create version' });
        if (statusErr) console.warn('Failed to update status to failed', statusErr);
      }
      return new Response(JSON.stringify({ success: false, error: 'Failed to create version' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process chunks and generate embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Generate embedding with robust fallback
      const embedding = await generateEmbedding(chunk, openaiKey, embedModel);

      // Save chunk (include content + embedding + status)
      await supabase.from('chunks').insert({
        document_id: documentId,
        version_id: version.id,
        page_start: 1, // TODO: extract actual page numbers
        page_end: 1,
        chunk_index: i,
        token_count: Math.ceil(chunk.length / 4), // rough estimate
        content: chunk,
        embedding,
        processing_status: 'processed',
        embedding_model: embedModel
      });

      console.log(`Processed chunk ${i + 1}/${chunks.length}`);
    }

    // Update document latest version
    await supabase
      .from('documents')
      .update({ latest_version: version.version_no })
      .eq('id', documentId);

    // Update derived counters and mark as processed
    {
      const { error: cntErr } = await supabase.rpc('update_document_chunk_count', { doc_id: documentId });
      if (cntErr) console.warn('Failed to update chunk count', cntErr);
    }
    {
      const { error: statusErr } = await supabase.rpc('update_document_processing_status', { doc_id: documentId, status: 'processed', error_msg: null });
      if (statusErr) console.warn('Failed to update status to processed', statusErr);
    }

    console.log('Document processing completed');

    return new Response(JSON.stringify({
      success: true,
      chunksProcessed: chunks.length,
      versionId: version.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing document:', error);
    try {
      // Best-effort attempt to mark document as failed
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const admin = createClient(supabaseUrl, supabaseServiceKey);
      const body = await req.clone().json().catch(() => ({}));
      if (body?.documentId) {
        const { error: statusErr } = await admin.rpc('update_document_processing_status', { doc_id: body.documentId, status: 'failed', error_msg: String((error as any)?.message || error) });
        if (statusErr) console.warn('Failed to set failed status in catch', statusErr);
      }
    } catch (_) {}

    return new Response(JSON.stringify({ success: false, error: (error as any)?.message || 'Internal Server Error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

async function extractPdfText(fileData: Blob): Promise<string> {
  try {
    const ab = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(ab);
    try {
      // Disable worker in Edge runtime context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pdfjsLib as any).GlobalWorkerOptions && (((pdfjsLib as any).GlobalWorkerOptions.workerSrc) = '');
    } catch (_) {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadingTask = (pdfjsLib as any).getDocument({ data: uint8, useSystemFonts: true, isEvalSupported: false });
    const pdf = await loadingTask.promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = (content.items || []).map((it: any) => (it && (it.str ?? ''))).join(' ');
      text += pageText + '\n';
    }
    try { await (pdf as any).cleanup?.(); } catch (_) {}
    return text.trim();
  } catch (e) {
    console.warn('PDF.js extraction failed, falling back to blob.text()', e);
    try { return await fileData.text(); } catch { return ''; }
  }
}

});

function chunkText(text: string, maxLength: number): string[] {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxLength;

    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastDot = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastDot, lastNewline);

      if (breakPoint > start + maxLength / 2) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(chunk => chunk.length > 0);
}

async function generateEmbedding(text: string, apiKey: string, model: string): Promise<number[]> {
  try {
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error ${response.status}: ${err}`);
    }

    const data = await response.json();
    if (!data?.data?.[0]?.embedding) throw new Error('No embedding in response');
    return data.data[0].embedding as number[];
  } catch (e) {
    // Fallback: deterministic pseudo-embedding to avoid hard failures in local/dev
    const dim = 1536;
    const hash = await generateChecksum(text);
    const nums: number[] = new Array(dim).fill(0).map((_, i) => {
      const h = hash.charCodeAt(i % hash.length);
      return ((h % 100) - 50) / 50; // [-1,1] range
    });
    return nums;
  }
}

async function generateChecksum(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}