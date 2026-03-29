-- ============================================================
-- Rollback for migration 012: Undo Core Data Model Redesign
-- ============================================================
-- Restores the schema to its pre-012 state (end of migration 011).
--
-- Run this ONLY after migration 012 has been applied and you need
-- to revert it.  The steps are in the exact reverse order of 012.
--
-- IRRECOVERABLE DATA LOSSES (accepted trade-offs of rollback):
--   • tasks.assignee_id — was nulled by 012; cannot be restored.
--   • threads.category / threads.visibility — columns were dropped
--     by 012; original values cannot be restored.
--   • activity_categories.visibility / .created_by — same.
--   • funds table — was dropped by 012; data cannot be restored.
--     All companies.fund_id values that pointed to fund companies
--     are set NULL after rollback.
--   • thread_templates — custom templates added after 012 are lost;
--     the pre-012 seed (migration 008) is restored exactly.
--   • Tasks that were DIRECTLY created inside threads after 012
--     was applied are migrated back to thread_steps as best-effort
--     (status, assignee, due_date preserved; category_id is lost).
--
-- NOTE — assignee_id type:
--   Migration 012 attempted to change tasks.assignee_id FK from the
--   legacy `users` table (text PK) to `profiles` (uuid PK) without
--   explicitly altering the column type.  If 012 succeeded on your
--   database the column is already uuid; if it only partially
--   ran the column may still be text.  This rollback handles both:
--   it drops whatever FK is present, casts to text if needed, then
--   re-adds the original FK to users(id).
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 5 (reverse). thread_templates
--    • Remove the `description` column added by 012
--    • Truncate the 012 seed and restore the migration-008 seed
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE thread_templates DROP COLUMN IF EXISTS description;

TRUNCATE thread_templates;

