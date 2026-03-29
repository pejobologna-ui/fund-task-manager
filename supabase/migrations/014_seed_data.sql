-- Migration 014: Re-seed categories, companies, and sample threads/tasks
-- Run after 013_restore_anon_policies.sql

BEGIN;

-- ── Categories ──────────────────────────────────────────────────────────────
INSERT INTO activity_categories (name, macro_category) VALUES
  ('Legal & Compliance',    'Fund Operations'),
  ('Administration',        'Fund Operations'),
  ('Pipeline',              'Investing'),
  ('Scouting',              'Investing'),
  ('Due Diligence & Legal', 'Investing'),
  ('Valuation',             'Investing'),
  ('Info Memo',             'Investing'),
  ('Board Approval',        'Investing'),
  ('Portfolio Monitoring',  'Portfolio Management'),
  ('Model Updates',         'Portfolio Management'),
  ('Advisor Relations',     'Portfolio Management'),
  ('LP Reporting',          'Reporting'),
  ('Reporting to LPs',      'Reporting'),
  ('IC / Board Docs',       'Governance'),
  ('Other',                 'Governance')
ON CONFLICT DO NOTHING;

-- ── Companies ───────────────────────────────────────────────────────────────
INSERT INTO companies (name, type) VALUES
  ('General', 'sgr')
ON CONFLICT DO NOTHING;

INSERT INTO companies (name, type) VALUES
  ('Fund I',  'fund'),
  ('Fund II', 'fund')
ON CONFLICT DO NOTHING;

-- Portfolio companies under Fund I
INSERT INTO companies (name, type, fund_id)
SELECT 'TechCorp Alpha', 'portfolio', id FROM companies WHERE name = 'Fund I' AND type = 'fund'
ON CONFLICT DO NOTHING;

INSERT INTO companies (name, type, fund_id)
SELECT 'GreenEnergy Beta', 'portfolio', id FROM companies WHERE name = 'Fund I' AND type = 'fund'
ON CONFLICT DO NOTHING;

-- Companies under Fund II
INSERT INTO companies (name, type, fund_id)
SELECT 'FinServ Gamma', 'prospect', id FROM companies WHERE name = 'Fund II' AND type = 'fund'
ON CONFLICT DO NOTHING;

INSERT INTO companies (name, type, fund_id)
SELECT 'HealthTech Delta', 'portfolio', id FROM companies WHERE name = 'Fund II' AND type = 'fund'
ON CONFLICT DO NOTHING;

-- ── Sample threads with tasks ───────────────────────────────────────────────

-- Thread 1: Board Approval for TechCorp
INSERT INTO threads (name, description, status, company_id)
SELECT 'Board Approval — TechCorp Alpha', 'Full board approval process for Series B investment', 'active', id
FROM companies WHERE name = 'TechCorp Alpha';

INSERT INTO tasks (title, description, thread_id, status, priority, "order", visibility, notes, company_id, category_id)
SELECT
  t.title, t.descr,
  th.id, t.status, 'Medium', t.ord, 'team', '', th.company_id, cat.id
FROM threads th
CROSS JOIN (VALUES
  ('Ask for data',           'Request all relevant data from the company',     'Done',        0, 'Board Approval'),
  ('Build model',            'Build or update the financial model',            'Done',        1, 'Valuation'),
  ('Map competitors',        'Competitive landscape analysis',                 'In Progress', 2, 'Due Diligence & Legal'),
  ('Q&A',                    'Q&A session with company management',            'Open',        3, 'Board Approval'),
  ('Info memo',              'Draft the investment information memorandum',     'Open',        4, 'Info Memo'),
  ('Share with compliance',  'Send memo to compliance for review',             'Open',        5, 'Legal & Compliance'),
  ('Receive approval',       'Receive compliance and IC approval',             'Open',        6, 'Board Approval'),
  ('Finalize deliberation',  'Finalize board deliberation documents',          'Open',        7, 'IC / Board Docs'),
  ('Sign BoD document',      'Obtain final signatures on the BoD document',    'Open',        8, 'IC / Board Docs')
) AS t(title, descr, status, ord, cat_name)
LEFT JOIN activity_categories cat ON cat.name = t.cat_name
WHERE th.name = 'Board Approval — TechCorp Alpha';

-- Thread 2: Deal Flow — Seed Round
INSERT INTO threads (name, description, status)
VALUES ('Deal Flow — Seed Round', 'Tracking early-stage deal pipeline', 'active');

INSERT INTO tasks (title, description, thread_id, status, priority, "order", visibility, notes, category_id)
SELECT
  t.title, t.descr,
  th.id, t.status, 'Medium', t.ord, 'team', '', cat.id
FROM threads th
CROSS JOIN (VALUES
  ('Initial screening',  'Review deck and financials',           'Done',        0, 'Pipeline'),
  ('First meeting',      'First call with founding team',        'In Progress', 1, 'Pipeline'),
  ('IC memo',            'Prepare IC memorandum',                'Open',        2, 'IC / Board Docs'),
  ('Due diligence',      'Full due diligence process',           'Open',        3, 'Due Diligence & Legal'),
  ('Term sheet',         'Draft and negotiate term sheet',       'Open',        4, 'Due Diligence & Legal'),
  ('Legal closing',      'Legal documentation and closing',      'Open',        5, 'Legal & Compliance')
) AS t(title, descr, status, ord, cat_name)
LEFT JOIN activity_categories cat ON cat.name = t.cat_name
WHERE th.name = 'Deal Flow — Seed Round';

-- Thread 3: LP Reporting Q1 (completed)
INSERT INTO threads (name, description, status)
VALUES ('LP Reporting Q1', 'Quarterly LP report for Q1 2026', 'completed');

INSERT INTO tasks (title, thread_id, status, priority, "order", visibility, notes, category_id)
SELECT
  t.title, th.id, 'Done', 'Medium', t.ord, 'team', '', cat.id
FROM threads th
CROSS JOIN (VALUES
  ('Data collection',  0, 'LP Reporting'),
  ('Draft',            1, 'LP Reporting'),
  ('Internal review',  2, 'LP Reporting'),
  ('Send',             3, 'Reporting to LPs')
) AS t(title, ord, cat_name)
LEFT JOIN activity_categories cat ON cat.name = t.cat_name
WHERE th.name = 'LP Reporting Q1';

-- ── Standalone tasks (not in any thread) ────────────────────────────────────
INSERT INTO tasks (title, status, priority, due_date, visibility, notes, category_id, company_id)
SELECT 'Review Fund II legal docs', 'Open', 'High', '2026-03-20', 'team', '', cat.id, co.id
FROM activity_categories cat, companies co
WHERE cat.name = 'Legal & Compliance' AND co.name = 'General';

INSERT INTO tasks (title, status, priority, due_date, visibility, notes, category_id)
SELECT 'Update portfolio KPIs', 'In Progress', 'Medium', '2026-03-25', 'team', '', id
FROM activity_categories WHERE name = 'Portfolio Monitoring';

INSERT INTO tasks (title, status, priority, visibility, notes, category_id)
SELECT 'Prepare IC deck for next meeting', 'Open', 'High', 'team', '', id
FROM activity_categories WHERE name = 'IC / Board Docs';

INSERT INTO tasks (title, status, priority, due_date, visibility, notes, category_id, company_id)
SELECT 'Annual compliance review', 'Open', 'Medium', '2026-04-01', 'team', '', cat.id, co.id
FROM activity_categories cat, companies co
WHERE cat.name = 'Legal & Compliance' AND co.name = 'General';

COMMIT;
