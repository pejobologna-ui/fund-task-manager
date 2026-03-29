-- Migration 012: Core data model redesign
-- Tasks become the fundamental unit; thread_steps are migrated into tasks.
-- Companies absorb the funds table (self-referential fund_id).
-- Categories gain macro_category; threads lose category/visibility.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. activity_categories: add macro_category, drop visibility/created_by
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE activity_categories
  ADD COLUMN IF NOT EXISTS macro_category text;

-- Drop category_shares first — its policies reference activity_categories.created_by
DROP TABLE IF EXISTS category_shares CASCADE;

-- Drop any existing RLS policies that reference visibility/created_by BEFORE
-- dropping those columns (otherwise Postgres refuses with a dependency error).
DROP POLICY IF EXISTS "activity_categories_auth_select" ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_insert" ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_update" ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_delete" ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_select" ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_insert" ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_update" ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_delete" ON activity_categories;
DROP POLICY IF EXISTS "categories_select" ON activity_categories;
DROP POLICY IF EXISTS "categories_insert" ON activity_categories;
DROP POLICY IF EXISTS "categories_update" ON activity_categories;
DROP POLICY IF EXISTS "categories_delete" ON activity_categories;
DROP POLICY IF EXISTS "manage_categories" ON activity_categories;
DROP POLICY IF EXISTS "read_categories"   ON activity_categories;

ALTER TABLE activity_categories
  DROP COLUMN IF EXISTS visibility,
  DROP COLUMN IF EXISTS created_by;

-- Map existing rows to macro_categories
UPDATE activity_categories SET macro_category = 'Fund Operations'
  WHERE name IN ('Legal & Compliance', 'Administration', 'Legal') AND macro_category IS NULL;
UPDATE activity_categories SET macro_category = 'Investing'
  WHERE name IN ('Pipeline','Scouting','Due Diligence & Legal','Due Diligence',
                 'Valuation','Info Memo','Board Approval','Investment Process') AND macro_category IS NULL;
UPDATE activity_categories SET macro_category = 'Portfolio Management'
  WHERE name IN ('Portfolio Monitoring','Model Updates','Advisor Relations') AND macro_category IS NULL;
UPDATE activity_categories SET macro_category = 'Reporting'
  WHERE name IN ('LP Reporting','Reporting to LPs') AND macro_category IS NULL;
UPDATE activity_categories SET macro_category = 'Governance'
  WHERE name IN ('IC / Board Docs','Other','Governance') AND macro_category IS NULL;

-- Insert canonical categories that are missing
DO $$
DECLARE
  cats TEXT[][] := ARRAY[
    ARRAY['Legal & Compliance',    'Fund Operations'],
    ARRAY['Administration',        'Fund Operations'],
    ARRAY['Pipeline',              'Investing'],
    ARRAY['Scouting',              'Investing'],
    ARRAY['Due Diligence & Legal', 'Investing'],
    ARRAY['Valuation',             'Investing'],
    ARRAY['Info Memo',             'Investing'],
    ARRAY['Board Approval',        'Investing'],
    ARRAY['Portfolio Monitoring',  'Portfolio Management'],
    ARRAY['Model Updates',         'Portfolio Management'],
    ARRAY['Advisor Relations',     'Portfolio Management'],
    ARRAY['LP Reporting',          'Reporting'],
    ARRAY['Reporting to LPs',      'Reporting'],
    ARRAY['IC / Board Docs',       'Governance'],
    ARRAY['Other',                 'Governance']
  ];
  pair TEXT[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY cats LOOP
    IF NOT EXISTS (SELECT 1 FROM activity_categories WHERE name = pair[1]) THEN
      INSERT INTO activity_categories (name, macro_category) VALUES (pair[1], pair[2]);
    ELSE
      UPDATE activity_categories
        SET macro_category = pair[2]
        WHERE name = pair[1] AND macro_category IS NULL;
    END IF;
  END LOOP;
END $$;

-- RLS for categories
ALTER TABLE activity_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select" ON activity_categories;
DROP POLICY IF EXISTS "categories_insert" ON activity_categories;
DROP POLICY IF EXISTS "categories_update" ON activity_categories;
DROP POLICY IF EXISTS "categories_delete" ON activity_categories;
-- Also drop any old catch-all policies
DROP POLICY IF EXISTS "manage_categories" ON activity_categories;
DROP POLICY IF EXISTS "read_categories"   ON activity_categories;

CREATE POLICY "categories_select" ON activity_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_insert" ON activity_categories
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('gp','associate')
  ));
