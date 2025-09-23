-- Add missing columns to documents table for processing pipeline
ALTER TABLE documents 
ADD COLUMN processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed')),
ADD COLUMN processing_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN processing_error TEXT,
ADD COLUMN chunk_count INTEGER DEFAULT 0 NOT NULL;

-- Add index for processing status queries
CREATE INDEX idx_documents_processing_status ON documents(processing_status);
CREATE INDEX idx_documents_agent_processing ON documents(agent_id, processing_status);