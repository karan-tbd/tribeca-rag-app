# Linear Project Setup: RAG Framework App v1

## Project Overview
**Name:** RAG Framework App v1  
**Description:** Production-grade RAG app with session memory, ingestion pipeline, Pinecone + Supabase, customizable prompts, inline evals, dashboards, and confidence fail-safe.  
**Timeline:** 6 weeks from today  
**Lead:** Solo builder (you)

## 1. Project Configuration

### Basic Settings
- **Project Key:** RAG
- **Start Date:** Today
- **Target Date:** +6 weeks
- **Access:** Private (solo project)

### Workflow States
Create a single workflow with these states:
1. **Backlog** - Ideas and future work
2. **Spec** - Requirements being defined
3. **Ready** - Ready for development
4. **In Progress** - Currently being worked on
5. **Blocked** - Waiting on dependencies
6. **In Review** - Code review/testing
7. **QA** - Quality assurance
8. **Done** - Completed and verified

### Labels
Create these labels for categorization:
- `frontend` - Next.js UI components
- `backend` - Supabase Edge Functions
- `infra` - Infrastructure and deployment
- `evals` - Evaluation and confidence systems
- `retrieval` - RAG and vector operations
- `auth` - Authentication and security
- `observability` - Logging and monitoring
- `docs` - Documentation

### Custom Fields
1. **Component** (Select)
   - ingestion
   - retrieval
   - generation
   - evals
   - sessions
   - dashboard
   - persistence
   - security

2. **Estimate** (Select)
   - XS (1 point)
   - S (2 points)
   - M (3 points)
   - L (5 points)
   - XL (8 points)
   - XXL (13 points)

3. **Risk** (Select)
   - Low
   - Medium
   - High

4. **Acceptance** (Text)
   - Detailed acceptance criteria

## 2. Epics/Milestones

### Epic 1: Authentication & User Management
**Goal:** Secure user access with Google Sign-In via Supabase
**Timeline:** Week 1
**Components:** auth, security

### Epic 2: Agent Configuration
**Goal:** User-configurable agents with prompts and retrieval parameters
**Timeline:** Week 1-2
**Components:** persistence, frontend

### Epic 3: Document Ingestion & Indexing
**Goal:** PDF upload, parsing, chunking, embedding, and Pinecone storage
**Timeline:** Week 2-3
**Components:** ingestion, retrieval

### Epic 4: Session-based Chat & Prompt Assembly
**Goal:** Conversational interface with session memory and context management
**Timeline:** Week 3-4
**Components:** sessions, generation, frontend

### Epic 5: Evaluation & Confidence System
**Goal:** Inline evaluation with heuristics, LLM judge, and fail-safe logic
**Timeline:** Week 4-5
**Components:** evals, generation

### Epic 6: Dashboard & Analytics
**Goal:** Query analytics, performance metrics, and admin interface
**Timeline:** Week 5-6
**Components:** dashboard, observability

### Epic 7: Security, RLS & Purge
**Goal:** Row-level security and data purge capabilities
**Timeline:** Week 6
**Components:** security, persistence

### Epic 8: Deployment & Observability
**Goal:** Production deployment with monitoring and structured logging
**Timeline:** Week 6
**Components:** infra, observability

## 3. Issue Templates

### Feature Template
```
## Problem
[What problem does this solve?]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes
[Implementation details, API endpoints, database changes]

## Dependencies
[Other issues that must be completed first]

## Test Plan
[How to verify this works correctly]
```

### Chore Template
```
## Task
[What needs to be done?]

## Steps
1. Step 1
2. Step 2
3. Step 3

## Done When
[Clear completion criteria]
```

### Bug Template
```
## Environment
[Development/Staging/Production]

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected vs Actual
**Expected:** [What should happen]
**Actual:** [What actually happens]

## Severity
[Low/Medium/High/Critical]

## Fix Plan
[Proposed solution approach]
```

### Spike/Research Template
```
## Hypothesis
[What we think we'll find]

## Questions
- Question 1
- Question 2
- Question 3

## Timebox
[Maximum time to spend]

## Output/Decision
[What decision needs to be made based on findings]
```