CREATE POLICY "categories_update" ON activity_categories
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('gp','associate')
  ));
CREATE POLICY "categories_delete" ON activity_categories
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('gp','associate')
  ));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. companies: self-referential fund_id, absorb funds table
-- ═══════════════════════════════════════════════════════════════════════════════

-- Widen the type CHECK constraint to include 'sgr' and 'fund' before any inserts
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_type_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_type_check
  CHECK (type IN ('portfolio', 'prospect', 'other', 'sgr', 'fund'));

-- Ensure SGR company exists
INSERT INTO companies (name, type)
SELECT 'General', 'sgr'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE type = 'sgr');

-- Create fund companies from the funds table (if funds table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'funds') THEN
    INSERT INTO companies (name, type)
    SELECT f.name, 'fund'
    FROM funds f
    WHERE NOT EXISTS (
      SELECT 1 FROM companies c WHERE c.name = f.name AND c.type = 'fund'
    );
  END IF;
END $$;

-- Drop old FK on companies.fund_id → funds
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_fund_id_fkey;

-- Migrate fund_id references: old funds.id → new fund company id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'funds') THEN
    UPDATE companies c
    SET fund_id = fc.id
    FROM funds f
    JOIN companies fc ON fc.name = f.name AND fc.type = 'fund'
    WHERE c.fund_id = f.id
      AND c.type IN ('portfolio', 'prospect');
  END IF;
END $$;

-- Add self-referential FK
ALTER TABLE companies
  ADD CONSTRAINT companies_fund_id_fkey
  FOREIGN KEY (fund_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Drop redundant text column
ALTER TABLE companies DROP COLUMN IF EXISTS fund;

-- Drop funds table (now subsumed into companies)
DROP TABLE IF EXISTS funds;

-- RLS for companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;
DROP POLICY IF EXISTS "companies_delete" ON companies;
DROP POLICY IF EXISTS "read_companies"   ON companies;
DROP POLICY IF EXISTS "manage_companies" ON companies;

CREATE POLICY "companies_select" ON companies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('gp','associate')
  ));
CREATE POLICY "companies_update" ON companies
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('gp','associate')
  ));
CREATE POLICY "companies_delete" ON companies
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('gp','associate')
  ));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. threads: add status + template_id, remove category + visibility
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS template_id uuid;

ALTER TABLE threads
  DROP CONSTRAINT IF EXISTS threads_status_check;
ALTER TABLE threads
  ADD CONSTRAINT threads_status_check
  CHECK (status IN ('active','completed','archived'));

-- FK to thread_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'threads' AND constraint_name = 'threads_template_id_fkey'
  ) THEN
    ALTER TABLE threads
      ADD CONSTRAINT threads_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES thread_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop thread_shares first — may reference threads.visibility
DROP TABLE IF EXISTS thread_shares CASCADE;

-- Drop all policies on threads that reference visibility/category
DROP POLICY IF EXISTS "threads_select"       ON threads;
DROP POLICY IF EXISTS "threads_insert"       ON threads;
DROP POLICY IF EXISTS "threads_update"       ON threads;
DROP POLICY IF EXISTS "threads_delete"       ON threads;
DROP POLICY IF EXISTS "threads_auth_select"  ON threads;
DROP POLICY IF EXISTS "threads_auth_insert"  ON threads;
DROP POLICY IF EXISTS "threads_auth_update"  ON threads;
DROP POLICY IF EXISTS "threads_auth_delete"  ON threads;
DROP POLICY IF EXISTS "threads_anon_select"  ON threads;
DROP POLICY IF EXISTS "threads_anon_insert"  ON threads;
DROP POLICY IF EXISTS "threads_anon_update"  ON threads;
DROP POLICY IF EXISTS "threads_anon_delete"  ON threads;

-- Drop all policies on thread_steps that reference threads.visibility
DROP POLICY IF EXISTS "thread_steps_select"  ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_insert"  ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_update"  ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_delete"  ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_anon_insert" ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_anon_update" ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_anon_delete" ON thread_steps;

ALTER TABLE threads
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS visibility;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. tasks: add order column, migrate assignee FK to profiles, migrate steps
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS "order" integer;

-- Drop old FK (assignee_id → users table)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;

-- Null all existing task assignee_ids (old user IDs are incompatible with profile IDs)
UPDATE tasks SET assignee_id = NULL;

-- Cast assignee_id from text to uuid (needed to match profiles.id type)
ALTER TABLE tasks ALTER COLUMN assignee_id TYPE uuid USING assignee_id::uuid;

