-- ============================================================================
-- ProjectNova AI — Supabase PostgreSQL Schema & Row Level Security (RLS)
-- Version: 2026.10.1 (Phase 20 Post-Roadmap Integration)
-- ============================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROJECTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  objective TEXT NOT NULL,
  category TEXT NOT NULL,
  technologies TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  discovery_mode TEXT NOT NULL DEFAULT 'custom',
  target_deadline TIMESTAMPTZ,
  constraints TEXT,
  blueprint JSONB,
  milestones JSONB DEFAULT '[]'::jsonb,
  stage_states JSONB DEFAULT '[]'::jsonb,
  roadmap_milestones JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policies: users can select, insert, update, delete only their own projects
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = owner_id);


-- ----------------------------------------------------------------------------
-- 2. PROJECT BRAIN (MEMORIES) TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_memories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT 'user_created',
  status TEXT NOT NULL DEFAULT 'confirmed',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_project_id ON public.project_memories(project_id);
ALTER TABLE public.project_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage project memories" ON public.project_memories;
CREATE POLICY "Users can manage project memories"
  ON public.project_memories FOR ALL
  USING (auth.uid() = owner_id);


-- ----------------------------------------------------------------------------
-- 3. WORKFLOWS & WORKFLOW RUNS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON public.workflows(project_id);
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage workflows" ON public.workflows;
CREATE POLICY "Users can manage workflows"
  ON public.workflows FOR ALL
  USING (auth.uid() = owner_id);


-- ----------------------------------------------------------------------------
-- 4. MULTI-AGENT TEAM RUNS & TASKS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'coordinating',
  lead_role TEXT NOT NULL,
  participating_roles TEXT[] DEFAULT '{}',
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  synthesis JSONB,
  active_round INTEGER NOT NULL DEFAULT 1,
  max_rounds INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_runs_project_id ON public.team_runs(project_id);
ALTER TABLE public.team_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage team runs" ON public.team_runs;
CREATE POLICY "Users can manage team runs"
  ON public.team_runs FOR ALL
  USING (auth.uid() = owner_id);


-- ----------------------------------------------------------------------------
-- 5. DEPLOYMENT GOVERNANCE & APPROVALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deployment_approvals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  configuration_id TEXT NOT NULL,
  target_environment TEXT NOT NULL,
  bound_source_revision TEXT NOT NULL,
  bound_preflight_report_id TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approval_token TEXT NOT NULL UNIQUE,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_deploy_approvals_project ON public.deployment_approvals(project_id);
ALTER TABLE public.deployment_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage deployment approvals" ON public.deployment_approvals;
CREATE POLICY "Users can manage deployment approvals"
  ON public.deployment_approvals FOR ALL
  USING (auth.uid() = owner_id);
