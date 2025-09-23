# Detailed Linear Issues for RAG Framework App v1

## RAG-1: Google Sign-In Integration
**Epic:** Authentication & User Management  
**Type:** Feature  
**Component:** auth  
**Estimate:** M (3 points)  
**Risk:** Low  
**Labels:** backend, auth

### Problem
Users need secure authentication to access the RAG application and manage their personal agents and documents.

### Acceptance Criteria
- [ ] Supabase Auth configured with Google OAuth provider
- [ ] User profile automatically created in `users` table on first login
- [ ] Successful login redirects to agent configuration page
- [ ] Failed authentication shows clear error messages
- [ ] User session persists across browser refreshes
- [ ] Logout functionality clears session completely

### Technical Notes
- Use Supabase Auth with Google provider
- Implement auth state management in Next.js
- Create user record with email, name, avatar_url from Google profile
- Set up protected routes middleware

### Dependencies
None

### Test Plan
- Test Google OAuth flow end-to-end
- Verify user creation in database
- Test session persistence and logout
- Test error handling for auth failures

---

## RAG-2: Row-Level Security Setup
**Epic:** Authentication & User Management  
**Type:** Feature  
**Component:** security  
**Estimate:** L (5 points)  
**Risk:** Medium  
**Labels:** backend, auth, security

### Problem
Ensure users can only access their own data and prevent unauthorized access to other users' agents, documents, and sessions.

### Acceptance Criteria
- [ ] RLS policies implemented for all user-scoped tables
- [ ] Users can only read/write their own agents, documents, sessions
- [ ] Admin role can access all data for purge operations
- [ ] RLS policies tested with multiple user accounts
- [ ] No data leakage between users verified
- [ ] Performance impact of RLS policies measured and acceptable

### Technical Notes
- Implement RLS policies in Supabase for: users, agents, documents, sessions, queries, answers
- Create admin role with bypass permissions
- Use `auth.uid()` in policy conditions
- Test policies with different user contexts

### Dependencies
RAG-1 (Google Sign-In Integration)

### Test Plan
- Create test users and verify data isolation
- Test admin access to all data
- Performance test RLS policy impact
- Security audit of all table access patterns

---

## RAG-3: Agent Configuration UI
**Epic:** Agent Configuration  
**Type:** Feature  
**Component:** frontend  
**Estimate:** L (5 points)  
**Risk:** Low  
**Labels:** frontend

### Problem
Users need an intuitive interface to configure their RAG agent's behavior, prompts, and retrieval parameters.

### Acceptance Criteria
- [ ] Form with fields for agent name, description, system prompt
- [ ] Query template editor with syntax highlighting and placeholders
- [ ] Dropdown selectors for embedding and generation models
- [ ] Sliders for retrieval parameters (k=1-20, threshold=0.1-1.0)
- [ ] Confidence threshold sliders (display, fail-safe)
- [ ] Save button persists changes with loading state
- [ ] Reset button restores to last saved state
- [ ] Form validation with helpful error messages
- [ ] Mobile-responsive design

### Technical Notes
- Use React Hook Form for form management
- Implement syntax highlighting for prompt templates
- Use controlled components for all form inputs
- Add debounced auto-save functionality
- Validate prompt templates for required placeholders

### Dependencies
RAG-1 (Google Sign-In Integration)

### Test Plan
- Test all form inputs and validation
- Verify save/reset functionality
- Test mobile responsiveness
- Test with various prompt template formats

---

## RAG-4: Agent Persistence Layer
**Epic:** Agent Configuration  
**Type:** Feature  
**Component:** persistence  
**Estimate:** M (3 points)  
**Risk:** Low  
**Labels:** backend

### Problem
Agent configurations need to be stored, retrieved, and versioned in the database with proper validation.