INSERT INTO thread_templates (name, category, steps) VALUES
(
  'Investment Process',
  'Deal Flow',
  '[
    {"title": "Initial screening", "description": "Review deck and financials for fit with thesis"},
    {"title": "First meeting",     "description": "First call or in-person with founding team"},
    {"title": "IC memo",           "description": "Draft investment committee memorandum"},
    {"title": "Due diligence",     "description": "Assign and complete all DD workstreams"},
    {"title": "Term sheet",        "description": "Issue and negotiate term sheet"},
    {"title": "Legal closing",     "description": "SPA, cap-table update, wire transfer"}
  ]'::jsonb
),
(
  'Board Deck',
  'Portfolio Monitoring',
  '[
    {"title": "Collect materials",    "description": "Gather financials, KPIs, and key milestones from portfolio company"},
    {"title": "Draft slides",         "description": "Build slide deck with narrative, charts, and appendix"},
    {"title": "Internal review",      "description": "Partner review of draft deck"},
    {"title": "Share with board",     "description": "Distribute deck to board members ahead of meeting"},
    {"title": "Incorporate feedback", "description": "Revise deck based on board and management comments"},
    {"title": "Final version",        "description": "Lock final deck and archive"}
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
  'Investor Relations',
  '[
    {"title": "Data collection",  "description": "Gather valuations, KPIs and financials from portfolio companies"},
    {"title": "Draft",            "description": "Write the quarterly narrative and populate financials"},
    {"title": "Internal review",  "description": "Partner sign-off round"},
    {"title": "Send",             "description": "Distribute via fund admin portal"}
  ]'::jsonb
),
(
  'Portfolio Review',
  'Portfolio Monitoring',
  '[
    {"title": "KPI collection",   "description": "Collect monthly / quarterly KPIs from each portfolio company"},
    {"title": "Financial update", "description": "Update fund model with latest financials"},
    {"title": "Board deck",       "description": "Prepare portfolio review slide deck"},
    {"title": "Review call",      "description": "Internal or LP-facing portfolio review call"}
  ]'::jsonb
),
(
  'New Portfolio Company Onboarding',
  'Portfolio Monitoring',
  '[
    {"title": "Cap table setup",              "description": "Record investment in fund model and cap table tool"},
    {"title": "Data room access",             "description": "Ensure fund team has access to company data room"},
    {"title": "Introduce portfolio services", "description": "Connect company to fund talent, legal, and finance network"},
    {"title": "Reporting cadence agreed",     "description": "Set monthly / quarterly KPI reporting expectations"},
    {"title": "First board seat",             "description": "Confirm board observer or director rights"}
  ]'::jsonb
),
(
  'Capital Call',
  'Fund Operations',
  '[
    {"title": "Draft notice",         "description": "Prepare capital call notice with amount, purpose, and wire instructions"},
    {"title": "LP notification",      "description": "Send capital call notice to all LPs with 10-business-day notice"},
    {"title": "Wire collection",      "description": "Track and confirm wire receipts from each LP by due date"},
    {"title": "Deploy capital",       "description": "Wire funds to portfolio company or investment target"},
    {"title": "Confirmation letters", "description": "Issue funding confirmation and capital account statements to LPs"}
  ]'::jsonb
),
(
  'Fund Closing',
  'Fund Operations',
  '[
    {"title": "LP commitments confirmed", "description": "Finalise LP commitment letters and target fund size"},
    {"title": "Legal docs drafted",       "description": "LPA, subscription agreements, and side letters prepared"},
    {"title": "Regulatory filings",       "description": "Submit fund registration and compliance filings"},
    {"title": "First close",              "description": "Execute first close and accept initial LP capital"},
    {"title": "Final close",              "description": "Execute final close and send welcome pack to all LPs"}
  ]'::jsonb
),
(
  'Valuation Update',
  'Portfolio Monitoring',
  '[
    {"title": "Request financials", "description": "Collect latest financials and KPIs from portfolio company"},
    {"title": "Update model",       "description": "Refresh valuation model with new data and comparables"},
    {"title": "Partner review",     "description": "Internal partner review and sign-off on methodology"},
    {"title": "Auditor sign-off",   "description": "Submit valuations to fund auditors for review"}
  ]'::jsonb
),
(
  'Co-investment',
  'Deal Flow',
  '[
    {"title": "Opportunity memo",     "description": "Prepare co-investment opportunity summary for LPs"},
    {"title": "LP notification",      "description": "Send opportunity to eligible co-investment LPs"},
    {"title": "Commitments received", "description": "Collect and confirm LP co-investment amounts"},
    {"title": "Documentation",        "description": "Prepare and circulate co-investment agreements"},
    {"title": "Closing",              "description": "Execute closing documents and transfer LP funds"}
  ]'::jsonb
),
(
  'Exit Process',
  'Deal Flow',
  '[
    {"title": "Mandate signed",     "description": "Engage banker or advisor and sign mandate"},
    {"title": "Buyer outreach",     "description": "Run process and collect IOIs from strategic and financial buyers"},
    {"title": "LOI received",       "description": "Evaluate letters of intent and select preferred buyer"},
    {"title": "Due diligence",      "description": "Support buyer DD and manage data room"},
    {"title": "Purchase agreement", "description": "Negotiate and sign SPA or merger agreement"},
    {"title": "Distribution",       "description": "Close transaction, receive proceeds, and distribute to LPs"}
  ]'::jsonb
),
(
  'Regulatory Filing',
  'Compliance',
  '[
    {"title": "Identify requirements", "description": "Confirm applicable filings (Form D, ADV, AIFMD, etc.) and deadlines"},
    {"title": "Prepare documents",     "description": "Draft and assemble required forms and supporting exhibits"},
    {"title": "Legal review",          "description": "Outside counsel review and sign-off"},
    {"title": "Submit filing",         "description": "File with relevant regulator and retain submission confirmation"},
    {"title": "Confirm receipt",       "description": "Obtain acknowledgement from regulator and update compliance log"}
  ]'::jsonb
);


-- ═══════════════════════════════════════════════════════════════════════
-- 4 (reverse). tasks + thread_steps
--    • Recreate thread_steps table
--    • Migrate tasks with thread_id back to thread_steps
--    • Remove those rows from tasks
--    • Drop the tasks."order" column
--    • Restore tasks.assignee_id FK to users (legacy text PK)
-- ═══════════════════════════════════════════════════════════════════════