-- Re-add FK pointing to profiles
ALTER TABLE tasks
  ADD CONSTRAINT tasks_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Migrate thread_steps → tasks
-- (thread_steps.assigned_to already points to profiles — compatible with new FK)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'thread_steps') THEN
    INSERT INTO tasks (
      title, description, thread_id, category_id, company_id,
      assignee_id, due_date, status, priority, visibility,
      "order", created_at, notes
    )
    SELECT
      ts.title,
      ts.description,
      ts.thread_id,
      NULL,
      t.company_id,
      ts.assigned_to,
      ts.due_date,
      CASE ts.status
        WHEN 'pending'     THEN 'Open'
        WHEN 'in_progress' THEN 'In Progress'
        WHEN 'completed'   THEN 'Done'
        ELSE 'Open'
      END,
      'Medium',
      'team',
      ts."order",
      ts.created_at,
      ''
    FROM thread_steps ts
    LEFT JOIN threads t ON t.id = ts.thread_id
    WHERE ts.thread_id IS NOT NULL;

    DROP TABLE thread_steps;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. thread_templates: add description, reseed with canonical templates
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE thread_templates
  ADD COLUMN IF NOT EXISTS description text;

TRUNCATE thread_templates CASCADE;

INSERT INTO thread_templates (name, category, description, steps) VALUES
(
  'Board Approval Process',
  'Governance',
  'Full board approval workflow from data gathering to BoD signature',
  '[
    {"order":0,"title":"Ask for data","description":"Request all relevant data from the company","default_category":"Board Approval"},
    {"order":1,"title":"Build model","description":"Build or update the financial model","default_category":"Valuation"},
    {"order":2,"title":"Map competitors","description":"Competitive landscape analysis","default_category":"Due Diligence & Legal"},
    {"order":3,"title":"Q&A","description":"Q&A session with company management","default_category":"Board Approval"},
    {"order":4,"title":"Info memo","description":"Draft the investment information memorandum","default_category":"Info Memo"},
    {"order":5,"title":"Share with compliance","description":"Send memo to compliance for review","default_category":"Legal & Compliance"},
    {"order":6,"title":"Receive approval","description":"Receive compliance and IC approval","default_category":"Board Approval"},
    {"order":7,"title":"Finalize deliberation","description":"Finalize board deliberation documents","default_category":"IC / Board Docs"},
    {"order":8,"title":"Sign BoD document","description":"Obtain final signatures on the BoD document","default_category":"IC / Board Docs"}
  ]'
),
(
  'Investment Process',
  'Investing',
  'End-to-end investment process from screening to legal closing',
  '[
    {"order":0,"title":"Initial screening","description":"Initial review of company materials and fit","default_category":"Pipeline"},
    {"order":1,"title":"First meeting","description":"First meeting with founders","default_category":"Pipeline"},
    {"order":2,"title":"IC memo","description":"Prepare IC memo for internal review","default_category":"IC / Board Docs"},
    {"order":3,"title":"Due diligence","description":"Full due diligence process","default_category":"Due Diligence & Legal"},
    {"order":4,"title":"Term sheet","description":"Draft and negotiate term sheet","default_category":"Due Diligence & Legal"},
    {"order":5,"title":"Legal closing","description":"Legal documentation and closing","default_category":"Legal & Compliance"}
  ]'
),
(
  'LP Reporting',
  'Reporting',
  'Quarterly LP reporting cycle',
  '[
    {"order":0,"title":"Data collection","description":"Collect data from portfolio companies","default_category":"LP Reporting"},
    {"order":1,"title":"Draft","description":"Draft the LP report","default_category":"LP Reporting"},
    {"order":2,"title":"Internal review","description":"Internal review and sign-off","default_category":"LP Reporting"},
    {"order":3,"title":"Send","description":"Send final report to LPs","default_category":"Reporting to LPs"}
  ]'
),
(
  'Portfolio Review',
  'Portfolio Management',
  'Periodic portfolio company review',
  '[
    {"order":0,"title":"KPI collection","description":"Collect KPIs from portfolio company","default_category":"Portfolio Monitoring"},
    {"order":1,"title":"Financial update","description":"Update financial model with latest data","default_category":"Model Updates"},
    {"order":2,"title":"Board deck","description":"Prepare board deck","default_category":"IC / Board Docs"},
    {"order":3,"title":"Review call","description":"Portfolio review call with company management","default_category":"Portfolio Monitoring"}
  ]'
);

COMMIT;
