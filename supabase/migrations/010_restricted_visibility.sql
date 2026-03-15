-- ============================================================
-- Migration 010 — Restricted visibility + thread/category shares
-- ============================================================
-- Adds 'restricted' as a third visibility level (team/restricted/personal)
-- for tasks, threads, and activity_categories.
-- Creates thread_shares and category_shares tables.
-- Updates SELECT RLS policies to enforce restricted access via shares tables.
-- ============================================================

-- ── 1. Extend visibility CHECK constraints ─────────────────────────────────

-- tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_visibility_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_visibility_check
  CHECK (visibility IN ('team', 'restricted', 'personal'));

-- threads
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_visibility_check;
ALTER TABLE threads ADD CONSTRAINT threads_visibility_check
  CHECK (visibility IN ('team', 'restricted', 'personal'));

-- activity_categories — add visibility + created_by columns
ALTER TABLE activity_categories
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'team'
    CHECK (visibility IN ('team', 'restricted', 'personal')),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. Create thread_shares ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thread_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (thread_id, shared_with)
);
ALTER TABLE thread_shares ENABLE ROW LEVEL SECURITY;

-- Anon: open (dev bypass)
DROP POLICY IF EXISTS "thread_shares_anon_select" ON thread_shares;
DROP POLICY IF EXISTS "thread_shares_anon_insert" ON thread_shares;
DROP POLICY IF EXISTS "thread_shares_anon_delete" ON thread_shares;
CREATE POLICY "thread_shares_anon_select" ON thread_shares FOR SELECT TO anon USING (true);
CREATE POLICY "thread_shares_anon_insert" ON thread_shares FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "thread_shares_anon_delete" ON thread_shares FOR DELETE TO anon USING (true);

-- Authenticated: scoped to creator or recipient
DROP POLICY IF EXISTS "thread_shares_auth_select" ON thread_shares;
DROP POLICY IF EXISTS "thread_shares_auth_insert" ON thread_shares;
DROP POLICY IF EXISTS "thread_shares_auth_delete" ON thread_shares;
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

-- ── 3. Create category_shares ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS category_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES activity_categories(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (category_id, shared_with)
);
ALTER TABLE category_shares ENABLE ROW LEVEL SECURITY;

-- Anon: open (dev bypass)
DROP POLICY IF EXISTS "category_shares_anon_select" ON category_shares;
DROP POLICY IF EXISTS "category_shares_anon_insert" ON category_shares;
DROP POLICY IF EXISTS "category_shares_anon_delete" ON category_shares;
CREATE POLICY "category_shares_anon_select" ON category_shares FOR SELECT TO anon USING (true);
CREATE POLICY "category_shares_anon_insert" ON category_shares FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "category_shares_anon_delete" ON category_shares FOR DELETE TO anon USING (true);

-- Authenticated: scoped to creator or recipient
DROP POLICY IF EXISTS "category_shares_auth_select" ON category_shares;
DROP POLICY IF EXISTS "category_shares_auth_insert" ON category_shares;
DROP POLICY IF EXISTS "category_shares_auth_delete" ON category_shares;
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

-- ── 4. Update tasks SELECT policy to include 'restricted' ──────────────────
-- Drop the old anon tasks select (from earlier migrations) and recreate
DROP POLICY IF EXISTS "tasks_anon_select"          ON tasks;
DROP POLICY IF EXISTS "tasks_select_anon"          ON tasks;
DROP POLICY IF EXISTS "tasks_anon_read"            ON tasks;
DROP POLICY IF EXISTS "anon_select_tasks"          ON tasks;

-- Anon: all tasks visible (dev bypass)
CREATE POLICY "tasks_anon_select" ON tasks FOR SELECT TO anon USING (true);

-- Authenticated: team OR (restricted/personal if creator or in task_shares)
DROP POLICY IF EXISTS "tasks_auth_select"          ON tasks;
DROP POLICY IF EXISTS "tasks_select_authenticated" ON tasks;
DROP POLICY IF EXISTS "tasks_read_policy"          ON tasks;
CREATE POLICY "tasks_auth_select" ON tasks FOR SELECT TO authenticated
  USING (
    visibility = 'team'
    OR (
      visibility IN ('personal', 'restricted')
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_shares
          WHERE task_shares.task_id = tasks.id
            AND task_shares.shared_with = auth.uid()
        )
      )
    )
  );

-- ── 5. Update threads SELECT policy to include 'restricted' ────────────────
DROP POLICY IF EXISTS "threads_anon_select"          ON threads;
DROP POLICY IF EXISTS "threads_select_anon"          ON threads;
CREATE POLICY "threads_anon_select" ON threads FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "threads_auth_select"          ON threads;
DROP POLICY IF EXISTS "threads_select_authenticated" ON threads;
DROP POLICY IF EXISTS "threads_read_policy"          ON threads;
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

-- ── 6. Update activity_categories SELECT policy ────────────────────────────
-- The policies from migration 009 used USING (true) — replace the auth SELECT
-- policy with a scoped one that respects visibility.
DROP POLICY IF EXISTS "activity_categories_auth_select" ON activity_categories;
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
-- Anon select remains open (true) — already set in migration 009