-- 4a. Recreate thread_steps (structure from migration 005)
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
CREATE INDEX IF NOT EXISTS thread_steps_order_idx     ON thread_steps(thread_id, "order");

-- 4b. Restore RLS on thread_steps (from migrations 005 + 007)
ALTER TABLE thread_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread_steps_select"      ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_insert"      ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_update"      ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_delete"      ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_anon_insert" ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_anon_update" ON thread_steps;
DROP POLICY IF EXISTS "thread_steps_anon_delete" ON thread_steps;

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

CREATE POLICY "thread_steps_anon_insert" ON thread_steps FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "thread_steps_anon_update" ON thread_steps FOR UPDATE TO anon USING (true);
CREATE POLICY "thread_steps_anon_delete" ON thread_steps FOR DELETE TO anon USING (true);

-- 4c. Move all thread-linked tasks back into thread_steps.
--     Status mapping (reverse of 012):
--       Open        → pending
--       In Progress → in_progress
--       In Review   → in_progress  (no pre-012 equivalent; nearest is in_progress)
--       Done        → completed
--     assigned_to: tasks.assignee_id is already profiles(id) compatible.
INSERT INTO thread_steps (
  thread_id, title, description, "order", status,
  assigned_to, due_date, created_at
)
SELECT
  thread_id,
  title,
  description,
  COALESCE("order", 0),
  CASE status
    WHEN 'Open'        THEN 'pending'
    WHEN 'In Progress' THEN 'in_progress'
    WHEN 'In Review'   THEN 'in_progress'
    WHEN 'Done'        THEN 'completed'
    ELSE                    'pending'
  END,
  assignee_id,
  due_date,
  COALESCE(created_at, now())
FROM tasks
WHERE thread_id IS NOT NULL;

-- 4d. Remove the task rows that were just moved to thread_steps
DELETE FROM tasks WHERE thread_id IS NOT NULL;

-- 4e. Drop the "order" column added by 012
ALTER TABLE tasks DROP COLUMN IF EXISTS "order";

-- 4f. Restore tasks.assignee_id FK → users (legacy text PK)
--     012 dropped the old FK and re-added it pointing to profiles(id).
--     All values are NULL (012 nulled them), so no data is at risk.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;

-- If 012 also changed the column type to uuid, cast it back to text.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'tasks' AND column_name = 'assignee_id') = 'uuid' THEN
    ALTER TABLE tasks ALTER COLUMN assignee_id TYPE text USING assignee_id::text;
  END IF;
END $$;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════════════════════
-- 3 (reverse). threads
--    • Recreate thread_shares
--    • Restore category + visibility columns
--    • Drop status + template_id columns
--    • Restore pre-012 RLS policies
-- ═══════════════════════════════════════════════════════════════════════

-- 3a. Recreate thread_shares (from migration 010)
CREATE TABLE IF NOT EXISTS thread_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (thread_id, shared_with)
);
ALTER TABLE thread_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread_shares_anon_select" ON thread_shares;
DROP POLICY IF EXISTS "thread_shares_anon_insert" ON thread_shares;
DROP POLICY IF EXISTS "thread_shares_anon_delete" ON thread_shares;
DROP POLICY IF EXISTS "thread_shares_auth_select" ON thread_shares;
DROP POLICY IF EXISTS "thread_shares_auth_insert" ON thread_shares;
DROP POLICY IF EXISTS "thread_shares_auth_delete" ON thread_shares;

CREATE POLICY "thread_shares_anon_select" ON thread_shares FOR SELECT TO anon USING (true);
CREATE POLICY "thread_shares_anon_insert" ON thread_shares FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "thread_shares_anon_delete" ON thread_shares FOR DELETE TO anon USING (true);

CREATE POLICY "thread_shares_auth_select" ON thread_shares FOR SELECT TO authenticated
  USING (
    shared_with = auth.uid()
    OR EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = thread_shares.thread_id
        AND threads.created_by = auth.uid()
    )
  );
CREATE POLICY "thread_shares_auth_insert" ON thread_shares FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = thread_shares.thread_id
        AND threads.created_by = auth.uid()
    )
  );
