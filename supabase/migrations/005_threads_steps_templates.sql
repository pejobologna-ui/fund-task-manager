-- ============================================================
-- Migration 005 — Threads (expanded) + thread_steps + thread_templates
-- ============================================================
-- NOTE: tasks.thread_id (uuid FK → threads) already exists from
-- migration 001, so no tasks column change is needed.
-- ============================================================

-- ── 1. Expand the threads table ──────────────────────────────
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS category    text,
  ADD COLUMN IF NOT EXISTS company_id  uuid REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS visibility  text NOT NULL DEFAULT 'team'
                                         CHECK (visibility IN ('team', 'personal')),
  ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- Backfill updated_at for existing rows
UPDATE threads SET updated_at = created_at WHERE updated_at IS NULL;

-- Auto-update updated_at on threads
CREATE OR REPLACE TRIGGER threads_updated_at
  BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS threads_company_id_idx ON threads(company_id);
CREATE INDEX IF NOT EXISTS threads_created_by_idx ON threads(created_by);


-- ── 2. thread_steps ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thread_steps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  "order"     integer     NOT NULL DEFAULT 0,
  status      text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_progress', 'completed')),
  assigned_to uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  due_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER thread_steps_updated_at
  BEFORE UPDATE ON thread_steps
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS thread_steps_thread_id_idx ON thread_steps(thread_id);
-- enforce ordered retrieval
CREATE INDEX IF NOT EXISTS thread_steps_order_idx     ON thread_steps(thread_id, "order");


-- ── 3. thread_templates ──────────────────────────────────────
-- steps: jsonb array of {title: text, description: text}
CREATE TABLE IF NOT EXISTS thread_templates (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL,
  category text,
  steps    jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- Seed with common VC workflow templates
INSERT INTO thread_templates (name, category, steps) VALUES
(
  'Investment Process',
  'Investment Process',
  '[
    {"title": "Initial screening",      "description": "Review deck and financials for fit with thesis"},
    {"title": "Partner intro meeting",  "description": "First call with founding team"},
    {"title": "Due diligence kick-off", "description": "Assign DD workstreams to team"},
    {"title": "IC memo",                "description": "Draft investment committee memorandum"},
    {"title": "Term sheet",             "description": "Issue and negotiate term sheet"},
    {"title": "Legal close",            "description": "SPA, cap-table update, wire transfer"}
  ]'::jsonb
),
(
  'Board Meeting Prep',
  'Board Approval',
  '[
    {"title": "Collect board materials",  "description": "Gather financials, KPIs, and updates from portfolio company"},
    {"title": "Internal pre-read",        "description": "Circulate materials to all partners"},
    {"title": "Draft resolutions",        "description": "Prepare any formal resolutions needed"},
    {"title": "Board meeting",            "description": "Attend and take minutes"},
    {"title": "Follow-up actions",        "description": "Distribute minutes and track action items"}
  ]'::jsonb
),
(
  'LP Reporting',
  'LP Reporting',
  '[
    {"title": "Collect portfolio data",   "description": "Valuations, revenue, headcount from portfolio companies"},
    {"title": "Draft quarterly report",   "description": "Write narrative and populate financials"},
    {"title": "Partner review",           "description": "Internal sign-off round"},
    {"title": "Legal & compliance check", "description": "Confirm disclosures and regulatory requirements"},
    {"title": "Distribute to LPs",        "description": "Send via fund admin portal"}
  ]'::jsonb
),
(
  'New Portfolio Company Onboarding',
  'Portfolio Monitoring',
  '[
    {"title": "Cap table setup",          "description": "Record investment in fund model and cap table tool"},
    {"title": "Data room access",         "description": "Ensure fund team has access to company data room"},
    {"title": "Introduce portfolio services", "description": "Connect company to fund's talent / legal / finance network"},
    {"title": "Reporting cadence agreed", "description": "Set monthly / quarterly KPI reporting expectations"},
    {"title": "First board seat",         "description": "Confirm board observer or director rights"}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;


-- ── 4. RLS ───────────────────────────────────────────────────

-- threads ---------------------------------------------------
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_select"  ON threads;
DROP POLICY IF EXISTS "threads_insert"  ON threads;
DROP POLICY IF EXISTS "threads_update"  ON threads;
DROP POLICY IF EXISTS "threads_delete"  ON threads;

-- Team threads: all authenticated users see them.
-- Personal threads: only the creator.
-- Legacy rows (created_by IS NULL) were created before auth existed → treat as team.
CREATE POLICY "threads_select" ON threads
  FOR SELECT TO authenticated
  USING (
    visibility = 'team'
    OR created_by = auth.uid()
  );

CREATE POLICY "threads_insert" ON threads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "threads_update" ON threads
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "threads_delete" ON threads
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- thread_steps ----------------------------------------------
ALTER TABLE thread_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread_steps_select" ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_insert" ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_update" ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_delete" ON thread_steps;

-- Steps inherit their thread's visibility via the parent thread's RLS.
-- Any authenticated user with access to the thread can manage its steps.
CREATE POLICY "thread_steps_select" ON thread_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = thread_id
        AND (t.visibility = 'team' OR t.created_by = auth.uid())
    )
  );

CREATE POLICY "thread_steps_insert" ON thread_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = thread_id
        AND (t.visibility = 'team' OR t.created_by = auth.uid())
    )
  );

CREATE POLICY "thread_steps_update" ON thread_steps
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = thread_id
        AND (t.visibility = 'team' OR t.created_by = auth.uid())
    )
  );

CREATE POLICY "thread_steps_delete" ON thread_steps
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = thread_id
        AND (t.visibility = 'team' OR t.created_by = auth.uid())
    )
  );


-- thread_templates ------------------------------------------
ALTER TABLE thread_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread_templates_select" ON thread_templates;
DROP POLICY IF EXISTS "thread_templates_insert" ON thread_templates;
DROP POLICY IF EXISTS "thread_templates_update" ON thread_templates;
DROP POLICY IF EXISTS "thread_templates_delete" ON thread_templates;

-- Templates are always team-level (no personal concept here).
CREATE POLICY "thread_templates_select" ON thread_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "thread_templates_insert" ON thread_templates
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "thread_templates_update" ON thread_templates
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "thread_templates_delete" ON thread_templates
  FOR DELETE TO authenticated USING (true);
