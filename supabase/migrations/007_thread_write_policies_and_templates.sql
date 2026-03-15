-- ============================================================
-- Migration 007 — Thread write policies (anon) + template updates
-- ============================================================

-- ── 1. Anon write policies ───────────────────────────────────
-- Dev uses the anon key, so we need INSERT/UPDATE/DELETE policies
-- for the anon role on threads and thread_steps.
-- (In production, the authenticated policies from migration 005
--  are the authoritative ones; anon policies are only exercised
--  when there is no valid JWT — i.e. in the local dev bypass.)

DROP POLICY IF EXISTS "threads_anon_insert"         ON threads;
DROP POLICY IF EXISTS "threads_anon_update"         ON threads;
DROP POLICY IF EXISTS "thread_steps_anon_insert"    ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_anon_update"    ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_anon_delete"    ON thread_steps;

CREATE POLICY "threads_anon_insert" ON threads
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "threads_anon_update" ON threads
  FOR UPDATE TO anon USING (true);

CREATE POLICY "thread_steps_anon_insert" ON thread_steps
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "thread_steps_anon_update" ON thread_steps
  FOR UPDATE TO anon USING (true);

CREATE POLICY "thread_steps_anon_delete" ON thread_steps
  FOR DELETE TO anon USING (true);


-- ── 2. Update / seed requested templates ─────────────────────

-- Update Investment Process to use the exact requested step names
UPDATE thread_templates
SET steps = '[
  {"title": "Initial screening", "description": "Review deck and financials for fit with thesis"},
  {"title": "First meeting",     "description": "First call or in-person with founding team"},
  {"title": "IC memo",           "description": "Draft investment committee memorandum"},
  {"title": "Due diligence",     "description": "Assign and complete all DD workstreams"},
  {"title": "Term sheet",        "description": "Issue and negotiate term sheet"},
  {"title": "Legal closing",     "description": "SPA, cap-table update, wire transfer"}
]'::jsonb
WHERE name = 'Investment Process';

-- Update LP Reporting to use the exact requested step names
UPDATE thread_templates
SET steps = '[
  {"title": "Data collection",  "description": "Gather valuations, KPIs and financials from portfolio companies"},
  {"title": "Draft",            "description": "Write the quarterly narrative and populate financials"},
  {"title": "Internal review",  "description": "Partner sign-off round"},
  {"title": "Send",             "description": "Distribute via fund admin portal"}
]'::jsonb
WHERE name = 'LP Reporting';

-- Add Portfolio Review (insert only if not already present)
INSERT INTO thread_templates (name, category, steps)
SELECT
  'Portfolio Review',
  'Portfolio Monitoring',
  '[
    {"title": "KPI collection",   "description": "Collect monthly / quarterly KPIs from each portfolio company"},
    {"title": "Financial update", "description": "Update fund model with latest financials"},
    {"title": "Board deck",       "description": "Prepare portfolio review slide deck"},
    {"title": "Review call",      "description": "Internal or LP-facing portfolio review call"}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM thread_templates WHERE name = 'Portfolio Review'
);