CREATE POLICY "thread_shares_auth_delete" ON thread_shares FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = thread_shares.thread_id
        AND threads.created_by = auth.uid()
    )
  );

-- 3b. Drop threads constraints/columns added by 012
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_status_check;
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_template_id_fkey;
ALTER TABLE threads DROP COLUMN IF EXISTS status;
ALTER TABLE threads DROP COLUMN IF EXISTS template_id;

-- 3c. Restore dropped columns (values irrecoverably lost; defaults applied)
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS category   text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'team'
    CHECK (visibility IN ('team', 'restricted', 'personal'));

-- 3d. Restore threads RLS to pre-012 state (migrations 005 + 007 + 009 + 010)
--     Drop all current thread policies (some may be missing if dropped by CASCADE
--     when visibility was dropped — use IF EXISTS throughout).
DROP POLICY IF EXISTS "threads_select"       ON threads;
DROP POLICY IF EXISTS "threads_insert"       ON threads;
DROP POLICY IF EXISTS "threads_update"       ON threads;
DROP POLICY IF EXISTS "threads_delete"       ON threads;
DROP POLICY IF EXISTS "threads_anon_select"  ON threads;
DROP POLICY IF EXISTS "threads_anon_insert"  ON threads;
DROP POLICY IF EXISTS "threads_anon_update"  ON threads;
DROP POLICY IF EXISTS "threads_anon_delete"  ON threads;
DROP POLICY IF EXISTS "threads_auth_select"  ON threads;
DROP POLICY IF EXISTS "threads_auth_insert"  ON threads;
DROP POLICY IF EXISTS "threads_auth_update"  ON threads;
DROP POLICY IF EXISTS "threads_auth_delete"  ON threads;

-- Anon (dev bypass) — from migrations 007, 009, 010
CREATE POLICY "threads_anon_select" ON threads FOR SELECT TO anon USING (true);
CREATE POLICY "threads_anon_insert" ON threads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "threads_anon_update" ON threads FOR UPDATE TO anon USING (true);
CREATE POLICY "threads_anon_delete" ON threads FOR DELETE TO anon USING (true);

-- Authenticated — from migrations 005 + 010
CREATE POLICY "threads_auth_select" ON threads FOR SELECT TO authenticated
  USING (
    visibility = 'team'
    OR (
      visibility IN ('personal', 'restricted')
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM thread_shares
          WHERE thread_shares.thread_id = threads.id
            AND thread_shares.shared_with = auth.uid()
        )
      )
    )
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


-- ═══════════════════════════════════════════════════════════════════════
-- 2 (reverse). companies
--    • NULL fund_id on all portfolio/prospect companies (will re-bind to
--      funds table once it is recreated, but funds data is gone so we
--      leave them NULL — the FK just points to the right table again)
--    • Delete company rows created by 012 (type = 'fund')
--    • Revert type = 'sgr' back to 'other' (the pre-012 value)
--    • Drop the self-referential companies_fund_id_fkey
--    • Recreate the funds table (empty — data was lost)
--    • Re-add companies.fund_id FK → funds(id)
--    • Restore the fund text column
--    • Restore the type CHECK constraint to pre-012 values
--    • Restore RLS to migration-009 state (full open CRUD)
-- ═══════════════════════════════════════════════════════════════════════

-- 2a. Break self-referential fund_id links before deleting fund rows
UPDATE companies SET fund_id = NULL
  WHERE fund_id IN (SELECT id FROM companies WHERE type = 'fund');

-- 2b. Remove fund-type companies created by 012
--     WARNING: this permanently deletes all companies with type = 'fund'.
--     If you manually added fund companies after running 012 and want to
--     keep them, export them before running this rollback.
DELETE FROM companies WHERE type = 'fund';

-- 2c. Revert SGR companies back to 'other' (pre-012 type name)
UPDATE companies SET type = 'other' WHERE type = 'sgr';

-- 2d. Temporarily NULL all fund_id values (FK target is about to change)
UPDATE companies SET fund_id = NULL WHERE fund_id IS NOT NULL;

