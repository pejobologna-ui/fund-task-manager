-- Migration 013: Restore anon RLS policies for dev bypass
-- Migration 012 dropped the old anon-permissive policies from 007/009
-- but only created authenticated-role policies. This restores anon
-- access needed when VITE_DEV_BYPASS_AUTH=true.

BEGIN;

-- ── activity_categories ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "categories_anon_select" ON activity_categories;
DROP POLICY IF EXISTS "categories_anon_insert" ON activity_categories;
DROP POLICY IF EXISTS "categories_anon_update" ON activity_categories;
DROP POLICY IF EXISTS "categories_anon_delete" ON activity_categories;

CREATE POLICY "categories_anon_select" ON activity_categories FOR SELECT TO anon USING (true);
CREATE POLICY "categories_anon_insert" ON activity_categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "categories_anon_update" ON activity_categories FOR UPDATE TO anon USING (true);
CREATE POLICY "categories_anon_delete" ON activity_categories FOR DELETE TO anon USING (true);

-- ── companies ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "companies_anon_select" ON companies;
DROP POLICY IF EXISTS "companies_anon_insert" ON companies;
DROP POLICY IF EXISTS "companies_anon_update" ON companies;
DROP POLICY IF EXISTS "companies_anon_delete" ON companies;

CREATE POLICY "companies_anon_select" ON companies FOR SELECT TO anon USING (true);
CREATE POLICY "companies_anon_insert" ON companies FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "companies_anon_update" ON companies FOR UPDATE TO anon USING (true);
CREATE POLICY "companies_anon_delete" ON companies FOR DELETE TO anon USING (true);

-- ── threads ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "threads_anon_select" ON threads;
DROP POLICY IF EXISTS "threads_anon_insert" ON threads;
DROP POLICY IF EXISTS "threads_anon_update" ON threads;
DROP POLICY IF EXISTS "threads_anon_delete" ON threads;

CREATE POLICY "threads_anon_select" ON threads FOR SELECT TO anon USING (true);
CREATE POLICY "threads_anon_insert" ON threads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "threads_anon_update" ON threads FOR UPDATE TO anon USING (true);
CREATE POLICY "threads_anon_delete" ON threads FOR DELETE TO anon USING (true);

-- ── tasks ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_anon_select" ON tasks;
DROP POLICY IF EXISTS "tasks_anon_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_anon_update" ON tasks;
DROP POLICY IF EXISTS "tasks_anon_delete" ON tasks;

CREATE POLICY "tasks_anon_select" ON tasks FOR SELECT TO anon USING (true);
CREATE POLICY "tasks_anon_insert" ON tasks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "tasks_anon_update" ON tasks FOR UPDATE TO anon USING (true);
CREATE POLICY "tasks_anon_delete" ON tasks FOR DELETE TO anon USING (true);

-- ── thread_templates ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "thread_templates_anon_select" ON thread_templates;
DROP POLICY IF EXISTS "thread_templates_anon_insert" ON thread_templates;
DROP POLICY IF EXISTS "thread_templates_anon_update" ON thread_templates;
DROP POLICY IF EXISTS "thread_templates_anon_delete" ON thread_templates;

CREATE POLICY "thread_templates_anon_select" ON thread_templates FOR SELECT TO anon USING (true);
CREATE POLICY "thread_templates_anon_insert" ON thread_templates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "thread_templates_anon_update" ON thread_templates FOR UPDATE TO anon USING (true);
CREATE POLICY "thread_templates_anon_delete" ON thread_templates FOR DELETE TO anon USING (true);

-- ── profiles ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_anon_select" ON profiles;
DROP POLICY IF EXISTS "profiles_anon_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_anon_update" ON profiles;

CREATE POLICY "profiles_anon_select" ON profiles FOR SELECT TO anon USING (true);
CREATE POLICY "profiles_anon_insert" ON profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "profiles_anon_update" ON profiles FOR UPDATE TO anon USING (true);

-- ── task_shares ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_shares') THEN
    EXECUTE 'DROP POLICY IF EXISTS "task_shares_anon_select" ON task_shares';
    EXECUTE 'DROP POLICY IF EXISTS "task_shares_anon_insert" ON task_shares';
    EXECUTE 'DROP POLICY IF EXISTS "task_shares_anon_delete" ON task_shares';
    EXECUTE 'CREATE POLICY "task_shares_anon_select" ON task_shares FOR SELECT TO anon USING (true)';
    EXECUTE 'CREATE POLICY "task_shares_anon_insert" ON task_shares FOR INSERT TO anon WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "task_shares_anon_delete" ON task_shares FOR DELETE TO anon USING (true)';
  END IF;
END $$;

COMMIT;