### Acceptance Criteria
- [ ] CRUD operations for agents via Supabase client
- [ ] Default agent automatically created on user signup
- [ ] Agent configuration versioning support
- [ ] Validation for all agent parameters (prompts, thresholds, models)
- [ ] Optimistic updates with error rollback
- [ ] Agent deletion with cascade to related data

### Technical Notes
- Implement agent service layer with TypeScript interfaces
- Add database triggers for updated_at timestamps
- Validate model names against supported list
- Implement soft delete for agents with active sessions

### Dependencies
RAG-2 (Row-Level Security Setup)

### Test Plan
- Test CRUD operations for agents
- Verify default agent creation
- Test validation rules
- Test cascade deletion behavior

---

## RAG-5: PDF Upload Interface
**Epic:** Document Ingestion & Indexing  
**Type:** Feature  
**Component:** ingestion  
**Estimate:** M (3 points)  
**Risk:** Low  
**Labels:** frontend

### Problem
Users need an intuitive way to upload PDF documents and manage their document library with version control.

### Acceptance Criteria
- [ ] Drag-and-drop upload area for PDF files (≤10MB)
- [ ] Re-embed checkbox with tooltip explaining when to use
- [ ] Upload progress indicator with percentage and cancel option
- [ ] File validation (PDF only, size limit) with clear error messages
- [ ] Document list showing title, upload date, version, status
- [ ] Version history view for each document
- [ ] Document deletion with confirmation dialog

### Technical Notes
- Use react-dropzone for file upload UI
- Implement chunked upload for large files
- Store files in Supabase Storage with organized folder structure
- Add file type validation and virus scanning

### Dependencies
RAG-3 (Agent Configuration UI)

### Test Plan
- Test drag-and-drop and click upload
- Test file validation and error handling
- Test upload progress and cancellation
- Test document list and version history

---

## RAG-6: PDF Processing Pipeline
**Epic:** Document Ingestion & Indexing  
**Type:** Feature  
**Component:** ingestion  
**Estimate:** XL (8 points)  
**Risk:** High  
**Labels:** backend, retrieval

### Problem
Uploaded PDFs need to be parsed, chunked, embedded, and stored in vector database with proper metadata tracking.

### Acceptance Criteria
- [ ] PDF text extraction with layout preservation
- [ ] Intelligent chunking (500-800 tokens, 10-15% overlap)
- [ ] OpenAI embedding generation with error handling
- [ ] Pinecone upsert with proper namespace management
- [ ] Document versioning with checksum validation
- [ ] Metadata storage linking chunks to documents
- [ ] Progress tracking for long-running operations
- [ ] Retry logic for failed operations
- [ ] Cleanup of failed/partial uploads

### Technical Notes
- Use PDF parsing library (pdf-parse or similar)
- Implement semantic chunking with sentence boundaries
- Batch embedding requests for efficiency
- Use Pinecone namespace pattern: `user_id:agent_id`
- Store chunk metadata in Supabase with vector IDs

### Dependencies
RAG-4 (Agent Persistence Layer)

### Test Plan
- Test with various PDF formats and sizes
- Verify chunking quality and overlap
- Test embedding generation and storage
- Test error handling and retry logic
- Performance test with large documents

---

## RAG-7: Vector Storage Integration
**Epic:** Document Ingestion & Indexing  
**Type:** Feature  
**Component:** retrieval  
**Estimate:** L (5 points)  
**Risk:** Medium  
**Labels:** backend, infra

### Problem
Need robust vector storage and retrieval system with proper namespace isolation and similarity search capabilities.

### Acceptance Criteria
- [ ] Pinecone index configuration with appropriate dimensions
- [ ] Upsert operations with metadata and error handling
- [ ] Similarity search with configurable k and threshold
- [ ] Namespace isolation per user/agent combination
- [ ] Batch operations for efficiency
- [ ] Connection pooling and retry logic
- [ ] Vector deletion for document removal
- [ ] Performance monitoring and optimization

