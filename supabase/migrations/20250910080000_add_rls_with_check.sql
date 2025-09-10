-- RLS hardening: add WITH CHECK to existing policies so INSERT/UPDATE cannot cross user boundaries
-- Up: add WITH CHECK mirroring USING predicates
-- Down: revert WITH CHECK to TRUE (pre-change behavior)

-- Agents
ALTER POLICY "Users can manage own agents"
ON public.agents
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Documents
ALTER POLICY "Users can manage own documents"
ON public.documents
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Document versions (scope via parent documents)
ALTER POLICY "Users can view own document versions"
ON public.document_versions
USING (
  document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
)
WITH CHECK (
  document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
);

-- Chunks (scope via parent documents)
ALTER POLICY "Users can view own chunks"
ON public.chunks
USING (
  document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
)
WITH CHECK (
  document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
);

-- Sessions
ALTER POLICY "Users can manage own sessions"
ON public.sessions
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Messages (scope via parent session)
ALTER POLICY "Users can view own messages"
ON public.messages
USING (
  session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid())
)
WITH CHECK (
  session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid())
);

-- Session summaries (scope via parent session)
ALTER POLICY "Users can view own session summaries"
ON public.session_summaries
USING (
  session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid())
)
WITH CHECK (
  session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid())
);

-- Queries
ALTER POLICY "Users can view own queries"
ON public.queries
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Answers (scope via parent query)
ALTER POLICY "Users can view own answers"
ON public.answers
USING (
  query_id IN (SELECT id FROM public.queries WHERE user_id = auth.uid())
)
WITH CHECK (
  query_id IN (SELECT id FROM public.queries WHERE user_id = auth.uid())
);

-- Evals (scope via parent query)
ALTER POLICY "Users can view own evals"
ON public.evals
USING (
  query_id IN (SELECT id FROM public.queries WHERE user_id = auth.uid())
)
WITH CHECK (
  query_id IN (SELECT id FROM public.queries WHERE user_id = auth.uid())
);

-- Answer citations (scope via answers -> queries -> user)
ALTER POLICY "Users can view own answer citations"
ON public.answer_citations
USING (
  answer_id IN (
    SELECT a.id FROM public.answers a
    JOIN public.queries q ON a.query_id = q.id
    WHERE q.user_id = auth.uid()
  )
)
WITH CHECK (
  answer_id IN (
    SELECT a.id FROM public.answers a
    JOIN public.queries q ON a.query_id = q.id
    WHERE q.user_id = auth.uid()
  )
);

-- Linear projects
ALTER POLICY "Users can manage own linear projects"
ON public.linear_projects
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Linear issues (scope via parent project)
ALTER POLICY "Users can view own linear issues"
ON public.linear_issues
USING (
  project_id IN (SELECT id FROM public.linear_projects WHERE user_id = auth.uid())
)
WITH CHECK (
  project_id IN (SELECT id FROM public.linear_projects WHERE user_id = auth.uid())
);

-- Linear sprints (scope via parent project)
ALTER POLICY "Users can view own linear sprints"
ON public.linear_sprints
USING (
  project_id IN (SELECT id FROM public.linear_projects WHERE user_id = auth.uid())
)
WITH CHECK (
  project_id IN (SELECT id FROM public.linear_projects WHERE user_id = auth.uid())
);

-- NOTE: linear_webhooks remains admin/service-role only; no WITH CHECK added

-- =====================
-- Down migration
-- =====================

-- Agents
ALTER POLICY "Users can manage own agents"
ON public.agents
USING (user_id = auth.uid())
WITH CHECK (true);

-- Documents
ALTER POLICY "Users can manage own documents"
ON public.documents
USING (user_id = auth.uid())
WITH CHECK (true);

-- Document versions
ALTER POLICY "Users can view own document versions"
ON public.document_versions
USING (
  document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
)
WITH CHECK (true);

-- Chunks
ALTER POLICY "Users can view own chunks"
ON public.chunks
USING (
  document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
)
WITH CHECK (true);

-- Sessions
ALTER POLICY "Users can manage own sessions"
ON public.sessions
USING (user_id = auth.uid())
WITH CHECK (true);

-- Messages
ALTER POLICY "Users can view own messages"
ON public.messages
USING (
  session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid())
)
WITH CHECK (true);

-- Session summaries
ALTER POLICY "Users can view own session summaries"
ON public.session_summaries
USING (
  session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid())
)
WITH CHECK (true);

-- Queries
ALTER POLICY "Users can view own queries"
ON public.queries
USING (user_id = auth.uid())
WITH CHECK (true);

-- Answers
ALTER POLICY "Users can view own answers"
ON public.answers
USING (
  query_id IN (SELECT id FROM public.queries WHERE user_id = auth.uid())
)
WITH CHECK (true);

-- Evals
ALTER POLICY "Users can view own evals"
ON public.evals
USING (
  query_id IN (SELECT id FROM public.queries WHERE user_id = auth.uid())
)
WITH CHECK (true);

-- Answer citations
ALTER POLICY "Users can view own answer citations"
ON public.answer_citations
USING (
  answer_id IN (
    SELECT a.id FROM public.answers a
    JOIN public.queries q ON a.query_id = q.id
    WHERE q.user_id = auth.uid()
  )
)
WITH CHECK (true);

-- Linear projects
ALTER POLICY "Users can manage own linear projects"
ON public.linear_projects
USING (user_id = auth.uid())
WITH CHECK (true);

-- Linear issues
ALTER POLICY "Users can view own linear issues"
ON public.linear_issues
USING (
  project_id IN (SELECT id FROM public.linear_projects WHERE user_id = auth.uid())
)
WITH CHECK (true);

-- Linear sprints
ALTER POLICY "Users can view own linear sprints"
ON public.linear_sprints
USING (
  project_id IN (SELECT id FROM public.linear_projects WHERE user_id = auth.uid())
)
WITH CHECK (true);

