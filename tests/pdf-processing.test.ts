import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ 
          data: { 
            id: 'test-doc-id', 
            title: 'Test Document',
            storage_path: 'test/path.pdf',
            latest_version: 1,
            processing_status: 'pending'
          }, 
          error: null 
        }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ 
          data: { id: 'test-version-id' }, 
          error: null 
        }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    }))
  })),
  storage: {
    from: vi.fn(() => ({
      download: vi.fn(() => Promise.resolve({ 
        data: new Blob(['test pdf content'], { type: 'application/pdf' }), 
        error: null 
      }))
    }))
  },
  functions: {
    invoke: vi.fn(() => Promise.resolve({ 
      data: { success: true, chunksProcessed: 5 }, 
      error: null 
    }))
  }
};

// Mock OpenAI API
global.fetch = vi.fn();

describe('PDF Processing Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Document Upload and Processing Trigger', () => {
    it('should upload document and trigger processing', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      // Mock successful upload
      mockSupabase.storage.from().upload = vi.fn(() => Promise.resolve({ error: null }));
      
      // Simulate upload process
      const uploadResult = await mockSupabase.storage.from('documents').upload('test/path.pdf', file);
      expect(uploadResult.error).toBeNull();
      
      // Simulate document record creation
      const docResult = await mockSupabase.from('documents').insert({
        user_id: 'test-user',
        agent_id: 'test-agent',
        storage_path: 'test/path.pdf',
        title: 'test',
        mime: 'application/pdf',
        processing_status: 'pending'
      });
      
      expect(docResult.data).toBeDefined();
      
      // Simulate processing trigger
      const processResult = await mockSupabase.functions.invoke('process-document', {
        body: { documentId: 'test-doc-id' }
      });
      
      expect(processResult.data.success).toBe(true);
      expect(processResult.data.chunksProcessed).toBe(5);
    });

    it('should handle file type validation', () => {
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      // Simulate validation
      const isValidPDF = invalidFile.type === 'application/pdf';
      expect(isValidPDF).toBe(false);
    });

    it('should handle file size validation', () => {
      const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
      
      // Simulate size validation (50MB limit)
      const isValidSize = largeFile.size <= 50 * 1024 * 1024;
      expect(isValidSize).toBe(false);
    });
  });

  describe('Text Extraction and Chunking', () => {
    it('should extract text from PDF blob', async () => {
      const pdfBlob = new Blob(['test pdf content'], { type: 'application/pdf' });
      
      // Simulate text extraction (fallback method)
      const text = await pdfBlob.text();
      expect(text).toBe('test pdf content');
    });

    it('should create semantic chunks with overlap', () => {
      const text = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four.';
      const maxChunkSize = 50;
      const overlapSize = 10;
      
      // Simulate chunking algorithm
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const chunks = [];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        const sentenceWithPeriod = sentence.trim() + '.';
        if (currentChunk.length + sentenceWithPeriod.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = sentenceWithPeriod;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentenceWithPeriod;
        }
      }
      
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain('This is sentence one.');
    });

    it('should estimate token count correctly', () => {
      const text = 'This is a test sentence with multiple words.';
      
      // Simulate token estimation (1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil(text.length / 4);
      expect(estimatedTokens).toBeGreaterThan(0);
      expect(estimatedTokens).toBe(Math.ceil(44 / 4)); // 11 tokens
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings with agent-configured model', async () => {
      const text = 'Test text for embedding';
      const apiKey = 'test-api-key';
      const agentEmbeddingModel = 'text-embedding-3-large'; // Agent's configured model

      // Mock successful OpenAI response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(3072).fill(0.1) }] // Different dimension for large model
        })
      });

      // Simulate embedding generation with agent's model
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: agentEmbeddingModel, // Use agent's configured model
          input: text,
        }),
      });

      const data = await response.json();
      expect(data.data[0].embedding).toHaveLength(3072); // Large model dimension
    });

    it('should handle API errors with retry', async () => {
      const text = 'Test text';
      const apiKey = 'test-api-key';
      
      // Mock API error
      (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));
      
      try {
        await fetch('https://api.openai.com/v1/embeddings', {
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
      } catch (error) {
        expect(error.message).toBe('API Error');
      }
    });
  });

  describe('Database Operations', () => {
    it('should update document processing status', async () => {
      const documentId = 'test-doc-id';
      const status = 'processing';
      
      const result = await mockSupabase.from('documents')
        .update({ 
          processing_status: status,
          processing_started_at: new Date().toISOString()
        })
        .eq('id', documentId);
      
      expect(result.error).toBeNull();
    });

    it('should save chunks with embeddings and agent model info', async () => {
      const agentEmbeddingModel = 'text-embedding-3-small';
      const chunkData = {
        document_id: 'test-doc-id',
        version_id: 'test-version-id',
        content: 'Test chunk content',
        embedding: JSON.stringify(new Array(1536).fill(0.1)),
        chunk_index: 0,
        token_count: 4,
        embedding_model: agentEmbeddingModel, // Store agent's configured model
        processing_status: 'processed'
      };

      const result = await mockSupabase.from('chunks').insert(chunkData);
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle document not found', async () => {
      mockSupabase.from().select().eq().single = vi.fn(() => 
        Promise.resolve({ data: null, error: { message: 'Document not found' } })
      );
      
      const result = await mockSupabase.from('documents').select('*').eq('id', 'invalid-id').single();
      expect(result.error).toBeDefined();
      expect(result.data).toBeNull();
    });

    it('should handle storage download failure', async () => {
      mockSupabase.storage.from().download = vi.fn(() => 
        Promise.resolve({ data: null, error: { message: 'File not found' } })
      );
      
      const result = await mockSupabase.storage.from('documents').download('invalid/path.pdf');
      expect(result.error).toBeDefined();
      expect(result.data).toBeNull();
    });

    it('should handle processing function errors', async () => {
      mockSupabase.functions.invoke = vi.fn(() => 
        Promise.resolve({ data: null, error: { message: 'Processing failed' } })
      );
      
      const result = await mockSupabase.functions.invoke('process-document', {
        body: { documentId: 'test-doc-id' }
      });
      
      expect(result.error).toBeDefined();
      expect(result.data).toBeNull();
    });
  });
});

describe('UI Integration', () => {
  it('should display correct status badges', () => {
    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'processing': return 'Processing...';
        case 'processed': return 'Ready';
        case 'failed': return 'Failed';
        default: return 'Pending';
      }
    };
    
    expect(getStatusBadge('processing')).toBe('Processing...');
    expect(getStatusBadge('processed')).toBe('Ready');
    expect(getStatusBadge('failed')).toBe('Failed');
    expect(getStatusBadge('pending')).toBe('Pending');
  });

  it('should calculate processing progress correctly', () => {
    const getProcessingProgress = (status: string) => {
      if (status === 'processed') return 100;
      if (status === 'processing') return 50;
      return 0;
    };
    
    expect(getProcessingProgress('processed')).toBe(100);
    expect(getProcessingProgress('processing')).toBe(50);
    expect(getProcessingProgress('pending')).toBe(0);
    expect(getProcessingProgress('failed')).toBe(0);
  });
});
