-- Migration 019: Backfill profiles that were seeded with empty data
-- Migration 017 inserted into auth.users which triggered auto-creation of blank
-- profile rows; the subsequent profiles INSERT hit ON CONFLICT DO NOTHING.
-- This migration UPDATEs those empty rows with the correct name/initials/role.

UPDATE profiles p
SET
  full_name = u.name,
  initials  = u.initials,
  role      = CASE u.role
                WHEN 'General Partner' THEN 'gp'
                WHEN 'Associate'       THEN 'associate'
                WHEN 'Analyst'         THEN 'analyst'
                ELSE 'viewer'
              END
FROM auth.users au
JOIN users u ON au.email = lower(replace(u.name, ' ', '.') || '@fund.local')
WHERE p.id = au.id
  AND (p.full_name IS NULL OR p.full_name = '');
