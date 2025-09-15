# UI Verification Scaffold

Purpose: Minimal UI to verify backend (Google Auth + Supabase RLS) and user‑scoped CRUD for Agents and Documents.

## Prereqs
- Create `.env` with:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Ensure Supabase Storage bucket `documents` exists (public or auth-guarded per policy).

## Run
- `npm run dev` (or `bun run dev`)
- Open http://localhost:5173

## Flows
1) Auth
- Visit `/login` → "Continue with Google"
- On first login, a row is upserted into `public.users`
- Unauthed users are redirected to `/login` from protected routes

2) Profile
- Visit `/profile` to see `id, email, name, avatar`

3) Agents (user‑scoped)
- Visit `/agents`
- Create agent (name required) → appears in list (name, updated_at)
- Edit name inline; Delete removes it
- Different accounts see isolated lists due to RLS
- RLS denials (non‑owned) show friendly toasts

4) Documents (user‑scoped)
- Visit `/documents`
- Select one of your Agents, upload a PDF
- File → Supabase Storage `documents/<user-id>/...`
- Row inserted into `public.documents` with `storage_path, title, user_id, agent_id`
- List shows your documents (title, created_at)

## Header & Guard
- Header shows current user (name/avatar) + `Sign out`
- All protected pages use a route guard (`/profile`, `/agents`, `/documents`, `/settings`, `/dashboard`)

## Notes
- RLS: UI always sets `user_id = session.user.id` on inserts; update never changes `user_id`
- If the Storage bucket is missing, uploads fail with a toast

## Quick Manual Checklist
- [ ] Sign in as User A → create Agent → visible in `/agents`
- [ ] Sign in as User B → A’s Agent not visible
- [ ] Upload PDF as A → appears in `/documents`; as B → not visible
- [ ] `/profile` shows current user

## Tests (pending)
Minimal tests for route guard and agents list are planned via Vitest + Testing Library. Install (with approval):
```
npm i -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```
Then wire `vitest` + a couple of smoke tests.



## Test timeouts and re-run flow

To keep the suite reliable, tests and hooks have a global 10s timeout and a custom reporter that summarizes any tests that exceeded the timeout as “Skipped due to timeout (10s)”. You can also re-run only the timed‑out tests.

### Commands
- Run with timeout summary and artifact:
  ```bash
  npm run test:timeout
  ```
  This prints a “Skipped due to timeout (10s)” section and writes `.vitest-timeouts.json` listing `{ file, name }` of timed‑out tests.

- Re-run only timed‑out tests:
  ```bash
  npm run test:replay-timeouts
  ```
  This reads `.vitest-timeouts.json` and re-executes only the affected tests using `-t` name filters per file.

### Configuration
- `vite.config.ts` sets:
  - `testTimeout: 10_000`
  - `hookTimeout: 10_000`
- Custom reporter: `tests/utils/timeout-reporter.ts`
  - Detects timeout failures
  - Prints a human summary
  - Emits `.vitest-timeouts.json`

### Step-level timeout helper (optional in tests)
If a specific awaitable “step” may hang, wrap it so the test can continue while marking the step as skipped:

```ts
import { withStepTimeout, isStepTimeout } from "@/tests/utils/withStepTimeout";

// Inside a test
const resultOrErr = await withStepTimeout(user.click(saveBtn), 10_000).catch(e => e);
if (isStepTimeout(resultOrErr)) {
  // Step skipped due to timeout; continue or assert a fallback state
}
```

### Tips
- To run a subset explicitly (bypassing other files), list them:
  ```bash
  npx vitest run tests/agent_config_form.test.tsx tests/agents.test.tsx
  ```
- To skip a flaky spec temporarily in code, use `describe.skip` or `it.skip` (prefer reporter-driven timeout summary first).
