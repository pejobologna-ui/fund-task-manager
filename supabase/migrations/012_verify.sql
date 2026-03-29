-- ============================================================
-- Verification script for migration 012_redesign_core_model
-- ============================================================
-- Run in the Supabase SQL Editor after applying migration 012.
-- By default only FAILs are shown.  To see every check, change
-- the final WHERE to:  WHERE TRUE
-- ============================================================

WITH

-- ── reusable helpers ──────────────────────────────────────────────────────────

cols AS (          -- all public columns
  SELECT table_name, column_name, data_type
  FROM   information_schema.columns
  WHERE  table_schema = 'public'
),
tbls AS (          -- all public tables
  SELECT table_name
  FROM   information_schema.tables
  WHERE  table_schema = 'public' AND table_type = 'BASE TABLE'
),
fks AS (           -- all FK constraints on public tables
  SELECT c.conname                          AS cname,
         c.conrelid::regclass::text         AS src_table,
         c.confrelid::regclass::text        AS tgt_table,
         (                                              -- first column name
           SELECT a.attname FROM pg_attribute a
           WHERE  a.attrelid = c.conrelid
             AND  a.attnum   = c.conkey[1]
         )                                             AS src_col
  FROM   pg_constraint c
  WHERE  c.contype = 'f'
    AND  c.conrelid::regclass::text NOT LIKE 'pg_%'
),
chks AS (          -- all CHECK constraints
  SELECT c.conname,
         c.conrelid::regclass::text AS tbl,
         pg_get_constraintdef(c.oid)  AS def
  FROM   pg_constraint c
  WHERE  c.contype = 'c'
),
rls AS (           -- RLS enabled flag per table
  SELECT tablename, rowsecurity
  FROM   pg_tables
  WHERE  schemaname = 'public'
),
pols AS (          -- all RLS policies
  SELECT tablename, policyname, cmd,
         (roles::text[] @> ARRAY['authenticated']) AS for_auth,
         (roles::text[] @> ARRAY['anon'])          AS for_anon
  FROM   pg_policies
  WHERE  schemaname = 'public'
),
tpl_steps AS (     -- step counts + key audit per template
  SELECT t.name                               AS tpl_name,
         jsonb_array_length(t.steps)          AS step_count,
         bool_and(
           (s->>'order')            IS NOT NULL AND
           (s->>'title')            IS NOT NULL AND
           (s->>'description')      IS NOT NULL AND
           (s->>'default_category') IS NOT NULL
         )                                    AS all_keys_present
  FROM   thread_templates t,
         jsonb_array_elements(t.steps) AS s
  GROUP  BY t.name
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §1  Columns that must EXIST after migration 012
-- ═══════════════════════════════════════════════════════════════════════════════

s1 AS (
  SELECT 10 + n AS k, '§1 Columns added' AS sec, lbl AS chk,
         EXISTS (SELECT 1 FROM cols WHERE table_name = tbl AND column_name = col) AS ok,
         format('Column %s.%s not found', tbl, col) AS why
  FROM (VALUES
    (1, 'activity_categories.macro_category',  'activity_categories', 'macro_category'),
    (2, 'threads.status',                      'threads',             'status'),
    (3, 'threads.template_id',                 'threads',             'template_id'),
    (4, 'tasks.order',                         'tasks',               'order'),
    (5, 'thread_templates.description',        'thread_templates',    'description')
  ) AS v(n, lbl, tbl, col)
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §2  Columns that must be GONE after migration 012
-- ═══════════════════════════════════════════════════════════════════════════════

s2 AS (
  SELECT 20 + n AS k, '§2 Columns dropped' AS sec, lbl AS chk,
         NOT EXISTS (SELECT 1 FROM cols WHERE table_name = tbl AND column_name = col) AS ok,
         format('Column %s.%s still exists — was it dropped?', tbl, col) AS why
  FROM (VALUES
    (1, 'activity_categories.visibility',  'activity_categories', 'visibility'),
    (2, 'activity_categories.created_by',  'activity_categories', 'created_by'),
    (3, 'companies.fund',                  'companies',           'fund'),
    (4, 'threads.category',                'threads',             'category'),
    (5, 'threads.visibility',              'threads',             'visibility')
  ) AS v(n, lbl, tbl, col)
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §3  Tables that must be GONE after migration 012
-- ═══════════════════════════════════════════════════════════════════════════════

s3 AS (
  SELECT 30 + n AS k, '§3 Tables dropped' AS sec, tbl AS chk,
         NOT EXISTS (SELECT 1 FROM tbls WHERE table_name = tbl) AS ok,
         format('Table %s still exists — was DROP TABLE executed?', tbl) AS why
  FROM (VALUES
    (1, 'funds'),
    (2, 'thread_steps'),
    (3, 'thread_shares'),
    (4, 'category_shares')
  ) AS v(n, tbl)
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §4  CHECK constraints
-- ═══════════════════════════════════════════════════════════════════════════════

s4 AS (
  -- threads.status
  SELECT 41 AS k, '§4 CHECK constraints' AS sec,
         'threads_status_check  (active | completed | archived)' AS chk,
         EXISTS (
           SELECT 1 FROM chks
           WHERE  tbl = 'threads'
             AND  def ILIKE '%active%'
             AND  def ILIKE '%completed%'
             AND  def ILIKE '%archived%'
         ) AS ok,
         'Constraint threads_status_check missing or does not cover all three values' AS why
  UNION ALL
  -- companies.type
  SELECT 42, '§4 CHECK constraints',
         'companies_type_check  (sgr | fund | portfolio | prospect)',
         EXISTS (
           SELECT 1 FROM chks
           WHERE  tbl = 'companies'
             AND  def ILIKE '%sgr%'
             AND  def ILIKE '%fund%'
             AND  def ILIKE '%portfolio%'
             AND  def ILIKE '%prospect%'
         ),
         'Constraint companies_type_check missing or missing sgr/fund values'
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §5  Foreign keys
-- ═══════════════════════════════════════════════════════════════════════════════

s5 AS (
  SELECT 50 + n AS k, '§5 Foreign keys' AS sec, lbl AS chk,
         EXISTS (
           SELECT 1 FROM fks
           WHERE  cname     = constraint_name
             AND  src_table = src
             AND  tgt_table = tgt
             AND  src_col   = col
         ) AS ok,
         format('FK %s not found — check pg_constraint', constraint_name) AS why
  FROM (VALUES
    (1, 'tasks.assignee_id → profiles',
        'tasks_assignee_id_fkey',      'tasks',    'profiles',         'assignee_id'),
    (2, 'threads.template_id → thread_templates',
        'threads_template_id_fkey',    'threads',  'thread_templates', 'template_id'),
    (3, 'companies.fund_id → companies (self-ref)',
        'companies_fund_id_fkey',      'companies','companies',        'fund_id')
  ) AS v(n, lbl, constraint_name, src, tgt, col)
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §6  Row Level Security enabled
-- ═══════════════════════════════════════════════════════════════════════════════

s6 AS (
  SELECT 60 + n AS k, '§6 RLS enabled' AS sec,
         tbl || '  (rowsecurity = true)' AS chk,
         COALESCE((SELECT rowsecurity FROM rls WHERE tablename = tbl), false) AS ok,
         'RLS is OFF on ' || tbl AS why
  FROM (VALUES
    (1, 'activity_categories'),
    (2, 'companies'),
    (3, 'threads'),
    (4, 'tasks'),
    (5, 'thread_templates'),
    (6, 'profiles')
  ) AS v(n, tbl)
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §7  Policies added by migration 012 must EXIST
-- ═══════════════════════════════════════════════════════════════════════════════

s7 AS (
  SELECT 70 + n AS k, '§7 Policies present (012)' AS sec, lbl AS chk,
         EXISTS (
           SELECT 1 FROM pols
           WHERE  tablename   = tbl
             AND  policyname  = pol
             AND  cmd         = op
             AND  for_auth    = TRUE
         ) AS ok,
         format('Policy "%s" on %s not found', pol, tbl) AS why
  FROM (VALUES
    -- activity_categories
    (1, 'activity_categories  categories_select  (authenticated SELECT)',
        'activity_categories', 'categories_select',  'SELECT'),
    (2, 'activity_categories  categories_insert  (authenticated INSERT)',
        'activity_categories', 'categories_insert',  'INSERT'),
    (3, 'activity_categories  categories_update  (authenticated UPDATE)',
        'activity_categories', 'categories_update',  'UPDATE'),
    (4, 'activity_categories  categories_delete  (authenticated DELETE)',
        'activity_categories', 'categories_delete',  'DELETE'),
    -- companies
    (5, 'companies  companies_select  (authenticated SELECT)',
        'companies', 'companies_select',  'SELECT'),
    (6, 'companies  companies_insert  (authenticated INSERT)',
        'companies', 'companies_insert',  'INSERT'),
    (7, 'companies  companies_update  (authenticated UPDATE)',
        'companies', 'companies_update',  'UPDATE'),
    (8, 'companies  companies_delete  (authenticated DELETE)',
        'companies', 'companies_delete',  'DELETE')
  ) AS v(n, lbl, tbl, pol, op)
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §8  Conflicting legacy policies must NOT exist
--     Migration 012 creates restrictive gp/associate write policies but
--     does NOT drop the fully-open authenticated write policies from 009.
--     If those old policies remain they silently override the restriction.
-- ═══════════════════════════════════════════════════════════════════════════════

s8 AS (
  SELECT 80 + n AS k, '§8 Conflicting old policies ABSENT' AS sec, lbl AS chk,
         NOT EXISTS (
           SELECT 1 FROM pols
           WHERE  tablename  = tbl
             AND  policyname = pol
             AND  for_auth   = TRUE
         ) AS ok,
         format(
           'SECURITY RISK: policy "%s" on %s still exists and overrides the '
           'gp/associate restriction added by 012.  Run: '
           'DROP POLICY "%s" ON %s;',
           pol, tbl, pol, tbl
         ) AS why
  FROM (VALUES
    (1, 'activity_categories  activity_categories_auth_insert  (open write from 009)',
        'activity_categories', 'activity_categories_auth_insert'),
    (2, 'activity_categories  activity_categories_auth_update  (open write from 009)',
        'activity_categories', 'activity_categories_auth_update'),
    (3, 'activity_categories  activity_categories_auth_delete  (open write from 009)',
        'activity_categories', 'activity_categories_auth_delete'),
    (4, 'companies  companies_auth_insert  (open write from 009)',
        'companies', 'companies_auth_insert'),
    (5, 'companies  companies_auth_update  (open write from 009)',
        'companies', 'companies_auth_update'),
    (6, 'companies  companies_auth_delete  (open write from 009)',
        'companies', 'companies_auth_delete')
  ) AS v(n, lbl, tbl, pol)
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §9  Seed data — activity_categories (15 canonical rows + macro_category)
-- ═══════════════════════════════════════════════════════════════════════════════

s9 AS (
  SELECT 90 + n AS k, '§9 Seed: categories' AS sec,
         format('%-26s → %s', cat, macro) AS chk,
         EXISTS (
           SELECT 1 FROM activity_categories
           WHERE  name = cat AND macro_category = macro
         ) AS ok,
         (
           SELECT CASE
             WHEN NOT EXISTS (SELECT 1 FROM activity_categories WHERE name = cat)
               THEN 'Row not found'
             ELSE 'macro_category = ' || COALESCE(
                    (SELECT macro_category FROM activity_categories WHERE name = cat LIMIT 1),
                    'NULL'
                  ) || '  (expected: ' || macro || ')'
           END
         ) AS why
  FROM (VALUES
    ( 1, 'Legal & Compliance',    'Fund Operations'),
    ( 2, 'Administration',        'Fund Operations'),
    ( 3, 'Pipeline',              'Investing'),
    ( 4, 'Scouting',              'Investing'),
    ( 5, 'Due Diligence & Legal', 'Investing'),
    ( 6, 'Valuation',             'Investing'),
    ( 7, 'Info Memo',             'Investing'),
    ( 8, 'Board Approval',        'Investing'),
    ( 9, 'Portfolio Monitoring',  'Portfolio Management'),
    (10, 'Model Updates',         'Portfolio Management'),
    (11, 'Advisor Relations',     'Portfolio Management'),
    (12, 'LP Reporting',          'Reporting'),
    (13, 'Reporting to LPs',      'Reporting'),
    (14, 'IC / Board Docs',       'Governance'),
    (15, 'Other',                 'Governance')
  ) AS v(n, cat, macro)
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §10  Seed data — companies
-- ═══════════════════════════════════════════════════════════════════════════════

s10 AS (
  -- At least one SGR company was seeded
  SELECT 101 AS k, '§10 Seed: companies' AS sec,
         'At least one company with type = sgr' AS chk,
         EXISTS (SELECT 1 FROM companies WHERE type = 'sgr') AS ok,
         'No company with type=sgr found; migration 012 INSERT may have failed' AS why
  UNION ALL
  -- No deprecated 'other' type remains
  SELECT 102, '§10 Seed: companies',
         'No company with deprecated type = other',
         NOT EXISTS (SELECT 1 FROM companies WHERE type = 'other'),
         (SELECT count(*)::text || ' row(s) still have type=other'
          FROM companies WHERE type = 'other')
  UNION ALL
  -- No deprecated 'general' type remains (pre-mig-004 artefact)
  SELECT 103, '§10 Seed: companies',
         'No company with deprecated type = general',
         NOT EXISTS (SELECT 1 FROM companies WHERE type = 'general'),
         (SELECT count(*)::text || ' row(s) still have type=general'
          FROM companies WHERE type = 'general')
  UNION ALL
  -- fund_id self-references point only at type='fund' rows
  SELECT 104, '§10 Seed: companies',
         'companies.fund_id only references type=fund rows',
         NOT EXISTS (
           SELECT 1 FROM companies c
           WHERE  c.fund_id IS NOT NULL
             AND  NOT EXISTS (
               SELECT 1 FROM companies f
               WHERE  f.id = c.fund_id AND f.type = 'fund'
             )
         ),
         (SELECT count(*)::text ||
                 ' row(s) have fund_id pointing at a non-fund company'
          FROM companies c
          WHERE c.fund_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM companies f
              WHERE f.id = c.fund_id AND f.type = 'fund'
            )
         )
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §11  Seed data — thread_templates (4 canonical templates)
-- ═══════════════════════════════════════════════════════════════════════════════

s11 AS (
  -- Existence + description filled
  SELECT 110 + n AS k, '§11 Seed: templates' AS sec,
         format('"%s"  exists with description', tpl) AS chk,
         EXISTS (
           SELECT 1 FROM thread_templates
           WHERE  name = tpl AND description IS NOT NULL AND description <> ''
         ) AS ok,
         CASE
           WHEN NOT EXISTS (SELECT 1 FROM thread_templates WHERE name = tpl)
             THEN 'Template not found'
           WHEN EXISTS (SELECT 1 FROM thread_templates
                        WHERE name = tpl AND (description IS NULL OR description = ''))
             THEN 'Template exists but description is NULL or empty'
         END AS why
  FROM (VALUES
    (1, 'Board Approval Process'),
    (2, 'Investment Process'),
    (3, 'LP Reporting'),
    (4, 'Portfolio Review')
  ) AS v(n, tpl)
  UNION ALL
  -- Exact step count
  SELECT 120 + n AS k, '§11 Seed: templates',
         format('"%s"  has exactly %s steps', tpl, expected) AS chk,
         (SELECT step_count FROM tpl_steps WHERE tpl_name = tpl) = expected AS ok,
         format('Expected %s steps, got %s',
           expected,
           COALESCE(
             (SELECT step_count::text FROM tpl_steps WHERE tpl_name = tpl),
             'template not found'
           )
         ) AS why
  FROM (VALUES
    (1, 'Board Approval Process', 9),
    (2, 'Investment Process',     6),
    (3, 'LP Reporting',           4),
    (4, 'Portfolio Review',       4)
  ) AS v(n, tpl, expected)
  UNION ALL
  -- All steps have the four required JSON keys
  SELECT 130 + n AS k, '§11 Seed: templates',
         format('"%s"  every step has order/title/description/default_category', tpl) AS chk,
         COALESCE(
           (SELECT all_keys_present FROM tpl_steps WHERE tpl_name = tpl),
           false
         ) AS ok,
         'One or more steps missing required keys (order, title, description, default_category)' AS why
  FROM (VALUES
    (1, 'Board Approval Process'),
    (2, 'Investment Process'),
    (3, 'LP Reporting'),
    (4, 'Portfolio Review')
  ) AS v(n, tpl)
  UNION ALL
  -- No stale pre-012 template names remain (012 used TRUNCATE)
  SELECT 141, '§11 Seed: templates',
         'Pre-012 template names are gone (Board Meeting Prep, Board Deck, etc.)' AS chk,
         NOT EXISTS (
           SELECT 1 FROM thread_templates
           WHERE  name IN (
             'Board Meeting Prep', 'Board Deck',
             'New Portfolio Company Onboarding', 'Capital Call',
             'Fund Closing', 'Valuation Update', 'Co-investment',
             'Exit Process', 'Regulatory Filing'
           )
         ) AS ok,
         'Pre-012 templates still present — TRUNCATE may not have run' AS why
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- §12  Data integrity
-- ═══════════════════════════════════════════════════════════════════════════════

s12 AS (
  -- No tasks reference a non-existent thread
  SELECT 151 AS k, '§12 Data integrity' AS sec,
         'No orphan tasks (tasks.thread_id → missing thread)' AS chk,
         NOT EXISTS (
           SELECT 1 FROM tasks t
           WHERE  t.thread_id IS NOT NULL
             AND  NOT EXISTS (SELECT 1 FROM threads th WHERE th.id = t.thread_id)
         ) AS ok,
         (SELECT count(*)::text || ' task(s) reference a non-existent thread_id'
          FROM tasks t
          WHERE t.thread_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM threads th WHERE th.id = t.thread_id)
         ) AS why
  UNION ALL
  -- No tasks have an invalid status value
  SELECT 152, '§12 Data integrity',
         'All tasks.status IN (Open | In Progress | In Review | Done)',
         NOT EXISTS (
           SELECT 1 FROM tasks
           WHERE  status NOT IN ('Open','In Progress','In Review','Done')
         ),
         (SELECT count(*)::text || ' task(s) have an unrecognised status value'
          FROM tasks WHERE status NOT IN ('Open','In Progress','In Review','Done')
         )
  UNION ALL
  -- All thread.status values are valid
  SELECT 153, '§12 Data integrity',
         'All threads.status IN (active | completed | archived)',
         NOT EXISTS (
           SELECT 1 FROM threads
           WHERE  status NOT IN ('active','completed','archived')
         ),
         (SELECT count(*)::text ||
                 ' thread(s) have an invalid status — default was ''active'' so this '
                 'likely means NULL values exist'
          FROM threads WHERE status NOT IN ('active','completed','archived')
         )
  UNION ALL
  -- threads.template_id references a real template (if set)
  SELECT 154, '§12 Data integrity',
         'No threads reference a missing template_id',
         NOT EXISTS (
           SELECT 1 FROM threads th
           WHERE  th.template_id IS NOT NULL
             AND  NOT EXISTS (
               SELECT 1 FROM thread_templates tt WHERE tt.id = th.template_id
             )
         ),
         (SELECT count(*)::text || ' thread(s) reference a non-existent template_id'
          FROM threads th
          WHERE th.template_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM thread_templates tt WHERE tt.id = th.template_id
            )
         )
  UNION ALL
  -- tasks.assignee_id references a real profile (if set)
  SELECT 155, '§12 Data integrity',
         'No tasks reference a missing assignee profile',
         NOT EXISTS (
           SELECT 1 FROM tasks t
           WHERE  t.assignee_id IS NOT NULL
             AND  NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.assignee_id)
         ),
         (SELECT count(*)::text || ' task(s) reference an assignee_id not in profiles'
          FROM tasks t
          WHERE t.assignee_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.assignee_id)
         )
  UNION ALL
  -- thread_steps table is truly gone (double-check; the DO block was conditional)
  SELECT 156, '§12 Data integrity',
         'thread_steps table no longer present (re-verify)',
         NOT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE  table_schema = 'public' AND table_name = 'thread_steps'
         ),
         'thread_steps table still exists — the DO $$ migration block may have been '
         'skipped because the table was not found at migration time'
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- Combine all checks
-- ═══════════════════════════════════════════════════════════════════════════════

all_checks AS (
  SELECT k, sec, chk, ok, why FROM s1
  UNION ALL SELECT k, sec, chk, ok, why FROM s2
  UNION ALL SELECT k, sec, chk, ok, why FROM s3
  UNION ALL SELECT k, sec, chk, ok, why FROM s4
  UNION ALL SELECT k, sec, chk, ok, why FROM s5
  UNION ALL SELECT k, sec, chk, ok, why FROM s6
  UNION ALL SELECT k, sec, chk, ok, why FROM s7
  UNION ALL SELECT k, sec, chk, ok, why FROM s8
  UNION ALL SELECT k, sec, chk, ok, why FROM s9
  UNION ALL SELECT k, sec, chk, ok, why FROM s10
  UNION ALL SELECT k, sec, chk, ok, why FROM s11
  UNION ALL SELECT k, sec, chk, ok, why FROM s12
),

totals AS (
  SELECT
    count(*) FILTER (WHERE     ok) AS passed,
    count(*) FILTER (WHERE NOT ok) AS failed,
    count(*)                       AS total
  FROM all_checks
)

-- ── final output ──────────────────────────────────────────────────────────────
-- Failures first (ordered by section), summary row last.
-- Remove the WHERE clause to see all checks.

SELECT
  sec                                         AS section,
  chk                                         AS check,
  CASE WHEN ok THEN '✓ PASS' ELSE '✗ FAIL' END AS status,
  CASE WHEN ok THEN ''        ELSE why        END AS detail
FROM all_checks
WHERE NOT ok          -- ← remove this line to see every check

UNION ALL

SELECT
  '━━ SUMMARY ━━',
  passed::text || ' passed  /  ' || failed::text || ' failed  /  ' || total::text || ' total',
  CASE WHEN failed = 0 THEN '✓ ALL PASS' ELSE '✗ ' || failed::text || ' FAILURE(S)' END,
  CASE WHEN failed = 0 THEN 'Migration 012 applied cleanly.'
       ELSE 'Fix the failures above before using the application.'
  END
FROM totals

ORDER BY 1, 2;
