-- Migration 017: Seed profiles from legacy users table
-- Creates auth.users + profiles entries for each legacy user so that
-- assignee_id (uuid FK → profiles) works in dev without real auth signups.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
--
-- profiles.role check constraint allows: 'gp', 'associate', 'analyst', 'viewer'
-- Legacy users.role values map as:
--   'General Partner' → 'gp'
--   'Associate'       → 'associate'
--   'Analyst'         → 'analyst'
--   anything else     → 'viewer'

BEGIN;

-- Insert into auth.users first (required by FK on profiles.id)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role
)
SELECT
  gen_random_uuid() AS id,
  lower(replace(u.name, ' ', '.') || '@fund.local') AS email,
  '' AS encrypted_password,
  now() AS email_confirmed_at,
  now() AS created_at,
  now() AS updated_at,
  '{}'::jsonb AS raw_app_meta_data,
  '{}'::jsonb AS raw_user_meta_data,
  false AS is_super_admin,
  'authenticated' AS role
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.initials = u.initials
)
ON CONFLICT DO NOTHING;

-- Insert into profiles, mapping plain-English roles to the allowed enum values
INSERT INTO profiles (id, full_name, initials, role)
SELECT
  au.id,
  u.name,
  u.initials,
  CASE u.role
    WHEN 'General Partner' THEN 'gp'
    WHEN 'Associate'       THEN 'associate'
    WHEN 'Analyst'         THEN 'analyst'
    ELSE 'viewer'
  END AS role
FROM users u
JOIN auth.users au ON au.email = lower(replace(u.name, ' ', '.') || '@fund.local')
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.initials = u.initials
)
ON CONFLICT DO NOTHING;

COMMIT;
