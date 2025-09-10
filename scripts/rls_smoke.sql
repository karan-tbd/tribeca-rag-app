-- RLS smoke checks for two users (U1, U2)
-- Replace with real auth.users.id values
-- Example: 00000000-0000-0000-0000-000000000001
\echo '--- RLS Smoke: U1 ---'
set local role anon;
select set_config('request.jwt.claims', '{"sub":"<U1-UUID>"}', true);

-- Agents
select count(*) as u1_agents_count from public.agents;
select id, user_id, name from public.agents order by created_at desc limit 5;

-- Documents
select count(*) as u1_docs_count from public.documents;
select id, user_id, title from public.documents order by created_at desc limit 5;

-- Sessions
select count(*) as u1_sessions_count from public.sessions;
select id, user_id, title from public.sessions order by created_at desc limit 5;

-- Messages
select count(*) as u1_messages_count from public.messages;
select id, session_id, role from public.messages order by created_at desc limit 5;

-- Queries/Answers/Evals
select count(*) as u1_queries from public.queries;
select count(*) as u1_answers from public.answers;
select count(*) as u1_evals from public.evals;

-- Answer citations
select count(*) as u1_answer_citations from public.answer_citations;

-- Linear
select count(*) as u1_linear_projects from public.linear_projects;
select count(*) as u1_linear_issues from public.linear_issues;
select count(*) as u1_linear_sprints from public.linear_sprints;

\echo '--- RLS Smoke: U2 ---'
set local role anon;
select set_config('request.jwt.claims', '{"sub":"<U2-UUID>"}', true);

-- Agents
select count(*) as u2_agents_count from public.agents;

-- Documents
select count(*) as u2_docs_count from public.documents;

-- Sessions
select count(*) as u2_sessions_count from public.sessions;

-- Messages
select count(*) as u2_messages_count from public.messages;

-- Queries/Answers/Evals
select count(*) as u2_queries from public.queries;
select count(*) as u2_answers from public.answers;
select count(*) as u2_evals from public.evals;

-- Answer citations
select count(*) as u2_answer_citations from public.answer_citations;

-- Linear
select count(*) as u2_linear_projects from public.linear_projects;
select count(*) as u2_linear_issues from public.linear_issues;
select count(*) as u2_linear_sprints from public.linear_sprints;

\echo '--- Negative test: U2 attempts to update U1 rows (should affect 0 rows) ---'
-- Replace the WHERE clauses with concrete IDs from U1 if needed
set local role anon;
select set_config('request.jwt.claims', '{"sub":"<U2-UUID>"}', true);

update public.agents set name = 'x' where user_id = '<U1-UUID>';
update public.documents set title = 'x' where user_id = '<U1-UUID>';
-- For joined tables, target a known U1 resource id if available (should still be 0 rows):
update public.messages set role = 'user' where session_id in (select id from public.sessions where user_id = '<U1-UUID>');
update public.answers set text = 'x' where query_id in (select id from public.queries where user_id = '<U1-UUID>');
update public.evals set heuristic_max_sim = 0 where query_id in (select id from public.queries where user_id = '<U1-UUID>');
update public.answer_citations set sim_score = 0 where answer_id in (
  select a.id from public.answers a join public.queries q on a.query_id = q.id where q.user_id = '<U1-UUID>'
);

-- All above should report 0 rows updated if RLS is correctly enforced.

