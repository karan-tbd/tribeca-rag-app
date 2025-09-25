# Project Status — tribeca-rag-app

Last updated: 2025-09-24

## Executive Summary
- Foundations are implemented and verified: Authentication (Google/Microsoft), RLS, Agent configuration + persistence, PDF upload and processing pipeline with pgvector.
- Chat-related features (Session Management, Chat UI end‑to‑end, Prompt Assembly) are currently non‑functional and deferred. Stakeholders should treat "chat" as not ready for use.
- Core tests pass quickly; component tests have memory issues (leaks/timeouts). CI/CD pipeline not finalized.

## At‑a‑Glance Status

### Product Features
- [x] Google login (Supabase Auth)
- [x] Microsoft login (Supabase Auth)
- [x] Agent Configuration UI (create/update/delete, validation)
- [x] Agent Persistence Layer (Supabase Postgres with RLS)
- [x] PDF Upload (10MB limit, Storage pathing)
- [x] PDF Processing Pipeline (pdf.js extraction, chunking, embeddings, pgvector storage, status)
- [ ] Vector Retrieval Integration (Pinecone/pgvector search API)
- [ ] Chat UI (citations, confidence, polished UX)
- [ ] Session Management (summaries, token budget, auto titles)
- [ ] Prompt Assembly Engine (system prompt + summary + turns + RAG context)
- [ ] Confidence Aggregation & Display
- [ ] Query/Answer/Eval Logging + Dashboards
- [ ] CI/CD Pipeline + Production Deployment

### User Actions (E2E)
- [x] Sign in with Google/Microsoft
- [x] Create and edit agents
- [x] Upload a PDF document to an agent
- [x] Observe processing status and chunk counts update in UI (Realtime)
- [ ] Start a chat and receive responses (currently non‑functional; see error below)

### Current Chat Error (for reference)
- UI toast shows: "Failed to send message — Edge Function returned a non‑2xx status code"
- Likely from `supabase.functions.invoke('query-agent')` returning non‑2xx.
- Work deferred to later sprint; issues updated in Linear (KAR‑16/17/18 → Backlog with comments).

## Technical Developments

### Frontend
- Vite + React + TypeScript + Tailwind + shadcn/ui
- Key components/pages:
  - Agents (AgentConfigForm, AgentDocuments)
  - Documents (upload + status UI)
  - Chat (MVP UI present; non‑functional end‑to‑end)
  - AuthProvider, ProtectedRoute

### Backend (Supabase)
- Edge Functions:
  - `process-document`: extracts text with pdf.js, chunks, generates embeddings (OpenAI `text-embedding-3-small` by default, with deterministic fallback for dev), stores in `public.chunks` (pgvector), updates status/counts via RPC/trigger.
  - `query-agent`: invoked by Chat (currently returns non‑2xx; to be diagnosed when chat work resumes).
  - `sync_linear_project`: utility for Linear integration tests.
- Database & Migrations (highlights):
  - `enable_pgvector_extension.sql`
  - `add_processing_status_and_chunk_content.sql`
  - `enable_realtime_for_documents_pipeline.sql`
  - `recreate_processing_functions_and_trigger.sql` (idempotent; provides `update_document_processing_status`, `update_document_chunk_count`, trigger on `public.chunks`).

### Storage & Data Model
- Documents stored in Supabase Storage at `documents/{user_id}/{timestamp}-{filename}.pdf`.
- Tables: `agents`, `documents`, `document_versions`, `chunks`, `sessions`, `messages` (RLS enforced).
- Embeddings: stored in Postgres `vector(1536)` via pgvector.

## Testing & Quality
- Core tests: Passing and performant (see `test-suite-summary.md`).
- Component tests: Memory leaks/timeouts; suite split recommended (`test:ci` vs `test:components`).
- Immediate actions (pending): fix cleanup in component tests, mock Supabase realtime properly, consider Router future flags.

## Linear Tracking Snapshot
- Done: KAR‑6 (RLS), KAR‑7 (Agent Config UI), KAR‑8 (Agent Persistence), KAR‑15 (PDF Upload), KAR‑32 (DB functions/trigger)
- Backlog (deferred chat work): KAR‑16 (Session Management), KAR‑17 (Prompt Assembly), KAR‑18 (Chat UI)
- Upcoming priorities: KAR‑14 (Vector Retrieval Integration), KAR‑21 (Confidence Display), KAR‑22 (Logging/Analytics), KAR‑27 (CI/CD), KAR‑25 (Production Deployment)

## Risks / Blockers
- Chat E2E non‑functional (query‑agent non‑2xx).
- UI component tests unstable (heap exhaustion); risk for CI/CD.
- Retrieval choice (Pinecone vs. pgvector search service) not finalized; affects acceptance criteria for KAR‑13/KAR‑14.

## Next Sprint Recommendations
1. Unblock chat path:
   - Diagnose `query-agent` Edge Function (logs, env vars, auth, payload contract)
   - Add integration test for send/receive
2. Retrieval layer:
   - Implement top‑k similarity search (pgvector SQL or Pinecone client)
   - Expose retrieval to `query-agent` and prompt assembly
3. Prompting & UX:
   - Implement summaries/token budget and wire citations/confidence
4. CI/CD:
   - Stabilize tests, wire CI pipeline, prepare for staged deployment

## Acceptance Criteria Summary (What’s “done” today)
- Auth works with Google/Microsoft; new users isolated via RLS.
- Users can create/edit/delete agents; agent settings persisted with validation.
- Users can upload PDFs; documents are processed into chunks with embeddings; counts/status updated and visible.
- Embeddings stored in Postgres via pgvector; OpenAI used by default in prod; deterministic fallback for local/dev.
- Chat UI is present but not usable; chat features are explicitly marked Backlog in Linear with error context.

