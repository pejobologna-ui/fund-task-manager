export const CATEGORIES = [
  'Investment Process',
  'Portfolio Monitoring',
  'LP Reporting',
  'IC / Board Docs',
  'Legal & Compliance',
  'Advisor Relations',
  'Model Updates',
  'Other',
]

export const STATUSES = ['Open', 'In Progress', 'In Review', 'Done']
export const PRIORITIES = ['High', 'Medium', 'Low']

export const STATUS_CLASS = {
  'Open': 's-open',
  'In Progress': 's-prog',
  'In Review': 's-rev',
  'Done': 's-done',
}

export const PRIORITY_CLASS = {
  High: 'p-hi',
  Medium: 'p-md',
  Low: 'p-lo',
}

// Seed data — used to populate Supabase on first run (see supabase/seed.sql)
export const SEED_THREADS = [
  'Deal Flow — Series A',
  'Deal Flow — Seed',
  'Portfolio Review Q2',
  'LP Report H1 2025',
  'IC Meeting June',
  'Board Deck — PortCo A',
  'Legal — Fund II Closing',
  'Due Diligence — TechCo X',
]

export const SEED_COMPANIES = [
  { name: 'PortCo Alpha',           type: 'portfolio' },
  { name: 'PortCo Beta',            type: 'portfolio' },
  { name: 'PortCo Gamma',           type: 'portfolio' },
  { name: 'TechCo X (prospect)',    type: 'prospect'  },
  { name: 'HealthCo Y (prospect)',  type: 'prospect'  },
  { name: 'General (Fund)',         type: 'general'   },
]

export const SEED_USERS = [
  { id: 'PB', name: 'Pietro B.', role: 'General Partner' },
  { id: 'MA', name: 'Marco A.',  role: 'Associate'       },
  { id: 'SL', name: 'Sara L.',   role: 'Analyst'         },
  { id: 'FR', name: 'Fabio R.',  role: 'Analyst'         },
]
