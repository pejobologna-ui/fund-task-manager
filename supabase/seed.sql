-- ============================================================
-- Fund Task Manager — seed data  (run after migration)
-- ============================================================

-- Users
insert into users (id, name, initials, role) values
  ('PB', 'Pietro B.', 'PB', 'General Partner'),
  ('MA', 'Marco A.',  'MA', 'Associate'),
  ('SL', 'Sara L.',   'SL', 'Analyst'),
  ('FR', 'Fabio R.',  'FR', 'Analyst')
on conflict (id) do nothing;

-- Categories
insert into categories (name) values
  ('Investment Process'),
  ('Portfolio Monitoring'),
  ('LP Reporting'),
  ('IC / Board Docs'),
  ('Legal & Compliance'),
  ('Advisor Relations'),
  ('Model Updates'),
  ('Other')
on conflict (name) do nothing;

-- Threads
insert into threads (name) values
  ('Deal Flow — Series A'),
  ('Deal Flow — Seed'),
  ('Portfolio Review Q2'),
  ('LP Report H1 2025'),
  ('IC Meeting June'),
  ('Board Deck — PortCo A'),
  ('Legal — Fund II Closing'),
  ('Due Diligence — TechCo X')
on conflict (name) do nothing;

-- Companies
insert into companies (name, type) values
  ('PortCo Alpha',          'portfolio'),
  ('PortCo Beta',           'portfolio'),
  ('PortCo Gamma',          'portfolio'),
  ('TechCo X (prospect)',   'prospect'),
  ('HealthCo Y (prospect)', 'prospect'),
  ('General (Fund)',        'general')
on conflict (name) do nothing;

-- Tasks  (using sub-selects to resolve FK ids)
insert into tasks (title, description, status, priority, due_date, category_id, thread_id, company_id, assignee_id, created_at)
select
  t.title, t.description, t.status, t.priority, t.due_date::date,
  (select id from categories where name = t.cat),
  (select id from threads   where name = t.thread),
  (select id from companies where name = t.company),
  t.asgn,
  t.created_at::timestamptz
from (values
  ('Review term sheet — TechCo X',    'Review and redline term sheet with legal on liquidation preference clause.',         'In Progress','High',  '2025-06-15','Investment Process',   'Deal Flow — Series A',      'TechCo X (prospect)',   'PB','2025-06-08'),
  ('Update financial model post-call','Incorporate revised ARR projections from founder call on Jun 12.',                    'Open',       'High',  '2025-06-14','Model Updates',        'Deal Flow — Series A',      'TechCo X (prospect)',   'MA','2025-06-10'),
  ('Q2 portfolio update — PortCo Alpha','Collect KPIs: MRR, headcount, runway. Request board pack from CEO.',               'In Progress','Medium','2025-06-20','Portfolio Monitoring', 'Portfolio Review Q2',       'PortCo Alpha',          'SL','2025-06-05'),
  ('Draft LP letter H1 2025',         'Semi-annual LP letter covering portfolio performance, exits, pipeline.',              'Open',       'High',  '2025-06-30','LP Reporting',         'LP Report H1 2025',         'General (Fund)',         'PB','2025-06-01'),
  ('IC memo — HealthCo Y',            'Full IC memo: market, team, financials, deal terms.',                                 'In Review',  'High',  '2025-06-18','IC / Board Docs',      'IC Meeting June',           'HealthCo Y (prospect)', 'MA','2025-06-07'),
  ('Request missing KPIs — PortCo Beta','Follow up with CFO on Q1 actuals: gross margin, CAC, churn.',                     'Open',       'Medium','2025-06-16','Portfolio Monitoring', 'Portfolio Review Q2',       'PortCo Beta',           'SL','2025-06-09'),
  ('Fund II closing docs — legal review','Coordinate with counsel on final LPA amendments.',                                 'Open',       'High',  '2025-06-12','Legal & Compliance',   'Legal — Fund II Closing',   'General (Fund)',         'FR','2025-06-03'),
  ('Board deck — PortCo Alpha June',  'Prepare slides for June board meeting.',                                              'Done',       'Medium','2025-06-10','IC / Board Docs',      'Board Deck — PortCo A',     'PortCo Alpha',          'MA','2025-05-28'),
  ('Advisor intro — industrial BD contact','Follow up on warm intro. Schedule 30-min call.',                                'Open',       'Low',   '2025-06-25','Advisor Relations',    'Deal Flow — Seed',          'General (Fund)',         'PB','2025-06-06'),
  ('Update cap table — PortCo Gamma', 'Post-conversion cap table update following bridge round close.',                     'Done',       'Medium','2025-06-08','Model Updates',        'Portfolio Review Q2',       'PortCo Gamma',          'FR','2025-06-01'),
  ('DD checklist — TechCo X',         'Track DD checklist: legal, financial, commercial, technical.',                       'In Progress','High',  '2025-06-17','Investment Process',   'Due Diligence — TechCo X',  'TechCo X (prospect)',   'SL','2025-06-08'),
  ('Review advisor engagement letter','Review engagement terms with placement agent for Fund II.',                           'Open',       'Low',   '2025-06-28','Legal & Compliance',   'Legal — Fund II Closing',   'General (Fund)',         'PB','2025-06-10')
) as t(title,description,status,priority,due_date,cat,thread,company,asgn,created_at);
