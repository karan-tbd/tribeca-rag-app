-- Enable RLS on auth.users if not already enabled
-- Create users table with profiles
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  linear_api_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON public.users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
FOR INSERT WITH CHECK (auth.uid() = id);

-- Agents table
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT DEFAULT 'You are a question-answering assistant. Answer strictly based on provided context excerpts. If insufficient evidence, say: "I don''t have enough evidence in the documents to answer confidently." Always cite sources with filename and page.',
  query_template TEXT,
  embed_model TEXT DEFAULT 'text-embedding-3-small',
  gen_model TEXT DEFAULT 'gpt-4o-mini',
  k INTEGER DEFAULT 5,
  sim_threshold FLOAT DEFAULT 0.75,
  fail_safe_threshold FLOAT DEFAULT 0.5,
  config_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agents" ON public.agents
FOR ALL USING (user_id = auth.uid());

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime TEXT DEFAULT 'application/pdf',
  latest_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents" ON public.documents
FOR ALL USING (user_id = auth.uid());

-- Document versions table
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, version_no)
);

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document versions" ON public.document_versions
FOR ALL USING (
  document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
);

-- Chunks table (metadata only)
CREATE TABLE public.chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chunks" ON public.chunks
FOR ALL USING (
  document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
);

-- Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions" ON public.sessions
FOR ALL USING (user_id = auth.uid());

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  token_in INTEGER,
  token_out INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages
FOR ALL USING (
  session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid())
);

-- Session summaries table
CREATE TABLE public.session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  summary_text TEXT,
  is_termination_summary BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session summaries" ON public.session_summaries
FOR ALL USING (
  session_id IN (SELECT id FROM public.sessions WHERE user_id = auth.uid())
);

-- Queries table
CREATE TABLE public.queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_query TEXT NOT NULL,
  latency_ms INTEGER,
  token_in INTEGER,
  token_out INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queries" ON public.queries
FOR ALL USING (user_id = auth.uid());

-- Answers table
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES public.queries(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  confidence FLOAT,
  showed_confidence BOOLEAN DEFAULT false,
  fail_safe_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own answers" ON public.answers
FOR ALL USING (
  query_id IN (SELECT id FROM public.queries WHERE user_id = auth.uid())
);

-- Evals table
CREATE TABLE public.evals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES public.queries(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  heuristic_max_sim FLOAT,
  heuristic_mean_sim FLOAT,
  pct_above_thresh FLOAT,
  llm_faithfulness FLOAT,
  aggregate_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.evals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evals" ON public.evals
FOR ALL USING (
  query_id IN (SELECT id FROM public.queries WHERE user_id = auth.uid())
);

-- Answer citations table
CREATE TABLE public.answer_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  sim_score FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.answer_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own answer citations" ON public.answer_citations
FOR ALL USING (
  answer_id IN (
    SELECT a.id FROM public.answers a
    JOIN public.queries q ON a.query_id = q.id
    WHERE q.user_id = auth.uid()
  )
);

-- Linear integration tables
CREATE TABLE public.linear_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  linear_project_id TEXT UNIQUE NOT NULL,
  name TEXT,
  key TEXT,
  description TEXT,
  start_date TIMESTAMPTZ,
  target_date TIMESTAMPTZ,
  status TEXT,
  progress FLOAT DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.linear_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own linear projects" ON public.linear_projects
FOR ALL USING (user_id = auth.uid());

-- Linear issues table
CREATE TABLE public.linear_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.linear_projects(id) ON DELETE CASCADE,
  linear_issue_id TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  status TEXT,
  priority INTEGER,
  estimate FLOAT,
  assignee_id TEXT,
  epic_id TEXT,
  labels TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.linear_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own linear issues" ON public.linear_issues
FOR ALL USING (
  project_id IN (SELECT id FROM public.linear_projects WHERE user_id = auth.uid())
);

-- Linear sprints table
CREATE TABLE public.linear_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.linear_projects(id) ON DELETE CASCADE,
  linear_sprint_id TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT,
  goal TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.linear_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own linear sprints" ON public.linear_sprints
FOR ALL USING (
  project_id IN (SELECT id FROM public.linear_projects WHERE user_id = auth.uid())
);

-- Linear webhooks table
CREATE TABLE public.linear_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT,
  event_type TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.linear_webhooks ENABLE ROW LEVEL SECURITY;

-- Admin only access to webhooks
CREATE POLICY "Only admins can manage webhooks" ON public.linear_webhooks
FOR ALL USING (false); -- Will be updated later for admin users

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();