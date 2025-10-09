import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno types in Edge Functions runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Remove characters Postgres cannot store (e.g., null bytes) and trim
function sanitizeText(s: string): string {
  return (s ?? '').replace(/\u0000/g, '');
}

async function generateChecksum(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


// Direct PDF extraction function that works with Uint8Array
async function extractPdfDirectly(uint8Array: Uint8Array) {
  try {
    // Try pdf.js first - use the default export
    const pdfjsModule: any = await import('https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs')
    const pdfjsLib = pdfjsModule.default || pdfjsModule

    // Disable worker and evaluation for edge runtime
    try {
      if (pdfjsLib?.GlobalWorkerOptions) {
        // Provide a workerSrc to suppress warnings; Edge may still inline without a worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.mjs'
      }
    } catch (e) {
      console.warn('[extract] failed setting workerSrc', (e as any)?.message)
    }

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true
    })

    const pdf = await loadingTask.promise
    let text = ''

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: any) => item.str || '')
        .join(' ')
      text += pageText + '\n'
    }

    // Cleanup
    try {
      await pdf.cleanup?.()
    } catch (_) {}

    const trimmedText = text.trim()

    return {
      text: trimmedText,
      method: 'pdf.js',
      pageCount: pdf.numPages,
      confidence: trimmedText.length > 50 ? 0.9 : 0.3,
      metadataRatio: 0.1
    }
  } catch (error) {
    console.warn('[extract] pdf.js failed:', String((error as any)?.message || error))

    // Fallback: try to decode as text (will likely fail but worth trying)
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false })
      const text = decoder.decode(uint8Array)

      if (text && text.length > 10) {
        return {
          text: text,
          method: 'text-decode',
          confidence: 0.2,
          metadataRatio: 0.8
        }
      }
    } catch (_) {}

    // Final fallback: return minimal result
    return {
      text: '',
      method: 'failed',
      confidence: 0,
      metadataRatio: 1,
      error: String((error as any)?.message || error)
    }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fileContent, fileName, userId, agentId, documentId: providedDocumentId } = await req.json()

    if (!fileContent || !fileName || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: fileContent, fileName, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing document: ${fileName} for user: ${userId}`)

    // Convert base64 to Uint8Array
    const base64Len = fileContent.length;
    console.log(`[decode] base64 length=${base64Len}`)
    const binaryString = atob(fileContent)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    console.log(`[decode] bytes length=${bytes.length}`)

    // Extract text directly from Uint8Array using pdf.js
    const extractionResult = await extractPdfDirectly(bytes)

    if (!extractionResult.text || extractionResult.text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to extract text from PDF', details: `No text extracted using method: ${extractionResult.method}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { text: rawText, method, confidence, metadataRatio } = extractionResult
    const sampleBefore = (rawText || '').slice(0, 200)
    const text = sanitizeText(rawText)
    const sampleAfter = (text || '').slice(0, 200)
    console.log(`[extract] method=${method} confidence=${confidence} metadataRatio=${metadataRatio}`)
    console.log(`[extract] sample before sanitize: ${JSON.stringify(sampleBefore)}`)
    console.log(`[extract] sample after sanitize:  ${JSON.stringify(sampleAfter)}`)
    console.log(`Extracted ${text.length} characters using ${method} (confidence: ${confidence}, metadata ratio: ${metadataRatio})`)

    // Create chunks using env-configured token size and overlap
    const { getChunkingParams, chunkTextTokenOverlap } = await import('../_shared/chunking.ts')
    const { maxTokens, overlapTokens } = getChunkingParams()
    console.log(`[chunking] params tokens=${maxTokens} overlap=${overlapTokens}`)
    const chunks = chunkTextTokenOverlap(text, maxTokens, overlapTokens)
    console.log(`Created ${chunks.length} chunks`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321'
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Upload the file to Storage (ensures reprocessing works later)
    const safeName = fileName.replace(/\s+/g, '_')
    const storagePath = `documents/${userId}/${Date.now()}-${safeName}`
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, blob, { upsert: true, contentType: 'application/pdf' })
    if (uploadErr) {
      console.warn('Storage upload failed (continuing with direct processing):', uploadErr)
    }

    // Use provided document ID if client created a placeholder; otherwise create one here
    let documentId = providedDocumentId as string | undefined
    if (!documentId) {
      documentId = crypto.randomUUID()
      const title = fileName.replace(/\.[^.]+$/, "")
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          title: title,
          user_id: userId,
          agent_id: agentId || null,
          storage_path: uploadErr ? '' : storagePath,
          mime: 'application/pdf',
          processing_status: 'processing',
          chunk_count: 0,
          latest_version: 0
        })

      if (docError) {
        console.error('Error creating document:', docError)
        return new Response(
          JSON.stringify({ error: 'Failed to create document record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Ensure row is marked processing; set storage_path only if upload succeeded
      const update: Record<string, any> = { processing_status: 'processing' };
      if (!uploadErr) update.storage_path = storagePath;
      await supabase
        .from('documents')
        .update(update)
        .eq('id', documentId)
    }

    // Create document version for this processing run
    const { data: docRow } = await supabase.from('documents').select('latest_version').eq('id', documentId).single()
    const nextVersion = ((docRow?.latest_version ?? 0) + 1)
    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_no: nextVersion,
        checksum: await generateChecksum(text)
      })
      .select()
      .single()
    if (versionError) {
      console.error('Failed to create version in direct processing:', versionError)
      await supabase.from('documents').update({ processing_status: 'failed', processing_error: 'Failed to create version' }).eq('id', documentId)
      return new Response(
        JSON.stringify({ error: 'Failed to create version' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process chunks and generate embeddings
    let processedChunks = 0
    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(chunk.content)

        const { error: chunkError } = await supabase
          .from('chunks')
          .insert({
            id: crypto.randomUUID(),
            document_id: documentId,
            version_id: (version as any).id,
            content: chunk.content,
            embedding: embedding,
            chunk_index: chunk.index,
            page_start: 1,
            page_end: 1,
            token_count: chunk.tokenCount,
            chunk_overlap_start: chunk.overlapStart,
            chunk_overlap_end: chunk.overlapEnd,
            embedding_model: Deno.env.get('EMBEDDING_MODEL_FALLBACK') || 'text-embedding-3-small',
            processing_status: 'processed'
          })

        if (chunkError) {
          console.error('Error inserting chunk:', chunkError)
        } else {
          processedChunks++
        }
      } catch (error) {
        console.error('Error processing chunk:', error)
      }
    }

    // Update document status and latest version
    await supabase
      .from('documents')
      .update({
        processing_status: 'processed',
        chunk_count: processedChunks,
        processed_at: new Date().toISOString(),
        latest_version: (version as any).version_no
      })
      .eq('id', documentId)

    console.log(`Document processing completed: ${processedChunks}/${chunks.length} chunks processed`)

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        versionId: (version as any).id,
        versionNo: (version as any).version_no,
        chunksProcessed: processedChunks,
        totalChunks: chunks.length,
        extractionMethod: method,
        extractionConfidence: confidence
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing document:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String((error as any)?.message || error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

  if (!openaiApiKey) {
    console.warn('OpenAI API key not found, using fallback embedding')
    // Deterministic 1536-dim pseudo-embedding for testing
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const array = new Uint8Array(hash)
    const dim = 1536
    const out: number[] = new Array(dim)
    for (let i = 0; i < dim; i++) {
      out[i] = ((array[i % array.length] - 128) / 128)
    }
    return out
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: Deno.env.get('EMBEDDING_MODEL_FALLBACK') || 'text-embedding-3-small',
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    // Fallback to deterministic 1536-dim pseudo-embedding
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const array = new Uint8Array(hash)
    const dim = 1536
    const out: number[] = new Array(dim)
    for (let i = 0; i < dim; i++) {
      out[i] = ((array[i % array.length] - 128) / 128)
    }
    return out
  }
}