### Technical Notes
- Configure Pinecone index with 1536 dimensions for OpenAI embeddings
- Implement connection pooling for Pinecone client
- Use metadata filtering for efficient retrieval
- Add circuit breaker pattern for reliability

### Dependencies
RAG-6 (PDF Processing Pipeline)

### Test Plan
- Test vector upsert and retrieval operations
- Verify namespace isolation between users
- Performance test with large vector sets
- Test error handling and retry logic

---

## RAG-8: Session Management
**Epic:** Session-based Chat & Prompt Assembly
**Type:** Feature
**Component:** sessions
**Estimate:** L (5 points)
**Risk:** Medium
**Labels:** backend

### Problem
Chat conversations need session-based memory management with running summaries and context window optimization.

### Acceptance Criteria
- [ ] Session CRUD operations with user/agent association
- [ ] Message persistence with role tracking (user/assistant/system)
- [ ] Running summary generation and updates
- [ ] Context reset functionality creating new sessions
- [ ] Token counting for all message components
- [ ] 8K token budget management across prompt components
- [ ] Session title generation from first user message

### Technical Notes
- Implement session service with message threading
- Use OpenAI tokenizer for accurate token counting
- Create summary update logic triggered by cited responses
- Implement context window sliding with summary preservation

### Dependencies
RAG-7 (Vector Storage Integration)

### Test Plan
- Test session creation and message persistence
- Verify token counting accuracy
- Test summary generation and updates
- Test context reset functionality

---

## RAG-9: Chat Interface
**Epic:** Session-based Chat & Prompt Assembly
**Type:** Feature
**Component:** frontend
**Estimate:** XL (8 points)
**Risk:** Medium
**Labels:** frontend, sessions

### Problem
Users need an intuitive chat interface that displays conversations, citations, confidence scores, and session management controls.

### Acceptance Criteria
- [ ] Real-time chat UI with message bubbles and timestamps
- [ ] Citation display with clickable document references
- [ ] Confidence score indicators with color coding
- [ ] Session sidebar with create/switch/delete functionality
- [ ] Loading states for message processing
- [ ] Error handling with retry options
- [ ] Mobile-responsive design with touch interactions
- [ ] Message export functionality
- [ ] Keyboard shortcuts for common actions

### Technical Notes
- Use WebSocket or Server-Sent Events for real-time updates
- Implement virtual scrolling for long conversations
- Add citation modal with document preview
- Use optimistic updates for better UX

### Dependencies
RAG-8 (Session Management)

### Test Plan
- Test real-time message updates
- Verify citation display and navigation
- Test session management functionality
- Test mobile responsiveness and touch interactions

---

## RAG-10: Prompt Assembly Engine
**Epic:** Session-based Chat & Prompt Assembly
**Type:** Feature
**Component:** generation
**Estimate:** XL (8 points)
**Risk:** High
**Labels:** backend, retrieval, sessions

### Problem
Need intelligent prompt assembly that combines system prompts, session summaries, recent messages, and RAG context within token limits.

### Acceptance Criteria
- [ ] 8K token budget management with component allocation
- [ ] System prompt injection (~200-400 tokens)
- [ ] Running summary integration (~200-300 tokens)
- [ ] Last K turns retrieval with configurable K (~2000-3000 tokens)
- [ ] RAG context assembly from vector search (~3000-4000 tokens)
- [ ] Buffer management for safety (~500 tokens)
- [ ] Summary updates only when new cited content is provided
- [ ] Graceful degradation when context exceeds limits

### Technical Notes
- Implement prompt template system with variable substitution
- Use priority-based token allocation algorithm
- Create summary update detection logic
- Add prompt optimization for token efficiency

### Dependencies
RAG-8 (Session Management), RAG-7 (Vector Storage Integration)

### Test Plan
- Test token budget management across scenarios
- Verify prompt assembly with various context sizes
- Test summary update logic
- Performance test prompt generation speed
