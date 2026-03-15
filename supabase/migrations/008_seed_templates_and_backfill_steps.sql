-- ============================================================
-- Migration 008 — Full template seed + backfill existing thread steps
-- ============================================================
-- 1. Add UNIQUE constraint on thread_templates.name (safe dedup first)
-- 2. Upsert all standard VC templates
-- 3. Backfill steps for existing threads that have none, matching
--    by thread name via ILIKE patterns
-- ============================================================


-- ── 0. Deduplicate thread_templates on name ───────────────────
-- Keep the row with the latest id per name (in case migrations ran
-- more than once without a unique constraint).
DELETE FROM thread_templates
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM thread_templates
  ORDER BY name, id DESC
);

-- Add unique constraint so future upserts are clean
ALTER TABLE thread_templates
  ADD CONSTRAINT IF NOT EXISTS thread_templates_name_key UNIQUE (name);


-- ── 1. Upsert all templates ───────────────────────────────────

-- Investment Process
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Investment Process',
  'Deal Flow',
  '[
    {"title": "Initial screening", "description": "Review deck and financials for fit with thesis"},
    {"title": "First meeting",     "description": "First call or in-person with founding team"},
    {"title": "IC memo",           "description": "Draft investment committee memorandum"},
    {"title": "Due diligence",     "description": "Assign and complete all DD workstreams"},
    {"title": "Term sheet",        "description": "Issue and negotiate term sheet"},
    {"title": "Legal closing",     "description": "SPA, cap-table update, wire transfer"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- Board Deck
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Board Deck',
  'Portfolio Monitoring',
  '[
    {"title": "Collect materials",    "description": "Gather financials, KPIs, and key milestones from portfolio company"},
    {"title": "Draft slides",         "description": "Build slide deck with narrative, charts, and appendix"},
    {"title": "Internal review",      "description": "Partner review of draft deck"},
    {"title": "Share with board",     "description": "Distribute deck to board members ahead of meeting"},
    {"title": "Incorporate feedback", "description": "Revise deck based on board and management comments"},
    {"title": "Final version",        "description": "Lock final deck and archive"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- Board Meeting Prep (keep existing, canonicalise steps)
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Board Meeting Prep',
  'Board Approval',
  '[
    {"title": "Collect board materials",  "description": "Gather financials, KPIs, and updates from portfolio company"},
    {"title": "Internal pre-read",        "description": "Circulate materials to all partners"},
    {"title": "Draft resolutions",        "description": "Prepare any formal resolutions needed"},
    {"title": "Board meeting",            "description": "Attend and take minutes"},
    {"title": "Follow-up actions",        "description": "Distribute minutes and track action items"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- LP Reporting
INSERT INTO thread_templates (name, category, steps) VALUES (
  'LP Reporting',
  'Investor Relations',
  '[
    {"title": "Data collection",  "description": "Gather valuations, KPIs and financials from portfolio companies"},
    {"title": "Draft",            "description": "Write the quarterly narrative and populate financials"},
    {"title": "Internal review",  "description": "Partner sign-off round"},
    {"title": "Send",             "description": "Distribute via fund admin portal"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- Portfolio Review
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Portfolio Review',
  'Portfolio Monitoring',
  '[
    {"title": "KPI collection",   "description": "Collect monthly / quarterly KPIs from each portfolio company"},
    {"title": "Financial update", "description": "Update fund model with latest financials"},
    {"title": "Board deck",       "description": "Prepare portfolio review slide deck"},
    {"title": "Review call",      "description": "Internal or LP-facing portfolio review call"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- New Portfolio Company Onboarding
INSERT INTO thread_templates (name, category, steps) VALUES (
  'New Portfolio Company Onboarding',
  'Portfolio Monitoring',
  '[
    {"title": "Cap table setup",              "description": "Record investment in fund model and cap table tool"},
    {"title": "Data room access",             "description": "Ensure fund team has access to company data room"},
    {"title": "Introduce portfolio services", "description": "Connect company to fund talent, legal, and finance network"},
    {"title": "Reporting cadence agreed",     "description": "Set monthly / quarterly KPI reporting expectations"},
    {"title": "First board seat",             "description": "Confirm board observer or director rights"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- Capital Call
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Capital Call',
  'Fund Operations',
  '[
    {"title": "Draft notice",         "description": "Prepare capital call notice with amount, purpose, and wire instructions"},
    {"title": "LP notification",      "description": "Send capital call notice to all LPs with 10-business-day notice"},
    {"title": "Wire collection",      "description": "Track and confirm wire receipts from each LP by due date"},
    {"title": "Deploy capital",       "description": "Wire funds to portfolio company or investment target"},
    {"title": "Confirmation letters", "description": "Issue funding confirmation and capital account statements to LPs"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- Fund Closing
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Fund Closing',
  'Fund Operations',
  '[
    {"title": "LP commitments confirmed", "description": "Finalise LP commitment letters and target fund size"},
    {"title": "Legal docs drafted",       "description": "LPA, subscription agreements, and side letters prepared"},
    {"title": "Regulatory filings",       "description": "Submit fund registration and compliance filings"},
    {"title": "First close",              "description": "Execute first close and accept initial LP capital"},
    {"title": "Final close",              "description": "Execute final close and send welcome pack to all LPs"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- Valuation Update
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Valuation Update',
  'Portfolio Monitoring',
  '[
    {"title": "Request financials", "description": "Collect latest financials and KPIs from portfolio company"},
    {"title": "Update model",       "description": "Refresh valuation model with new data and comparables"},
    {"title": "Partner review",     "description": "Internal partner review and sign-off on methodology"},
    {"title": "Auditor sign-off",   "description": "Submit valuations to fund auditors for review"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- Co-investment
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Co-investment',
  'Deal Flow',
  '[
    {"title": "Opportunity memo",    "description": "Prepare co-investment opportunity summary for LPs"},
    {"title": "LP notification",     "description": "Send opportunity to eligible co-investment LPs"},
    {"title": "Commitments received","description": "Collect and confirm LP co-investment amounts"},
    {"title": "Documentation",       "description": "Prepare and circulate co-investment agreements"},
    {"title": "Closing",             "description": "Execute closing documents and transfer LP funds"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- Exit Process
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Exit Process',
  'Deal Flow',
  '[
    {"title": "Mandate signed",      "description": "Engage banker or advisor and sign mandate"},
    {"title": "Buyer outreach",      "description": "Run process and collect IOIs from strategic and financial buyers"},
    {"title": "LOI received",        "description": "Evaluate letters of intent and select preferred buyer"},
    {"title": "Due diligence",       "description": "Support buyer DD and manage data room"},
    {"title": "Purchase agreement",  "description": "Negotiate and sign SPA or merger agreement"},
    {"title": "Distribution",        "description": "Close transaction, receive proceeds, and distribute to LPs"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;

-- Regulatory Filing
INSERT INTO thread_templates (name, category, steps) VALUES (
  'Regulatory Filing',
  'Compliance',
  '[
    {"title": "Identify requirements", "description": "Confirm applicable filings (Form D, ADV, AIFMD, etc.) and deadlines"},
    {"title": "Prepare documents",     "description": "Draft and assemble required forms and supporting exhibits"},
    {"title": "Legal review",          "description": "Outside counsel review and sign-off"},
    {"title": "Submit filing",         "description": "File with relevant regulator and retain submission confirmation"},
    {"title": "Confirm receipt",       "description": "Obtain acknowledgement from regulator and update compliance log"}
  ]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  steps    = EXCLUDED.steps;


-- ── 2. Backfill steps for existing threads ────────────────────
-- Only inserts steps into threads that currently have zero steps.
-- Matching is done via ILIKE against the thread name.
-- Priority order: more specific patterns first (board deck before board).

DO $$
DECLARE
  t        RECORD;
  tpl_name text;
  tpl_row  RECORD;
  step_el  jsonb;
  i        integer;
BEGIN
  FOR t IN
    SELECT id, name
    FROM threads
    WHERE id NOT IN (SELECT DISTINCT thread_id FROM thread_steps)
  LOOP
    -- Map thread name → template name (first match wins)
    tpl_name :=
      CASE
        -- Deal flow / investment
        WHEN t.name ILIKE '%deal flow%'
          OR t.name ILIKE '%series a%'
          OR t.name ILIKE '%series b%'
          OR t.name ILIKE '%series c%'
          OR t.name ILIKE '%seed round%'
          OR t.name ILIKE '%pre-seed%'
          OR t.name ILIKE '%investment process%'
        THEN 'Investment Process'

        -- Board deck (check before generic "board")
        WHEN t.name ILIKE '%board deck%'
        THEN 'Board Deck'

        -- Board meeting prep
        WHEN t.name ILIKE '%board meeting%'
          OR t.name ILIKE '%board prep%'
          OR t.name ILIKE '%board materials%'
        THEN 'Board Meeting Prep'

        -- LP / investor reporting
        WHEN t.name ILIKE '%lp report%'
          OR t.name ILIKE '%investor report%'
          OR t.name ILIKE '%quarterly report%'
          OR t.name ILIKE '%q1 report%'
          OR t.name ILIKE '%q2 report%'
          OR t.name ILIKE '%q3 report%'
          OR t.name ILIKE '%q4 report%'
          OR t.name ILIKE '%annual report%'
        THEN 'LP Reporting'

        -- Portfolio review
        WHEN t.name ILIKE '%portfolio review%'
        THEN 'Portfolio Review'

        -- Capital call
        WHEN t.name ILIKE '%capital call%'
        THEN 'Capital Call'

        -- Fund closing
        WHEN t.name ILIKE '%fund clos%'
          OR t.name ILIKE '%fund i clos%'
          OR t.name ILIKE '%fund ii clos%'
          OR t.name ILIKE '%first clos%'
          OR t.name ILIKE '%final clos%'
        THEN 'Fund Closing'

        -- Valuation
        WHEN t.name ILIKE '%valuation%'
          OR t.name ILIKE '%fair value%'
        THEN 'Valuation Update'

        -- Exit
        WHEN t.name ILIKE '%exit%'
          OR t.name ILIKE '%sale process%'
          OR t.name ILIKE '%m&a%'
          OR t.name ILIKE '%acquisition%'
        THEN 'Exit Process'

        -- Co-investment
        WHEN t.name ILIKE '%co-invest%'
          OR t.name ILIKE '%coinvest%'
        THEN 'Co-investment'

        -- Regulatory
        WHEN t.name ILIKE '%regulat%'
          OR t.name ILIKE '%compliance%'
          OR t.name ILIKE '%form d%'
          OR t.name ILIKE '%form adv%'
        THEN 'Regulatory Filing'

        -- Onboarding
        WHEN t.name ILIKE '%onboard%'
          OR t.name ILIKE '%new portfolio%'
          OR t.name ILIKE '%portco onboard%'
        THEN 'New Portfolio Company Onboarding'

        ELSE NULL
      END;

    -- Skip if no template matched
    CONTINUE WHEN tpl_name IS NULL;

    -- Fetch the matching template's steps
    SELECT steps INTO tpl_row
    FROM thread_templates
    WHERE name = tpl_name
    LIMIT 1;

    CONTINUE WHEN tpl_row IS NULL;

    -- Insert one thread_step row per template step
    i := 0;
    FOR step_el IN SELECT * FROM jsonb_array_elements(tpl_row.steps)
    LOOP
      INSERT INTO thread_steps (thread_id, title, description, "order", status)
      VALUES (
        t.id,
        step_el->>'title',
        step_el->>'description',
        i,
        'pending'
      );
      i := i + 1;
    END LOOP;

  END LOOP;
END $$;