-- 2e. Drop the self-referential FK added by 012
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_fund_id_fkey;

-- 2f. Restore the type CHECK constraint to pre-012 values
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_type_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_type_check
  CHECK (type IN ('portfolio', 'prospect', 'other'));

-- 2g. Restore the `fund` text column removed by 012
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fund text;

-- 2h. Recreate the funds table (from migration 011) — data cannot be restored
CREATE TABLE IF NOT EXISTS funds (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funds_anon_select" ON funds;
DROP POLICY IF EXISTS "funds_anon_insert" ON funds;
DROP POLICY IF EXISTS "funds_anon_update" ON funds;
DROP POLICY IF EXISTS "funds_anon_delete" ON funds;
DROP POLICY IF EXISTS "funds_auth_select" ON funds;
DROP POLICY IF EXISTS "funds_auth_insert" ON funds;
DROP POLICY IF EXISTS "funds_auth_update" ON funds;
DROP POLICY IF EXISTS "funds_auth_delete" ON funds;

CREATE POLICY "funds_anon_select" ON funds FOR SELECT TO anon      USING (true);
CREATE POLICY "funds_anon_insert" ON funds FOR INSERT TO anon      WITH CHECK (true);
CREATE POLICY "funds_anon_update" ON funds FOR UPDATE TO anon      USING (true);
CREATE POLICY "funds_anon_delete" ON funds FOR DELETE TO anon      USING (true);
CREATE POLICY "funds_auth_select" ON funds FOR SELECT TO authenticated USING (true);
CREATE POLICY "funds_auth_insert" ON funds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "funds_auth_update" ON funds FOR UPDATE TO authenticated USING (true);
CREATE POLICY "funds_auth_delete" ON funds FOR DELETE TO authenticated USING (true);

-- 2i. Re-add companies.fund_id → funds(id) (from migration 011)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_fund_id_fkey;
ALTER TABLE companies
  ADD CONSTRAINT companies_fund_id_fkey
  FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE SET NULL;

-- 2j. Restore companies RLS to migration-009 state (full open CRUD for both roles)
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;
DROP POLICY IF EXISTS "companies_delete" ON companies;
DROP POLICY IF EXISTS "companies_anon_select" ON companies;
DROP POLICY IF EXISTS "companies_anon_insert" ON companies;
DROP POLICY IF EXISTS "companies_anon_update" ON companies;
DROP POLICY IF EXISTS "companies_anon_delete" ON companies;
DROP POLICY IF EXISTS "companies_auth_select" ON companies;
DROP POLICY IF EXISTS "companies_auth_insert" ON companies;
DROP POLICY IF EXISTS "companies_auth_update" ON companies;
DROP POLICY IF EXISTS "companies_auth_delete" ON companies;

CREATE POLICY "companies_anon_select" ON companies FOR SELECT TO anon        USING (true);
CREATE POLICY "companies_anon_insert" ON companies FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "companies_anon_update" ON companies FOR UPDATE TO anon        USING (true);
CREATE POLICY "companies_anon_delete" ON companies FOR DELETE TO anon        USING (true);
CREATE POLICY "companies_auth_select" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_auth_insert" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "companies_auth_update" ON companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "companies_auth_delete" ON companies FOR DELETE TO authenticated USING (true);


-- ═══════════════════════════════════════════════════════════════════════
-- 1 (reverse). activity_categories
--    • Drop 012 RLS policies
--    • Restore visibility + created_by columns
--    • Drop macro_category column
--    • Delete category rows added exclusively by 012 (safe only if no
--      tasks reference them — skipped automatically via the WHERE clause)
--    • Recreate category_shares table
--    • Restore pre-012 RLS (migrations 009 + 010)
-- ═══════════════════════════════════════════════════════════════════════

-- 1a. Drop the 012 RLS policies
DROP POLICY IF EXISTS "categories_select" ON activity_categories;
DROP POLICY IF EXISTS "categories_insert" ON activity_categories;
DROP POLICY IF EXISTS "categories_update" ON activity_categories;
DROP POLICY IF EXISTS "categories_delete" ON activity_categories;
-- Also drop any old policy names that may have been dropped then recreated
DROP POLICY IF EXISTS "activity_categories_auth_select"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_insert"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_update"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_delete"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_select"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_insert"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_update"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_delete"  ON activity_categories;

-- 1b. Restore columns dropped by 012
ALTER TABLE activity_categories
  ADD COLUMN IF NOT EXISTS visibility  text NOT NULL DEFAULT 'team'
    CHECK (visibility IN ('team', 'restricted', 'personal')),
  ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1c. Drop the macro_category column added by 012
ALTER TABLE activity_categories DROP COLUMN IF EXISTS macro_category;

-- 1d. Remove categories inserted exclusively by migration 012.
--     These are names that did NOT exist before 012 (i.e. not in the
--     migration 004 seed list) AND are not referenced by any task.
--     Categories that pre-dated 012 are left untouched.
DELETE FROM activity_categories
  WHERE name IN (
    'Administration',
    'Pipeline',
    'Scouting',
    'Due Diligence & Legal',
    'Valuation',
    'Info Memo',
    'Reporting to LPs',
    'IC / Board Docs',
    'Other'
  )
  AND id NOT IN (SELECT DISTINCT category_id FROM tasks WHERE category_id IS NOT NULL);

-- 1e. Recreate category_shares (from migration 010)
CREATE TABLE IF NOT EXISTS category_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES activity_categories(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (category_id, shared_with)
);
ALTER TABLE category_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "category_shares_anon_select" ON category_shares;
DROP POLICY IF EXISTS "category_shares_anon_insert" ON category_shares;
DROP POLICY IF EXISTS "category_shares_anon_delete" ON category_shares;
DROP POLICY IF EXISTS "category_shares_auth_select" ON category_shares;
DROP POLICY IF EXISTS "category_shares_auth_insert" ON category_shares;
DROP POLICY IF EXISTS "category_shares_auth_delete" ON category_shares;

CREATE POLICY "category_shares_anon_select" ON category_shares FOR SELECT TO anon USING (true);
CREATE POLICY "category_shares_anon_insert" ON category_shares FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "category_shares_anon_delete" ON category_shares FOR DELETE TO anon USING (true);

CREATE POLICY "category_shares_auth_select" ON category_shares FOR SELECT TO authenticated
  USING (
    shared_with = auth.uid()
    OR EXISTS (
      SELECT 1 FROM activity_categories
      WHERE activity_categories.id = category_shares.category_id
        AND activity_categories.created_by = auth.uid()
    )
  );
CREATE POLICY "category_shares_auth_insert" ON category_shares FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activity_categories
      WHERE activity_categories.id = category_shares.category_id
        AND activity_categories.created_by = auth.uid()
    )
  );
