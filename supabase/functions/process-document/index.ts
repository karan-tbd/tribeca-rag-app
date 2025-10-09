import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseAdmin, env } from "../_shared/supabase.ts";
import { extractPdfWithFallback, scoreExtractionText } from "../_shared/pdf-extraction-service.ts";
import { getChunkingParams, chunkTextTokenOverlap } from "../_shared/chunking.ts";


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

    const supabase = getSupabaseAdmin();
    const openaiKey = env('OPENAI_API_KEY') || '';
    const embedModel = env('EMBEDDING_MODEL_FALLBACK') || 'text-embedding-3-small';

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

    // Attempt to download from Storage if we have a storage_path; otherwise defer to chunks-fallback
    let fileData: Blob | null = null;
    let downloadError: any = null;
    if (doc.storage_path && String(doc.storage_path).trim().length > 0) {
      const resp = await supabase.storage.from('documents').download(doc.storage_path);
      fileData = resp.data as any;
      downloadError = resp.error;
    } else {
      downloadError = { message: 'No storage_path set on document; will try chunks-fallback' };
    }

    // If we got a file, enforce backend size limit (10MB)
    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    if (fileData && fileData.size > MAX_UPLOAD_BYTES) {
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


    // Extract text
    let text = '';
    let method = 'unknown';
    let confidence = 0;

    if (fileData) {
      // Primary path: extract from downloaded file
      const extraction = await extractPdfWithFallback(fileData);
      confidence = Number(extraction.confidence ?? 0);
      method = extraction.method ?? 'unknown';
      console.log(`[extract] method=${method} confidence=${confidence.toFixed(2)}`);
      const textRaw = extraction.text || '';
      const sampleBefore = textRaw.slice(0, 200);
      text = textRaw.replace(/\u0000/g, '');
      const sampleAfter = text.slice(0, 200);
      console.log(`[extract] sample before sanitize: ${JSON.stringify(sampleBefore)}`);
      console.log(`[extract] sample after sanitize:  ${JSON.stringify(sampleAfter)}`);
    } else {
      // Fallback path: reconstruct text from existing chunks if download failed or storage_path missing
      console.warn('Download failed or no storage_path; using chunks-fallback', downloadError);
      const { data: existing, error: chunksErr } = await supabase
        .from('chunks')
        .select('content, chunk_index')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true });
      if (chunksErr) {
        console.error('Chunks fallback failed (query error):', chunksErr);
        const { error: statusErr } = await supabase.rpc('update_document_processing_status', { doc_id: documentId, status: 'failed', error_msg: 'Failed to download file and no chunks available' });
        if (statusErr) console.warn('Failed to set failed status after chunksErr', statusErr);
        return new Response(JSON.stringify({ success: false, error: 'Failed to download file' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const combinedRaw = (existing ?? []).map((r: any) => r?.content ?? '').join('\n');
      const sampleBefore = combinedRaw.slice(0, 200);
      text = (combinedRaw || '').replace(/\u0000/g, '');
      const sampleAfter = text.slice(0, 200);
      console.log(`[fallback-chunks] sample before sanitize: ${JSON.stringify(sampleBefore)}`);
      console.log(`[fallback-chunks] sample after sanitize:  ${JSON.stringify(sampleAfter)}`);
      method = 'chunks-fallback';
      // Quality gate: avoid proceeding on metadata-heavy or too-short text
      const { confidence: conf, metadataRatio, length } = scoreExtractionText(text);
      confidence = conf;
      const MIN_LEN = 50;
      const MAX_META = 0.3;
      const MIN_CONF = 0.4;
      if (length < MIN_LEN || (metadataRatio ?? 1) > MAX_META || confidence < MIN_CONF) {
        const msg = 'No readable text available (fallback is metadata-heavy or too short). Ensure storage_path is set and file is accessible.';
        console.warn('[fallback-chunks] quality gate failed:', { length, metadataRatio, confidence });
        const { error: statusErr } = await supabase.rpc('update_document_processing_status', { doc_id: documentId, status: 'failed', error_msg: msg });
        if (statusErr) console.warn('Failed to set failed status after fallback quality gate', statusErr);
        return new Response(JSON.stringify({ success: false, error: msg }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { maxTokens, overlapTokens } = getChunkingParams();
    console.log(`[chunking] params tokens=${maxTokens} overlap=${overlapTokens}`);
    const chunkObjs = chunkTextTokenOverlap(text, maxTokens, overlapTokens);
    console.log(`[chunking] created=${chunkObjs.length}`);

    if (chunkObjs.length === 0) {
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

    console.log(`Extracted ${chunkObjs.length} chunks from document`);

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
    for (let i = 0; i < chunkObjs.length; i++) {
      const c = chunkObjs[i];

      // Generate embedding with robust fallback
      const embedding = await generateEmbedding(c.content, openaiKey, embedModel);

      // Save chunk (include content + embedding + status)
      await supabase.from('chunks').insert({
        document_id: documentId,
        version_id: version.id,
        page_start: 1, // TODO: extract actual page numbers
        page_end: 1,
        chunk_index: c.index,
        token_count: c.tokenCount,
        content: c.content,
        chunk_overlap_start: c.overlapStart,
        chunk_overlap_end: c.overlapEnd,
        embedding,
        processing_status: 'processed',
        embedding_model: embedModel
      });

      console.log(`Processed chunk ${i + 1}/${chunkObjs.length}`);
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
      chunksProcessed: chunkObjs.length,
      versionId: version.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing document:', error);
    try {
      // Best-effort attempt to mark document as failed
      const admin = getSupabaseAdmin();
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



});

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