-- ============================================================
-- Migration 009 — Write policies for shared lookup tables
-- ============================================================
-- Enables RLS + full anon/authenticated CRUD on activity_categories
-- and companies (both had no RLS). Adds missing anon write policies
-- for thread_templates and the missing anon DELETE for threads.
-- ============================================================

-- ── activity_categories ──────────────────────────────────────
ALTER TABLE activity_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_categories_anon_select"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_insert"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_update"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_anon_delete"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_select"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_insert"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_update"  ON activity_categories;
DROP POLICY IF EXISTS "activity_categories_auth_delete"  ON activity_categories;

CREATE POLICY "activity_categories_anon_select" ON activity_categories FOR SELECT TO anon        USING (true);
CREATE POLICY "activity_categories_anon_insert" ON activity_categories FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "activity_categories_anon_update" ON activity_categories FOR UPDATE TO anon        USING (true);
CREATE POLICY "activity_categories_anon_delete" ON activity_categories FOR DELETE TO anon        USING (true);
CREATE POLICY "activity_categories_auth_select" ON activity_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_categories_auth_insert" ON activity_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "activity_categories_auth_update" ON activity_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "activity_categories_auth_delete" ON activity_categories FOR DELETE TO authenticated USING (true);

-- ── companies ────────────────────────────────────────────────
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_anon_select"  ON companies;
DROP POLICY IF EXISTS "companies_anon_insert"  ON companies;
DROP POLICY IF EXISTS "companies_anon_update"  ON companies;
DROP POLICY IF EXISTS "companies_anon_delete"  ON companies;
DROP POLICY IF EXISTS "companies_auth_select"  ON companies;
DROP POLICY IF EXISTS "companies_auth_insert"  ON companies;
DROP POLICY IF EXISTS "companies_auth_update"  ON companies;
DROP POLICY IF EXISTS "companies_auth_delete"  ON companies;

CREATE POLICY "companies_anon_select" ON companies FOR SELECT TO anon        USING (true);
CREATE POLICY "companies_anon_insert" ON companies FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "companies_anon_update" ON companies FOR UPDATE TO anon        USING (true);
CREATE POLICY "companies_anon_delete" ON companies FOR DELETE TO anon        USING (true);
CREATE POLICY "companies_auth_select" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_auth_insert" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "companies_auth_update" ON companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "companies_auth_delete" ON companies FOR DELETE TO authenticated USING (true);

-- ── thread_templates (anon write — SELECT already exists from migration 006) ──
DROP POLICY IF EXISTS "thread_templates_anon_insert" ON thread_templates;
DROP POLICY IF EXISTS "thread_templates_anon_update" ON thread_templates;
DROP POLICY IF EXISTS "thread_templates_anon_delete" ON thread_templates;

CREATE POLICY "thread_templates_anon_insert" ON thread_templates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "thread_templates_anon_update" ON thread_templates FOR UPDATE TO anon USING (true);
CREATE POLICY "thread_templates_anon_delete" ON thread_templates FOR DELETE TO anon USING (true);

-- ── threads — missing anon DELETE (INSERT/UPDATE already in migration 007) ──
DROP POLICY IF EXISTS "threads_anon_delete" ON threads;
CREATE POLICY "threads_anon_delete" ON threads FOR DELETE TO anon USING (true);
