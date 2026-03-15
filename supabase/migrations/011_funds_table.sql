-- ============================================================
-- Migration 011 — funds table + fund_id FK on companies
-- ============================================================
-- Run in Supabase SQL Editor.

-- 1. Create the funds table
CREATE TABLE IF NOT EXISTS funds (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

-- anon policies (dev bypass)
CREATE POLICY "funds_anon_select" ON funds FOR SELECT TO anon     USING (true);
CREATE POLICY "funds_anon_insert" ON funds FOR INSERT TO anon     WITH CHECK (true);
CREATE POLICY "funds_anon_update" ON funds FOR UPDATE TO anon     USING (true);
CREATE POLICY "funds_anon_delete" ON funds FOR DELETE TO anon     USING (true);

-- authenticated policies
CREATE POLICY "funds_auth_select" ON funds FOR SELECT TO authenticated USING (true);
CREATE POLICY "funds_auth_insert" ON funds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "funds_auth_update" ON funds FOR UPDATE TO authenticated USING (true);
CREATE POLICY "funds_auth_delete" ON funds FOR DELETE TO authenticated USING (true);

-- 2. Add fund_id FK to companies (nullable — fund-level companies have null)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS fund_id uuid REFERENCES funds(id) ON DELETE SET NULL;
