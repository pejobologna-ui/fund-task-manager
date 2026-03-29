import { useState, useEffect, useMemo } from 'react'
import { createTaskWithShares } from '../hooks/useTasks'
import { useAuth } from '../context/AuthContext'
import { PRIORITIES, STATUSES } from '../constants'
import SharePicker, { EVERYONE } from './SharePicker'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Group categories by macro_category for <optgroup> rendering */
function groupCategories(categories) {
  const order = ['Fund Operations', 'Investing', 'Portfolio Management', 'Reporting', 'Governance']
  const groups = {}
  categories.forEach(c => {
    const key = c.macro_category ?? 'Other'
    ;(groups[key] ??= []).push(c)
  })
  // Sort groups by canonical order, then alphabetically for unknowns
  const sortedKeys = [
    ...order.filter(k => groups[k]),
    ...Object.keys(groups).filter(k => !order.includes(k)).sort(),
  ]
  return sortedKeys.map(key => ({ label: key, cats: groups[key] }))
}

/** Build company option groups: SGR → per fund → unassigned */
function groupCompanies(companies) {
  const sgr         = companies.filter(c => c.type === 'sgr')
  const funds       = companies.filter(c => c.type === 'fund')
  const withFund    = companies.filter(c => c.fund_id && c.type !== 'fund')
  const unassigned  = companies.filter(c => !c.fund_id && c.type !== 'fund' && c.type !== 'sgr')

  const groups = []
  if (sgr.length)      groups.push({ label: 'SGR',        items: sgr })
  funds.forEach(fund => {
    const children = withFund.filter(c => c.fund_id === fund.id)
    if (children.length) groups.push({ label: fund.name, items: children })
  })
  if (unassigned.length) groups.push({ label: 'Unassigned', items: unassigned })
  return groups
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewTaskModal({
  presetCategory, navFilter, onClose, onCreated,
  categories = [], threads = [], companies = [], users = [], profiles = [],
  lookupsLoading = false,
  /** When set (from ThreadPage), pre-fills + locks thread + company */
  threadContext = null,
  /** Thread templates array for soft category hint */
  templates = [],
}) {
  const { session } = useAuth()

  const [form, setForm] = useState({
    title:       '',
    description: '',
    category_id: '',
    thread_id:   '',
    company_id:  '',
    assignee_id: '',
    priority:    'Medium',
    status:      'Open',
    due_date:    '',
  })
  const [companyLockedByThread, setCompanyLockedByThread] = useState(false)
  const [shareWith, setShareWith] = useState([EVERYONE])
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState(null)
  const [defaultsApplied, setDefaultsApplied] = useState(false)

  // Apply threadContext lock on mount
  useEffect(() => {
    if (!threadContext) return
    setForm(f => ({
      ...f,
      thread_id:  threadContext.id  ?? '',
      company_id: threadContext.company?.id ?? '',
    }))
    setCompanyLockedByThread(true)
  }, [threadContext?.id])

  // Apply presetCategory + navFilter defaults once lookups load
  if (!defaultsApplied && categories.length > 0) {
    const updates = {}
    if (presetCategory) {
      const found = categories.find(c => c.name === presetCategory)
      if (found) updates.category_id = found.id
    }
    if (navFilter) {
      if (navFilter.type === 'category' && !updates.category_id) updates.category_id = navFilter.id
      if (navFilter.type === 'company') updates.company_id = navFilter.id
    }
    if (Object.keys(updates).length > 0) setForm(f => ({ ...f, ...updates }))
    setDefaultsApplied(true)
  }

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function handleThreadChange(threadId) {
    set('thread_id', threadId)
    if (!threadId) {
      // Clear lock only if not locked by threadContext
      if (!threadContext) setCompanyLockedByThread(false)
      return
    }
    const thread = threads.find(t => t.id === threadId)
    if (thread?.company?.id) {
      set('company_id', thread.company.id)
      setCompanyLockedByThread(true)
    } else {
      if (!threadContext) setCompanyLockedByThread(false)
    }
  }

  // Soft category hint: fires when selected category is not in thread's template defaults
  const categoryHint = useMemo(() => {
    if (!form.thread_id || !form.category_id || !templates.length) return null
    const thread = threads.find(t => t.id === form.thread_id)
    if (!thread?.template_id) return null
    const tpl = templates.find(t => t.id === thread.template_id)
    if (!tpl) return null
    const expectedCatNames = new Set(
      (tpl.steps ?? []).map(s => s.default_category).filter(Boolean)
    )
    if (!expectedCatNames.size) return null
    const selectedCat = categories.find(c => c.id === form.category_id)
    if (selectedCat && !expectedCatNames.has(selectedCat.name)) {
      return `Heads up: "${selectedCat.name}" isn't a typical category for this thread. Typical: ${[...expectedCatNames].join(', ')}.`
    }
    return null
  }, [form.thread_id, form.category_id, threads, templates, categories])

  async function handleSave() {
    if (!form.title.trim()) { setErr('Title is required.'); return }

    const isEveryone = shareWith.includes(EVERYONE)
    const visibility = isEveryone ? 'team' : shareWith.length > 0 ? 'restricted' : 'personal'
    const shareIds   = isEveryone ? [] : shareWith

    setSaving(true)
    setErr(null)
    const { data, error } = await createTaskWithShares({ ...form, visibility }, shareIds)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onCreated(data)
  }

  const categoryGroups = useMemo(() => groupCategories(categories), [categories])
  const companyGroups  = useMemo(() => groupCompanies(companies), [companies])

  // Filter threads: show only active (or all if no status column), optionally filtered by company
  const visibleThreads = useMemo(() => {
    const active = threads.filter(t => !t.status || t.status === 'active')
    // If a company is selected and NOT locked by thread (locking changes company, not filter),
    // only show threads for that company or threads with no company
    if (form.company_id && !companyLockedByThread && !threadContext) {
      return active.filter(t => !t.company_id || t.company_id === form.company_id)
    }
    return active
  }, [threads, form.company_id, companyLockedByThread, threadContext])

  const isThreadLocked   = !!threadContext
  const isCompanyLocked  = companyLockedByThread

  const peopleList = profiles.length > 0 ? profiles : users.map(u => ({ ...u, full_name: u.name }))
  const shareableProfiles = peopleList.filter(p => p.id !== session?.user?.id)

  return (
    <div className="ftm-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ftm-modal">
        <div className="ftm-mhdr">
          <span className="ftm-mtitle">New task</span>
          <button className="ftm-dclose" onClick={onClose}>×</button>
        </div>

        <div className="ftm-mbody">
          {lookupsLoading ? (
            <div className="ftm-loading">Loading…</div>
          ) : (
            <div className="ftm-fgrid">

              {/* Title */}
              <div className="ftm-ff full">
                <label className="ftm-flbl">Title <span style={{ color: '#a32d2d' }}>*</span></label>
                <input
                  className="ftm-finput"
                  placeholder="Task title…"
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
              </div>

              {/* Category — grouped by macro_category */}
              <div className="ftm-ff">
                <label className="ftm-flbl">Category</label>
                <select
                  className="ftm-fsel"
                  value={form.category_id}
                  onChange={e => set('category_id', e.target.value)}
                >
                  <option value="">— None —</option>
                  {categoryGroups.map(({ label, cats }) => (
                    <optgroup key={label} label={label}>
                      {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                {categoryHint && (
                  <div className="ftm-field-hint">{categoryHint}</div>
                )}
              </div>

              {/* Thread — active only, filtered by company if set */}
              <div className="ftm-ff">
                <label className="ftm-flbl">Thread</label>
                <select
                  className={`ftm-fsel${isThreadLocked ? ' ftm-field-locked' : ''}`}
                  value={form.thread_id}
                  onChange={e => handleThreadChange(e.target.value)}
                  disabled={isThreadLocked}
                >
                  <option value="">— No thread —</option>
                  {visibleThreads.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {isThreadLocked && (
                  <div className="ftm-field-note">Inherited from thread</div>
                )}
              </div>

              {/* Company — grouped by type/fund */}
              <div className="ftm-ff">
                <label className="ftm-flbl">Company</label>
                <select
                  className={`ftm-fsel${isCompanyLocked ? ' ftm-field-locked' : ''}`}
                  value={form.company_id}
                  onChange={e => set('company_id', e.target.value)}
                  disabled={isCompanyLocked}
                >
                  <option value="">— General / No company —</option>
                  {companyGroups.map(({ label, items }) => (
                    <optgroup key={label} label={label}>
                      {items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                {isCompanyLocked && !isThreadLocked && (
                  <div className="ftm-field-note">Inherited from thread</div>
                )}
              </div>

              {/* Status */}
              <div className="ftm-ff">
                <label className="ftm-flbl">Status</label>
                <select className="ftm-fsel" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* Priority */}
              <div className="ftm-ff">
                <label className="ftm-flbl">Priority</label>
                <select className="ftm-fsel" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              {/* Assignee — only show users with UUID IDs (profiles), not legacy text IDs */}
              <div className="ftm-ff">
                <label className="ftm-flbl">Assignee</label>
                <select className="ftm-fsel" value={form.assignee_id} onChange={e => set('assignee_id', e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {users.filter(u => !u._legacy).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>

              {/* Due date */}
              <div className="ftm-ff">
                <label className="ftm-flbl">Due date</label>
                <input
                  className="ftm-finput"
                  type="date"
                  value={form.due_date}
                  onChange={e => set('due_date', e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="ftm-ff full">
                <label className="ftm-flbl">Description</label>
                <textarea
                  className="ftm-fta"
                  placeholder="Optional…"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>

              {/* Visibility / Share picker */}
              <div className="ftm-ff full">
                <label className="ftm-flbl">Shared with</label>
                <SharePicker
                  selected={shareWith}
                  onChange={setShareWith}
                  profiles={shareableProfiles}
                />
              </div>

              {err && <div className="ftm-ff full" style={{ color: '#a32d2d', fontSize: 11 }}>{err}</div>}
            </div>
          )}
        </div>

        <div className="ftm-mftr">
          <button className="ftm-gbtn" onClick={onClose}>Cancel</button>
          <button className="ftm-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  )
}