### Prompt Template
```
## Goal
[What this prompt should accomplish]

## Input Schema
[Expected input format and fields]

## Output Schema
[Expected output format and fields]

## Guardrails
[Safety and quality constraints]

## Evaluation Criteria
[How to measure prompt effectiveness]
```

## 4. Seed Issues by Epic

### Epic 1: Authentication & User Management

#### RAG-1: Google Sign-In Integration
**Type:** Feature
**Component:** auth
**Estimate:** M (3 points)
**Risk:** Low
**Labels:** backend, auth

**Acceptance Criteria:**
- [ ] Supabase Auth configured with Google provider
- [ ] User profile creation on first login
- [ ] Redirect to agent config after successful auth
- [ ] Error handling for auth failures

**Dependencies:** None

#### RAG-2: Row-Level Security Setup
**Type:** Feature
**Component:** security
**Estimate:** L (5 points)
**Risk:** Medium
**Labels:** backend, auth, security

**Acceptance Criteria:**
- [ ] RLS policies for all user-scoped tables
- [ ] Users can only access their own data
- [ ] Admin role can access all data for purge operations
- [ ] Security tests pass

**Dependencies:** RAG-1

### Epic 2: Agent Configuration

#### RAG-3: Agent Configuration UI
**Type:** Feature
**Component:** frontend
**Estimate:** L (5 points)
**Risk:** Low
**Labels:** frontend

**Acceptance Criteria:**
- [ ] Form for agent name, description, system prompt
- [ ] Query template editor with syntax highlighting
- [ ] Model selection dropdowns (embed/generation)
- [ ] Retrieval parameter sliders (k, threshold)
- [ ] Save/reset functionality

**Dependencies:** RAG-1

#### RAG-4: Agent Persistence Layer
**Type:** Feature
**Component:** persistence
**Estimate:** M (3 points)
**Risk:** Low
**Labels:** backend

**Acceptance Criteria:**
- [ ] Agent CRUD operations via Supabase
- [ ] Default agent creation on user signup
- [ ] Configuration versioning support
- [ ] Validation for all agent parameters

**Dependencies:** RAG-2

### Epic 3: Document Ingestion & Indexing

#### RAG-5: PDF Upload Interface
**Type:** Feature
**Component:** ingestion
**Estimate:** M (3 points)
**Risk:** Low
**Labels:** frontend

**Acceptance Criteria:**
- [ ] Drag-and-drop PDF upload (≤50MB)
- [ ] Re-embed checkbox with tooltip
- [ ] Upload progress indicator
- [ ] File validation and error messages
- [ ] Document list with version history

**Dependencies:** RAG-3

#### RAG-6: PDF Processing Pipeline
**Type:** Feature
**Component:** ingestion
**Estimate:** XL (8 points)
**Risk:** High
**Labels:** backend, retrieval

**Acceptance Criteria:**
- [ ] PDF parsing with text extraction
- [ ] Chunking (500-800 tokens, 10-15% overlap)
- [ ] OpenAI embedding generation
- [ ] Pinecone namespace management (user_id:agent_id)
- [ ] Document versioning and checksum validation
- [ ] Metadata storage in Supabase

**Dependencies:** RAG-4

#### RAG-7: Vector Storage Integration
**Type:** Feature
**Component:** retrieval
**Estimate:** L (5 points)
**Risk:** Medium
**Labels:** backend, infra

**Acceptance Criteria:**
- [ ] Pinecone index configuration
- [ ] Upsert operations with metadata
- [ ] Similarity search functionality
- [ ] Namespace isolation per user/agent
- [ ] Error handling and retries

**Dependencies:** RAG-6

### Epic 4: Session-based Chat & Prompt Assembly

#### RAG-8: Session Management
**Type:** Feature
**Component:** sessions
**Estimate:** L (5 points)
**Risk:** Medium
**Labels:** backend

**Acceptance Criteria:**
- [ ] Session CRUD operations
- [ ] Message persistence with role tracking
- [ ] Session summary generation and updates
- [ ] Context reset functionality
- [ ] Token counting and budget management

**Dependencies:** RAG-7

