-- Migration 018: Fix FK constraints so PostgREST recognises the profiles relationships
-- After migration 012 the schema cache doesn't know about the tasks/threads → profiles FKs,
-- so embedded-resource joins like `assignee:profiles!assignee_id(...)` don't work.
-- Dropping and re-adding the constraints forces a clean registration, and the NOTIFY
-- reloads PostgREST's schema cache so the new FKs are picked up immediately.

BEGIN;

-- tasks.assignee_id → profiles(id)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- threads.assignee_id → profiles(id)  (added by migration 015)
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_assignee_id_fkey;
ALTER TABLE threads ADD CONSTRAINT threads_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- tasks.created_by → profiles(id)  (if the column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
    ALTER TABLE tasks ADD CONSTRAINT tasks_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- Reload PostgREST schema cache so embedded-resource joins work immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
