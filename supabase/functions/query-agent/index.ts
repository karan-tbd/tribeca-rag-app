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
    const { query, agentId, sessionId, userId } = await req.json();
    
    if (!query || !agentId || !userId) {
      return new Response(JSON.stringify({ error: 'Query, agent ID, and user ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing query for agent:', agent.name);

    // Generate query embedding for retrieval (robust to API errors)
    const queryEmbedding = await generateEmbedding(query, openaiKey);

    // Find relevant documents for this agent
    const { data: documents } = await supabase
      .from('documents')
      .select('id, title')
      .eq('agent_id', agentId)
      .eq('user_id', userId);

    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No documents found for this agent',
        answer: "I don't have any documents to search through. Please upload some documents first."
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vector similarity search over agent's documents
    const relevantChunks = await findRelevantChunks(documents, queryEmbedding, supabase, agent);

    // Create query record
    const { data: queryRecord, error: queryError } = await supabase
      .from('queries')
      .insert({
        user_query: query,
        agent_id: agentId,
        user_id: userId,
        session_id: sessionId
      })
      .select()
      .single();

    if (queryError) {
      console.error('Failed to create query record:', queryError);
      return new Response(JSON.stringify({ error: 'Failed to record query' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate answer using LLM
    const answer = await generateAnswer(query, relevantChunks, agent, openaiKey);

    // Save answer
    const { data: answerRecord, error: answerError } = await supabase
      .from('answers')
      .insert({
        text: answer.text,
        query_id: queryRecord.id,
        session_id: sessionId,
        confidence: answer.confidence || 0.8,
        fail_safe_triggered: answer.confidence < agent.fail_safe_threshold
      })
      .select()
      .single();

    if (answerError) {
      console.error('Failed to save answer:', answerError);
    }

    // Save citations only if the answer was saved successfully
    if (answerRecord?.id) {
      for (const chunk of relevantChunks) {
        await supabase.from('answer_citations').insert({
          answer_id: answerRecord.id,
          document_id: chunk.document_id,
          version_id: chunk.version_id,
          page_start: chunk.page_start,
          page_end: chunk.page_end,
          chunk_index: chunk.chunk_index,
          sim_score: chunk.similarity || 0.5
        });
      }
    }

    return new Response(JSON.stringify({ 
      answer: answer.text,
      confidence: answer.confidence,
      citations: relevantChunks.map(c => ({
        documentId: c.document_id,
        pageStart: c.page_start,
        pageEnd: c.page_end
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing query:', error);
    const message = (error as any)?.message || 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function findRelevantChunks(documents: any[], queryEmbedding: number[] | null, supabase: any, agent: any) {
  try {
    const docIds: string[] = (documents || []).map((d: any) => d.id).filter(Boolean);
    if (!docIds.length) return [];
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];

    const match_count = typeof agent?.k === 'number' ? Math.max(1, Math.min(20, agent.k)) : 5;
    const similarity_threshold = typeof agent?.sim_threshold === 'number' ? agent.sim_threshold : 0;

    // Delegate vector similarity to Postgres via RPC
    // Pass embedding as pgvector literal string for robust casting
    const qvLiteral = `[${queryEmbedding.join(',')}]`;
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: qvLiteral as any,
      doc_ids: docIds as any,
      match_count,
      similarity_threshold,
    });

    if (error) {
      console.error('RPC match_chunks error:', error);
      return [];
    }

    return (data || []).map((r: any) => ({
      ...r,
      similarity: r.similarity,
    }));
  } catch (e) {
    console.error('findRelevantChunks failed:', e);
    return [];
  }
}

async function generateAnswer(query: string, chunks: any[], agent: any, apiKey: string) {
  const context = chunks.map(c => `Document ${c.document_id} (Page ${c.page_start}-${c.page_end}): ${c.content ?? ''}`).join('\n\n');

  const systemPrompt = agent.system_prompt ||
    "You are a question-answering assistant. Answer strictly based on provided context excerpts. If insufficient evidence, say: \"I don't have enough evidence in the documents to answer confidently.\" Always cite sources with filename and page.";

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agent.gen_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI chat error:', response.status, errText);
      return {
        text: "I'm having trouble generating a response right now.",
        confidence: 0.3,
      };
    }

    const data = await response.json();
    return {
      text: data?.choices?.[0]?.message?.content ?? "I couldn't generate a response.",
      confidence: 0.8 // TODO: Implement proper confidence scoring
    };
  } catch (e) {
    console.error('generateAnswer failed:', e);
    return {
      text: "I'm having trouble generating a response right now.",
      confidence: 0.3,
    };
  }
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
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

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI embeddings error:', response.status, errText);
      return null;
    }

    const data = await response.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error('generateEmbedding failed:', e);
    return null;
  }
}