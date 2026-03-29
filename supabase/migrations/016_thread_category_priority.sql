-- ── Migration 016: Thread-level category and priority ──────────────────────
-- Adds optional category (FK to activity_categories) and priority to threads.
-- When set, these cascade to all tasks in the thread via the app UI.

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES activity_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority    text CHECK (priority IN ('High', 'Medium', 'Low'));
