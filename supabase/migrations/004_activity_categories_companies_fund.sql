-- ============================================================
-- Migration 004 — activity_categories + companies.fund
-- ============================================================
-- Run in Supabase SQL Editor.

-- 1. Rename categories → activity_categories.
--    PostgreSQL automatically updates the FK on tasks.category_id.
ALTER TABLE categories RENAME TO activity_categories;

-- 2. Add fund column to companies.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fund text;

-- 3. Update companies.type check: 'general' → 'other'.
--    First migrate existing rows, then swap the constraint.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_type_check;
UPDATE companies SET type = 'other' WHERE type = 'general';
ALTER TABLE companies
  ADD CONSTRAINT companies_type_check
  CHECK (type IN ('portfolio', 'prospect', 'other'));

-- 4. Seed activity_categories with the canonical list.
--    ON CONFLICT preserves any rows already inserted under these names.
INSERT INTO activity_categories (name) VALUES
  ('Investment Process'),
  ('Due Diligence'),
  ('Board Approval'),
  ('LP Reporting'),
  ('Legal & Compliance'),
  ('Portfolio Monitoring'),
  ('Advisor Relations'),
  ('Model Updates')
ON CONFLICT (name) DO NOTHING;