#### RAG-9: Chat Interface
**Type:** Feature
**Component:** frontend
**Estimate:** XL (8 points)
**Risk:** Medium
**Labels:** frontend, sessions

**Acceptance Criteria:**
- [ ] Real-time chat UI with message history
- [ ] Citation display with document references
- [ ] Confidence score indicators
- [ ] Session management (new/reset/delete)
- [ ] Loading states and error handling
- [ ] Mobile-responsive design

**Dependencies:** RAG-8

#### RAG-10: Prompt Assembly Engine
**Type:** Feature
**Component:** generation
**Estimate:** XL (8 points)
**Risk:** High
**Labels:** backend, retrieval, sessions

**Acceptance Criteria:**
- [ ] 8K token budget management
- [ ] System prompt injection (~200-400 tokens)
- [ ] Running summary integration (~200-300 tokens)
- [ ] Last K turns retrieval (~2000-3000 tokens)
- [ ] RAG context assembly (~3000-4000 tokens)
- [ ] Buffer management (~500 tokens)
- [ ] Summary updates only with cited content

**Dependencies:** RAG-8, RAG-7

### Epic 5: Evaluation & Confidence System

#### RAG-11: Heuristic Evaluators
**Type:** Feature
**Component:** evals
**Estimate:** M (3 points)
**Risk:** Low
**Labels:** backend, evals

**Acceptance Criteria:**
- [ ] Max similarity score calculation
- [ ] Mean similarity score calculation
- [ ] Percentage above threshold calculation
- [ ] Configurable similarity thresholds
- [ ] Performance optimization for real-time eval

**Dependencies:** RAG-10

#### RAG-12: LLM Judge Integration
**Type:** Feature
**Component:** evals
**Estimate:** L (5 points)
**Risk:** Medium
**Labels:** backend, evals

**Acceptance Criteria:**
- [ ] Faithfulness evaluation prompt
- [ ] JSON response parsing (score + rationale)
- [ ] Error handling for LLM failures
- [ ] Fallback to heuristics when LLM unavailable
- [ ] Evaluation result persistence

**Dependencies:** RAG-11

#### RAG-13: Confidence Aggregation & Fail-safe
**Type:** Feature
**Component:** evals
**Estimate:** M (3 points)
**Risk:** Medium
**Labels:** backend, evals, generation

**Acceptance Criteria:**
- [ ] Weighted confidence score calculation
- [ ] Configurable confidence thresholds per agent
- [ ] Fail-safe response when confidence <0.5
- [ ] Confidence display logic (show when <0.8)
- [ ] Confidence logging for analytics

**Dependencies:** RAG-12

### Epic 6: Dashboard & Analytics

#### RAG-14: Analytics Data Collection
**Type:** Feature
**Component:** observability
**Estimate:** M (3 points)
**Risk:** Low
**Labels:** backend, observability

**Acceptance Criteria:**
- [ ] Query/response logging with timestamps
- [ ] Token usage tracking (input/output)
- [ ] Latency measurement (p50/p95)
- [ ] Confidence score aggregation
- [ ] Failed query identification (<0.5 confidence)

**Dependencies:** RAG-13

#### RAG-15: Dashboard UI
**Type:** Feature
**Component:** dashboard
**Estimate:** L (5 points)
**Risk:** Low
**Labels:** frontend, observability

**Acceptance Criteria:**
- [ ] Queries per day time series chart
- [ ] Messages sent/received counters
- [ ] Correctness percentage (≥0.8 confidence)
- [ ] Top failed queries list
- [ ] Average tokens per turn display
- [ ] Latency percentiles (p50/p95)
- [ ] Date range filtering

**Dependencies:** RAG-14

### Epic 7: Security, RLS & Purge

#### RAG-16: Data Purge System
**Type:** Feature
**Component:** security
**Estimate:** M (3 points)
**Risk:** Medium
**Labels:** backend, security

**Acceptance Criteria:**
- [ ] Manual purge endpoint for user data
- [ ] Admin purge for all data
- [ ] Tombstone logging for audit trail
- [ ] Cascade deletion across related tables
- [ ] Confirmation UI for destructive operations