CREATE POLICY "category_shares_auth_delete" ON category_shares FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activity_categories
      WHERE activity_categories.id = category_shares.category_id
        AND activity_categories.created_by = auth.uid()
    )
  );

-- 1f. Restore activity_categories RLS (migrations 009 + 010)
CREATE POLICY "activity_categories_anon_select" ON activity_categories FOR SELECT TO anon        USING (true);
CREATE POLICY "activity_categories_anon_insert" ON activity_categories FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "activity_categories_anon_update" ON activity_categories FOR UPDATE TO anon        USING (true);
CREATE POLICY "activity_categories_anon_delete" ON activity_categories FOR DELETE TO anon        USING (true);
CREATE POLICY "activity_categories_auth_insert" ON activity_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "activity_categories_auth_update" ON activity_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "activity_categories_auth_delete" ON activity_categories FOR DELETE TO authenticated USING (true);

-- Scoped SELECT from migration 010 (respects visibility + category_shares)
CREATE POLICY "activity_categories_auth_select" ON activity_categories FOR SELECT TO authenticated
  USING (
    visibility = 'team'
    OR (
      visibility IN ('personal', 'restricted')
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM category_shares
          WHERE category_shares.category_id = activity_categories.id
            AND category_shares.shared_with = auth.uid()
        )
      )
    )
  );

COMMIT;
