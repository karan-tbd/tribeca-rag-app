import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

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

    console.log('Processing document:', doc.title);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error('Failed to download file:', downloadError);
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Simple text extraction for demo (in production, use proper PDF parser)
    const text = await fileData.text();
    const chunks = chunkText(text, 1000); // 1000 char chunks

    console.log(`Extracted ${chunks.length} chunks from document`);

    // Create document version
    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_no: doc.latest_version + 1,
        checksum: await generateChecksum(text)
      })
      .select()
      .single();

    if (versionError) {
      console.error('Failed to create version:', versionError);
      return new Response(JSON.stringify({ error: 'Failed to create version' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process chunks and generate embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding
      const embedding = await generateEmbedding(chunk, openaiKey);
      
      // Save chunk
      await supabase.from('chunks').insert({
        document_id: documentId,
        version_id: version.id,
        page_start: 1, // TODO: extract actual page numbers
        page_end: 1,
        chunk_index: i,
        token_count: chunk.length / 4 // rough estimate
      });

      console.log(`Processed chunk ${i + 1}/${chunks.length}`);
    }

    // Update document latest version
    await supabase
      .from('documents')
      .update({ latest_version: version.version_no })
      .eq('id', documentId);

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

async function generateChecksum(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}