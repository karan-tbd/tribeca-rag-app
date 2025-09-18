# Test Suite Overview and Runbook

This document summarizes what each test file covers, how to run them, what constitutes success/failure, and notable edge cases.

## How to run tests

- One-off CI run (recommended for local checks)
  - `npm run test:ci` (runs `vitest run` once and exits)
- Watch mode (interactive; does not exit)
  - `npm run test` (runs `vitest` in watch mode)
- Run with timeout summary and artifact
  - `npm run test:timeout`
  - Prints a timeout summary and writes `.vitest-timeouts.json`
- Re-run only timed‑out tests
  - `npm run test:replay-timeouts`
- Single-file runs (useful for isolation)
  - `npx vitest run tests/<file> --reporter=basic`
  - Add `--reporter=verbose` and optionally `--detectOpenHandles` when diagnosing hangs

## Global test setup & mocks

- `tests/setup.ts` is loaded for all tests (configured in `vite.config.ts`):
  - Extends Jest DOM matchers
  - Mocks `@/hooks/use-toast` globally to prevent long-lived timers in tests
- Many tests mock `@/integrations/supabase/client` to avoid real network/auth timers

---

## File-by-file coverage

### 1) tests/smoke.test.ts
- Purpose: Verify the test runner and environment are working (sanity check)
- What it tests: A trivial assertion `1 + 1 === 2`
- How to run: `npx vitest run tests/smoke.test.ts --reporter=basic`
- Success: Test passes quickly; exit code 0
- Failure: Any assertion failure indicates environment issues or misconfiguration
- Edge cases: None

### 2) tests/guard.test.tsx
- Purpose: ProtectedRoute redirects unauthenticated users to `/login`
- What it tests:
  - With `useAuth` mocked to `{ user: null }`, visiting a protected route yields the `/login` element
- How to run: `npx vitest run tests/guard.test.tsx --reporter=basic`
- Success: `screen.findByTestId("login")` is found
- Failure: Login element not found → Guard or routing behavior changed
- Edge cases:
  - React Router v7 future flag warnings are expected and harmless in output
  - If `useAuth` mocking changes, test may need updates

### 3) tests/agents.test.tsx
- Purpose: Agents page renders the user’s agents list
- What it tests:
  - Supabase `.from('agents').select().order()` chain is mocked to return two agents
  - The sidebar renders "Your Agents" and both agent names
  - `AgentConfigForm` is stubbed out so list rendering is isolated
- How to run: `npx vitest run tests/agents.test.tsx --reporter=basic`
- Success: Finds "Your agents", "Agent A", and "Agent B"
- Failure: Elements not found → UI copy changed, query mocking broken, or component structure changed
- Edge cases:
  - Date formatting of `updated_at` is not asserted; keeps test robust across locales
  - If `AgentConfigForm` behavior affects layout, re-check the stub

### 4) tests/agents_rls.test.tsx
- Purpose: Agents page behavior when list retrieval is denied by RLS
- What it tests:
  - Supabase list call returns `{ data: null, error: { message: 'permission denied...' } }`
  - UI shows an empty state ("No agents yet") and a toast is triggered
- How to run: `npx vitest run tests/agents_rls.test.tsx --reporter=basic`
- Success: Finds empty-state text and verifies toast was called
- Failure: No empty state or toast → error handling/regression in Agents page
- Edge cases:
  - Toast is now mocked globally; per-file toast mocks remain compatible
  - Ensure the mock targets the correct table (`agents`) and chain

### 5) tests/agent_config_form.test.tsx
- Purpose: AgentConfigForm create/edit flows and validation
- What it tests:
  - Save new agent successfully → `toast.success` called
  - Validation error on short name → error message rendered and no success toast
  - RLS/permission error on save → `toast.error` called
  - Edit flow loads an existing agent (via `select().eq().eq().maybeSingle()`) and updates it
- How to run: `npx vitest run tests/agent_config_form.test.tsx --reporter=basic`
- Success:
  - Success case: success toast is called
  - Validation case: Zod message appears (e.g., "at least 2 characters")
  - Error case: error toast is called
  - Edit case: interaction completes without throwing
- Failure: Any assertion missing → form schema/fields changed, mock chain broken, or UI text updated
- Edge cases:
  - The test uses `vi.hoisted` for mocks to satisfy Vitest hoisting rules
  - Placeholder text ("My Agent") must match component placeholder; update test if copy changes
  - Supabase chains (upsert/select/maybeSingle) must match component code

---

## Utilities

### tests/utils/timeout-reporter.ts
- Custom reporter that prints a summary of tests that exceeded the global timeout (10s) and writes `.vitest-timeouts.json`
- Use via `npm run test:timeout`

### tests/utils/withStepTimeout.ts
- Helper to wrap awaited steps with a per-step timeout
- Usage example:
  ```ts
  const resultOrErr = await withStepTimeout(user.click(btn), 10_000).catch(e => e);
  if (isStepTimeout(resultOrErr)) {
    // step skipped due to timeout; continue the test
  }
  ```

---

## Interpreting results

- Success criteria: All test files pass; Vitest exits with code 0; no timeouts reported (or timeouts explicitly acknowledged)
- Failure criteria: Any test marked as failed; or the run does not exit promptly due to open handles
- Diagnosing hangs/open handles:
  - Re-run with `--detectOpenHandles` to enumerate live timers/handles
  - Ensure `@/integrations/supabase/client` is mocked in tests that import components using it
  - The global toast mock in `tests/setup.ts` prevents long-lived `setTimeout` handles from `use-toast`

## Troubleshooting tips

- If a UI text change breaks a selector, prefer stable `data-testid` or update the test to the new copy
- When adding new tests that render components touching network/auth/storage, mock those integrations
- For sporadic slow steps, wrap them with `withStepTimeout` to fail fast without hanging the suite