**Dependencies:** RAG-2

### Epic 8: Deployment & Observability

#### RAG-17: Production Deployment
**Type:** Feature
**Component:** infra
**Estimate:** L (5 points)
**Risk:** Medium
**Labels:** infra

**Acceptance Criteria:**
- [ ] Vercel deployment configuration
- [ ] Environment variable management
- [ ] Supabase production setup
- [ ] Pinecone production index
- [ ] Domain configuration and SSL

**Dependencies:** RAG-15

#### RAG-18: Structured Logging & Tracing
**Type:** Feature
**Component:** observability
**Estimate:** M (3 points)
**Risk:** Low
**Labels:** backend, observability, infra

**Acceptance Criteria:**
- [ ] Structured JSON logging
- [ ] Request tracing with correlation IDs
- [ ] Error logging with stack traces
- [ ] Performance monitoring integration
- [ ] Log aggregation setup

**Dependencies:** RAG-17

#### RAG-19: CI/CD Pipeline
**Type:** Feature
**Component:** infra
**Estimate:** M (3 points)
**Risk:** Low
**Labels:** infra

**Acceptance Criteria:**
- [ ] GitHub Actions workflow
- [ ] Automated linting and testing
- [ ] Preview deployments for PRs
- [ ] Production deployment on main branch
- [ ] Rollback capabilities

**Dependencies:** RAG-17

## 5. Sprint Planning

### Sprint 1: Foundation (Weeks 1-2)
**Goal:** Authentication, agent config, and basic infrastructure
**Issues:** RAG-1, RAG-2, RAG-3, RAG-4, RAG-17
**Deliverable:** Authenticated users can configure agents

### Sprint 2: RAG Core (Weeks 3-4)
**Goal:** Document ingestion, vector storage, and chat interface
**Issues:** RAG-5, RAG-6, RAG-7, RAG-8, RAG-9, RAG-10
**Deliverable:** Users can upload docs and chat with basic RAG

### Sprint 3: Intelligence & Polish (Weeks 5-6)
**Goal:** Evaluation system, dashboard, security, and production readiness
**Issues:** RAG-11, RAG-12, RAG-13, RAG-14, RAG-15, RAG-16, RAG-18, RAG-19
**Deliverable:** Production-ready app with confidence scoring and analytics

## 6. Saved Views/Filters

Create these saved views in Linear:

1. **P0 v1 Open**
   - Filter: Status not in [Done] AND Labels contains [P0]
   - Sort: Priority desc, Created date asc

2. **Blocked Issues**
   - Filter: Status = Blocked
   - Sort: Updated date desc

3. **High Risk Items**
   - Filter: Risk = High AND Status not in [Done]
   - Sort: Priority desc

4. **Current Sprint**
   - Filter: Sprint = [Current Sprint]
   - Sort: Status, Priority desc

5. **Ready for Development**
   - Filter: Status = Ready
   - Sort: Priority desc, Estimate asc

## 7. Implementation Notes

### Manual Steps Required:
1. **Linear Project Creation:** Create new project with above settings
2. **Custom Fields:** Add Component, Estimate, Risk, and Acceptance fields
3. **Labels:** Create all specified labels with appropriate colors
4. **Issue Templates:** Set up templates for Feature, Chore, Bug, Spike, and Prompt
5. **Epics:** Create 8 epics as milestones
6. **Issues:** Create all 19 seed issues with proper epic assignment
7. **Sprints:** Set up 3 sprints with 2-week durations
8. **Views:** Create saved views for efficient filtering

### Integration Opportunities:
- **GitHub:** Link repository for automatic issue updates
- **Vercel:** Connect for deployment status tracking
- **Slack:** Set up notifications for issue updates

### Success Metrics:
- All 19 issues completed within 6 weeks
- Zero high-risk issues remaining open
- Dashboard showing >80% confidence on queries
- Production deployment successful with monitoring

---

**Next Steps:**
1. Create Linear project with above configuration
2. Import issues and set up epics
3. Begin Sprint 1 with authentication and agent config
4. Set up development environment and repository
5. Configure Supabase and Pinecone accounts
