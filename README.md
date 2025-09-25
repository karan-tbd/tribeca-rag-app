# Tribeca RAG App

A production‑oriented Retrieval‑Augmented Generation (RAG) web application built with React (Vite + TypeScript), Supabase (Postgres, Storage, Edge Functions, RLS, pgvector), Tailwind CSS, and shadcn/ui.

## Features
- Authentication: Google and Microsoft login (Supabase Auth)
- Agent management: create/update/delete agents with validation and RLS
- Document ingestion: PDF upload (≤10MB), status updates via Realtime
- Processing pipeline: pdf.js extraction → chunking → embeddings → stored in Postgres (pgvector)
- Chat (MVP UI present): end‑to‑end chat is currently non‑functional and deferred

See docs/project_status.md for the latest status, scope and next steps.

## Tech Stack
- Frontend: React 18, Vite, TypeScript, React Router, shadcn/ui, Tailwind CSS
- Backend: Supabase Postgres (+ RLS), Storage, Edge Functions, Realtime, pgvector
- Testing: Vitest, @testing-library/react (happy‑dom)

## Local Development
Prerequisites:
- Node.js 18+ (nvm recommended) and npm or bun
- Supabase CLI if running local stack (optional): https://supabase.com/docs/guides/cli

Install deps:
```sh
# with npm
npm install
# or with bun
bun install
```

Environment:
Create a `.env` file (and/or `.env.local`) with at least:
```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
# Edge Functions / server context
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...   # required for real embeddings in ingestion
```

Run the app:
```sh
npm run dev    # or: bun run dev
```
- Dev server runs on http://localhost:8080 (see vite.config.ts)

Supabase (optional, local):
```sh
# start local supabase services
supabase start
# serve edge functions locally (in another terminal)
supabase functions serve --no-verify-jwt
```

## Scripts
- `dev` – start Vite dev server
- `build` – production build
- `preview` – preview the built app
- `lint` – run eslint
- `test` – run all tests
- `test:ci` – run core tests (fast, stable)
- `test:components` – run heavier UI tests

## Current Limitations
- Chat features (Session Management, Prompt Assembly, full Chat UI) are not ready for use yet. Linear issues (KAR‑16/17/18) are in Backlog with notes.

## Repository Structure (high‑level)
- `/src` – application code (components, pages, integrations)
- `/supabase/functions` – Edge Functions (`process-document`, `query-agent`, ...)
- `/supabase/migrations` – database schema & routines (pgvector, triggers, etc.)
- `/docs` – product/tech docs, project_status
- `/tests` – unit/integration tests

## License
Proprietary – internal use for Tribeca Developers.
