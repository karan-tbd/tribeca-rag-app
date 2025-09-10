# Row-Level Security (RLS)  Verification Guide

Purpose
- Ensure all user-scoped tables enforce isolation: a signed-in user can CRUD only their own rows.
- Provide a quick, repeatable way to verify policies using simulated JWT claims in Supabase SQL Editor.

Scope (user-scoped tables)
- users (self only)
- agents, documents, document_versions, chunks
- sessions, messages, session_summaries
- queries, answers, evals, answer_citations
- linear_projects, linear_issues, linear_sprints
- linear_webhooks: locked down (service/admin only)

Key policy pattern
- Each table has RLS enabled and policies equivalent to:
  - SELECT/DELETE visibility via USING
  - INSERT/UPDATE guarded via WITH CHECK mirroring the USING predicate
- Example
```sql
ALTER POLICY "Users can manage own agents"
ON public.agents
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

How to verify (Supabase SQL Editor)
1) Prepare two real auth.users.id values (U1 and U2). You can find these under Authentication > Users.
2) For each user, simulate a JWT by setting the `request.jwt.claims` and run quick checks.

Positive test (U1)
```sql
set local role anon;
select set_config('request.jwt.claims', '{"sub":"<U1-UUID>"}', true);

-- Spot-check a few tables
select count(*) from public.agents;                          -- only U1 agents
select * from public.agents order by created_at desc limit 5; -- user_id == U1

select count(*) from public.documents;
select * from public.documents order by created_at desc limit 5;

select count(*) from public.sessions;
select * from public.sessions order by created_at desc limit 5;
```

Isolation test (U2)
```sql
set local role anon;
select set_config('request.jwt.claims', '{"sub":"<U2-UUID>"}', true);

select count(*) from public.agents;  -- different from U1
select count(*) from public.documents;
select count(*) from public.sessions;
```

Negative test (cross-user update should affect 0 rows)
```sql
-- With U2 simulated
update public.agents set name = 'x' where user_id = '<U1-UUID>'; -- 0 rows
```

Extended checks
- Apply the same pattern to: messages, queries, answers, evals, answer_citations, linear_* tables.
- For JOINed tables (e.g., answers, evals), ensure row visibility matches parent ownership via queries.user_id.

Notes
- linear_webhooks is intentionally locked down; use the service role key for ingestion (RLS bypassed by service role). 
- The `users` table allows self INSERT/UPDATE and SELECT of own row only.

Make it repeatable
- Use scripts/rls_smoke.sql for a simple two-user runbook you can paste into the SQL Editor.
- Keep screenshots or console outputs of differing counts for U1 vs U2 as evidence.

