-- ── Migration 015: Thread-level assignee and due_date ─────────────────────
-- Adds an optional assignee (FK to profiles) and a due_date to threads.
-- No RLS changes needed — existing thread policies already cover all columns.

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_date     date;
