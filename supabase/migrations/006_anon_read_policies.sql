-- ============================================================
-- Migration 006 — Add anon read policies for thread tables
-- ============================================================
-- The dev environment uses the Supabase anon key (no real JWT),
-- so all RLS policies scoped to TO authenticated are invisible to
-- that session.  The three thread tables added in migration 005
-- need matching anon SELECT policies so:
--   • thread joins on tasks return data (not null)
--   • the Thread detail page can load steps
--   • thread_templates are readable
--
-- Only team-visibility threads are exposed to anon.
-- Personal threads remain private (created_by = auth.uid() only).
-- ============================================================

CREATE POLICY "threads_anon_select" ON threads
  FOR SELECT TO anon
  USING (visibility = 'team');

CREATE POLICY "thread_steps_anon_select" ON thread_steps
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "thread_templates_anon_select" ON thread_templates
  FOR SELECT TO anon
  USING (true);
