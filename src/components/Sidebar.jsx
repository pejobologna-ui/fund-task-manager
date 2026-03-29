import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useManage } from '../hooks/useTasks'

const TEAM_VIEWS = [
  { key: 'all',     label: 'All tasks',      color: '#b8933e' },
  { key: 'mine',    label: 'My tasks',       color: '#5dcaa5' },
  { key: 'overdue', label: 'Overdue',        color: '#e24b4a' },
  { key: 'week',    label: 'Due this week',  color: '#378add' },
]

const PERSONAL_VIEWS = [
  { key: 'personal', label: 'My personal tasks', color: '#9b71d4' },
  { key: 'shared',   label: 'Shared with me',    color: '#d47171' },
]

const ROLE_LABELS = {
  gp: 'General Partner', associate: 'Associate', analyst: 'Analyst', viewer: 'Viewer',
}

const MACRO_ORDER = [
  'Fund Operations', 'Investing', 'Portfolio Management', 'Reporting', 'Governance',
]

// ── localStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = 'ftm-sidebar-collapsed'
function loadCollapsed() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
function persistCollapsed(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* noop */ }
}

// ── Rename input (module-level to preserve focus) ────────────────────────────
function RenameInput({ inputRef, value, onChange, onCommit, onCancel }) {
  return (
    <input
      ref={inputRef}
      className="ftm-sinline-input"
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === 'Enter')  { e.preventDefault(); onCommit() }
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={onCommit}
    />
  )
}

// ── Context menu (portal) ────────────────────────────────────────────────────
function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const style = {
    position: 'fixed',
    top:  Math.min(y, window.innerHeight - 8 - (items.filter(i => i !== 'divider').length * 32 + 8)),
    left: Math.min(x, window.innerWidth  - 180 - 8),
    zIndex: 9999,
  }

  return createPortal(
    <div ref={ref} className="ftm-ctx-menu" style={style}>
      {items.map((item, i) =>
        item === 'divider'
          ? <div key={i} className="ftm-ctx-divider" />
          : (
            <button
              key={i}
              className={`ftm-ctx-item${item.danger ? ' danger' : ''}`}
              onClick={() => { onClose(); item.action() }}
            >
              {item.label}
            </button>
          )
      )}
    </div>,
    document.body
  )
}

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ label, collapsed, onToggle, onAdd, showGear }) {
  return (
    <div className="ftm-sheading" onClick={onToggle}>
      <span className="ftm-slabel" style={{ margin: 0 }}>{label}</span>
      {showGear && (
        <button
          className="ftm-snew-btn ftm-sgear-placeholder"
          title="Settings (coming soon)"
          onClick={e => e.stopPropagation()}
          style={{ opacity: 0.35, cursor: 'default' }}
        >⚙</button>
      )}
      {onAdd && (
        <button
          className="ftm-snew-btn"
          title={`Add ${label.toLowerCase()}`}
          onClick={e => { e.stopPropagation(); onAdd() }}
        >+</button>
      )}
      <span className={`ftm-schevron${collapsed ? ' closed' : ''}`}>▾</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sidebar
// ═══════════════════════════════════════════════════════════════════════════════
export default function Sidebar({
  view, onSetView, navFilter, onNavFilter, onOpenThread,
  onNewThread, onEditThread, onManage, onDataChanged,
  counts, allItems, threads: threadList, threadProgress, categories: lookupCategories,
  profile,
}) {
  const { signOut } = useAuth()
  const {
    categories: allCategories,
    companies:  allCompanies,
    funds,
    addCategory, renameCategory, deleteCategory,
    addCompany,  updateCompany,  deleteCompany,
    addFund,     renameFund,     deleteFund,
  } = useManage()

  // Use lookup categories if available (they have macro_category from the query)
  const catSource = lookupCategories?.length > 0 ? lookupCategories : allCategories

  // ── Collapse state (persisted) ────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  function toggle(key) {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      persistCollapsed(next)
      return next
    })
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState(null)
  function openCtx(e, items) {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }

  // ── Rename state ──────────────────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal]   = useState('')
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) renameInputRef.current.focus()
  }, [renamingId])

  function startRename(prefix, id, currentName) {
    setRenamingId(`${prefix}-${id}`)
    setRenameVal(currentName)
  }

  async function commitRename(prefix, id) {
    const v = renameVal.trim()
    if (v) {
      if (prefix === 'cat')  await renameCategory(id, v)
      if (prefix === 'co')   await updateCompany(id, { name: v })
      if (prefix === 'fund') await renameFund(id, v)
      onDataChanged?.()
    }
    setRenamingId(null)
    setRenameVal('')
  }

  function renameProps(prefix, id) {
    return {
      inputRef: renameInputRef,
      value:    renameVal,
      onChange: setRenameVal,
      onCommit: () => commitRename(prefix, id),
      onCancel: () => { setRenamingId(null); setRenameVal('') },
    }
  }

  // ── Quick-add state ───────────────────────────────────────────────────────
  const [quickAdd, setQuickAdd] = useState(null)
  const [quickVal, setQuickVal] = useState('')
  const quickInputRef  = useRef(null)
  const submittingRef  = useRef(false)

  useEffect(() => {
    if (quickAdd && quickInputRef.current) quickInputRef.current.focus()
  }, [quickAdd])

  function startQuickAdd(kind, fundId) {
    setQuickAdd({ kind, fundId })
    setQuickVal('')
    if (kind === 'category')        toggle('categories') // ensure expanded
    if (kind.startsWith('company')) toggle('companies')
    if (kind === 'company-in-fund' && fundId) {
      setCollapsed(prev => {
        const next = { ...prev, [`fund-${fundId}`]: false }
        persistCollapsed(next)
        return next
      })
    }
  }

  async function commitQuickAdd() {
    if (submittingRef.current) return
    const v = quickVal.trim()
    if (v && quickAdd) {
      submittingRef.current = true
      try {
        if (quickAdd.kind === 'category') await addCategory(v)
        else if (quickAdd.kind === 'company-fund-level') await addCompany({ name: v, type: 'sgr', fund_id: null })
        else if (quickAdd.kind === 'company-in-fund') await addCompany({ name: v, type: 'portfolio', fund_id: quickAdd.fundId })
        else if (quickAdd.kind === 'new-fund') await addFund(v)
      } finally { submittingRef.current = false }
    }
    setQuickAdd(null)
    setQuickVal('')
  }

  function cancelQuickAdd() { setQuickAdd(null); setQuickVal('') }

  function quickInput(placeholder) {
    return (
      <div className="ftm-quick-add-row">
        <input
          ref={quickInputRef}
          className="ftm-quick-add-input"
          placeholder={placeholder}
          value={quickVal}
          onChange={e => setQuickVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitQuickAdd(); if (e.key === 'Escape') cancelQuickAdd() }}
          onBlur={commitQuickAdd}
        />
      </div>
    )
  }

  // ── Navigation helpers ────────────────────────────────────────────────────
  function isNavActive(type, id) {
    return navFilter?.type === type && navFilter?.id === id
  }

  // ── Task counts ───────────────────────────────────────────────────────────
  const taskCountByCat = useMemo(() => {
    const m = {}
    ;(allItems ?? []).forEach(t => {
      if (t.status === 'Done' || !t.category?.id) return
      m[t.category.id] = (m[t.category.id] ?? 0) + 1
    })
    return m
  }, [allItems])

  const taskCountByCo = useMemo(() => {
    const m = {}
    ;(allItems ?? []).forEach(t => {
      if (t.status === 'Done' || !t.company?.id) return
      m[t.company.id] = (m[t.company.id] ?? 0) + 1
    })
    return m
  }, [allItems])

  // ── Derived data ──────────────────────────────────────────────────────────

  // Categories with count, optionally grouped by macro_category
  const categories = useMemo(() =>
    catSource.map(c => ({ ...c, count: taskCountByCat[c.id] ?? 0 }))
  , [catSource, taskCountByCat])

  const hasMacroCategories = categories.some(c => c.macro_category)

  const categoriesByMacro = useMemo(() => {
    if (!hasMacroCategories) return null
    const groups = {}
    categories.forEach(c => {
      const key = c.macro_category || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(c)
    })
    return groups
  }, [categories, hasMacroCategories])

  // Companies
  const sgrCompanies = useMemo(() =>
    allCompanies.filter(c => c.type === 'sgr')
  , [allCompanies])

  const sgrCount = useMemo(() =>
    sgrCompanies.reduce((sum, c) => sum + (taskCountByCo[c.id] ?? 0), 0)
  , [sgrCompanies, taskCountByCo])

  const companiesByFund = useMemo(() => {
    const m = {}
    allCompanies
      .filter(c => (c.type === 'portfolio' || c.type === 'prospect') && c.fund_id)
      .forEach(c => {
        if (!m[c.fund_id]) m[c.fund_id] = []
        m[c.fund_id].push({ ...c, count: taskCountByCo[c.id] ?? 0 })
      })
    return m
  }, [allCompanies, taskCountByCo])

  const companiesUnassigned = useMemo(() =>
    allCompanies
      .filter(c => (c.type === 'portfolio' || c.type === 'prospect') && !c.fund_id)
      .map(c => ({ ...c, count: taskCountByCo[c.id] ?? 0 }))
  , [allCompanies, taskCountByCo])

  // Threads: active vs archived
  const { activeThreads, archivedThreads } = useMemo(() => {
    const list = threadList ?? []
    const active = []
    const archived = []
    list.forEach(th => {
      const prog = threadProgress?.[th.id] ?? { done: 0, total: 0 }
      const entry = { ...th, done: prog.done, total: prog.total }
      if (th.status === 'completed' || th.status === 'archived') {
        archived.push(entry)
      } else {
        active.push(entry)
      }
    })
    return { activeThreads: active, archivedThreads: archived }
  }, [threadList, threadProgress])

  // Company context menu items
  function companyCtxItems(co) {
    const moveToFund = funds
      .filter(f => f.id !== co.fund_id)
      .map(f => ({
        label: `→ Move to ${f.name}`,
        action: () => updateCompany(co.id, { fund_id: f.id, type: co.type === 'sgr' ? 'portfolio' : co.type }),
      }))
    const moveToFundLevel = co.type !== 'sgr'
      ? [{ label: '→ Move to SGR', action: () => updateCompany(co.id, { type: 'sgr', fund_id: null }) }]
      : []
    const moveFromFundLevel = co.type === 'sgr' && funds.length > 0
      ? funds.map(f => ({
          label: `→ Move to ${f.name}`,
          action: () => updateCompany(co.id, { type: 'portfolio', fund_id: f.id }),
        }))
      : []

    return [
      { label: '✎ Rename', action: () => startRename('co', co.id, co.name) },
      ...(moveToFundLevel.length > 0 || moveFromFundLevel.length > 0 || moveToFund.length > 0
        ? ['divider', ...moveToFundLevel, ...moveFromFundLevel, ...moveToFund]
        : []),
      'divider',
      { label: '✕ Delete', danger: true, action: async () => { await deleteCompany(co.id); onDataChanged?.() } },
    ]
  }

  const displayName = profile?.full_name ?? '—'
  const initials    = profile?.initials  ?? '?'
  const roleLabel   = ROLE_LABELS[profile?.role] ?? profile?.role ?? ''

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <aside className="ftm-sidebar">
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <div className="ftm-brand">
        <div className="ftm-brand-name">Fund Manager</div>
        <div className="ftm-brand-sub">TASK TRACKER</div>
      </div>

      {/* ═══ §1 — TEAM ═══ */}
      <div className="ftm-snav">
        <SectionHeader label="Team" collapsed={collapsed.team} onToggle={() => toggle('team')} />
        {!collapsed.team && TEAM_VIEWS.map(v => (
          <div
            key={v.key}
            className={`ftm-sitem${view === v.key && !navFilter ? ' active' : ''}`}
            onClick={() => onSetView(v.key)}
          >
            <div className="ftm-sdot" style={{ background: v.color }} />
            {v.label}
            <span className="ftm-scnt">{counts[v.key] ?? 0}</span>
          </div>
        ))}
      </div>

      {/* ═══ §2 — PERSONAL ═══ */}
      <div className="ftm-snav">
        <SectionHeader label="Personal" collapsed={collapsed.personal} onToggle={() => toggle('personal')} />
        {!collapsed.personal && PERSONAL_VIEWS.map(v => (
          <div
            key={v.key}
            className={`ftm-sitem${view === v.key && !navFilter ? ' active' : ''}`}
            onClick={() => onSetView(v.key)}
          >
            <div className="ftm-sdot" style={{ background: v.color }} />
            {v.label}
            <span className="ftm-scnt">{counts[v.key] ?? 0}</span>
          </div>
        ))}
      </div>

      {/* ═══ §3 — THREADS ═══ */}
      <div className="ftm-snav">
        <SectionHeader
          label="Threads"
          collapsed={collapsed.threads}
          onToggle={() => toggle('threads')}
          onAdd={onNewThread}
        />
        {!collapsed.threads && (
          <>
            {activeThreads.map(th => (
              <div
                key={th.id}
                className="ftm-sitem"
                onClick={() => onOpenThread(th.id)}
                onContextMenu={e => openCtx(e, [
                  { label: '✎ Edit thread', action: () => onEditThread?.(th.id) },
                  { label: '↗ Open',        action: () => onOpenThread(th.id) },
                ])}
              >
                <div className="ftm-sdot" style={{ background: '#378add55', border: '1px solid #378add' }} />
                <span className="ftm-sitem-label">{th.name}</span>
                <button
                  className="ftm-sedit-btn"
                  title="Edit thread"
                  onClick={e => { e.stopPropagation(); onEditThread?.(th.id) }}
                >✎</button>
                <div className="ftm-sprog">
                  <span className="ftm-sprog-txt">{th.done}/{th.total}</span>
                  <div className="ftm-sprog-track">
                    <div
                      className="ftm-sprog-fill"
                      style={{ width: `${th.total > 0 ? (th.done / th.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Archived folder */}
            {archivedThreads.length > 0 && (
              <>
                <div
                  className="ftm-ssub-heading ftm-ssub-heading-clickable"
                  onClick={() => toggle('threads-archived')}
                >
                  <span className="ftm-ssub-label" style={{ margin: 0, opacity: 0.6 }}>Archived</span>
                  <span className="ftm-scnt" style={{ opacity: 0.5 }}>{archivedThreads.length}</span>
                  <span className={`ftm-schevron ftm-ssub-chevron${collapsed['threads-archived'] !== false ? ' closed' : ''}`}>▾</span>
                </div>
                {collapsed['threads-archived'] === false && archivedThreads.map(th => (
                  <div
                    key={th.id}
                    className="ftm-sitem ftm-sitem-sub"
                    style={{ opacity: 0.6 }}
                    onClick={() => onOpenThread(th.id)}
                  >
                    <div className="ftm-sdot" style={{ background: '#666', border: '1px solid #888' }} />
                    <span className="ftm-sitem-label">{th.name}</span>
                    <div className="ftm-sprog">
                      <span className="ftm-sprog-txt">{th.done}/{th.total}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* ═══ §4 — COMPANIES ═══ */}
      <div className="ftm-snav">
        <SectionHeader
          label="Companies"
          collapsed={collapsed.companies}
          onToggle={() => toggle('companies')}
          showGear
        />
        {!collapsed.companies && (
          <>
            {/* SGR row */}
            <div
              className={`ftm-sitem${isNavActive('sgr', null) ? ' active' : ''}`}
              onClick={() => onNavFilter({ type: 'sgr', id: null, name: 'SGR' })}
            >
              <div className="ftm-sdot" style={{ background: '#9b71d455', border: '1px solid #9b71d4' }} />
              <span className="ftm-sitem-label">SGR</span>
              <span className="ftm-scnt">{sgrCount || ''}</span>
            </div>

            {/* Fund groups */}
            {funds.map(fund => {
              const fundKey = `fund-${fund.id}`
              const children = companiesByFund[fund.id] ?? []
              const fundTaskCount = children.reduce((s, c) => s + c.count, 0) + (taskCountByCo[fund.id] ?? 0)
              return (
                <div key={fund.id}>
                  <div
                    className={`ftm-ssub-heading ftm-ssub-heading-clickable${isNavActive('fund', fund.id) ? ' active' : ''}`}
                    onClick={() => onNavFilter({ type: 'fund', id: fund.id, name: fund.name })}
                    onContextMenu={e => openCtx(e, [
                      { label: '✎ Rename fund', action: () => startRename('fund', fund.id, fund.name) },
                      'divider',
                      { label: '✕ Delete fund', danger: true, action: () => deleteFund(fund.id) },
                    ])}
                  >
                    {renamingId === `fund-${fund.id}`
                      ? <RenameInput {...renameProps('fund', fund.id)} />
                      : <span className="ftm-ssub-label" style={{ margin: 0 }}>{fund.name}</span>
                    }
                    <span className="ftm-scnt">{fundTaskCount || ''}</span>
                    <button
                      className="ftm-snew-btn"
                      title={`Add company to ${fund.name}`}
                      onClick={e => { e.stopPropagation(); startQuickAdd('company-in-fund', fund.id) }}
                    >+</button>
                    <span
                      className={`ftm-schevron ftm-ssub-chevron${collapsed[fundKey] ? ' closed' : ''}`}
                      onClick={e => { e.stopPropagation(); toggle(fundKey) }}
                    >▾</span>
                  </div>

                  {!collapsed[fundKey] && (
                    <>
                      {children.map(co => (
                        <div
                          key={co.id}
                          className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                          onClick={() => renamingId !== `co-${co.id}` && onNavFilter({ type: 'company', id: co.id, name: co.name })}
                          onContextMenu={e => openCtx(e, companyCtxItems(co))}
                        >
                          <div className="ftm-sdot" style={{ background: '#378add55', border: '1px solid #378add' }} />
                          {renamingId === `co-${co.id}`
                            ? <RenameInput {...renameProps('co', co.id)} />
                            : <span className="ftm-sitem-label">{co.name}{co.type === 'prospect' && !co.name.includes('(prospect)') ? ' (prospect)' : ''}</span>
                          }
                          <span className="ftm-scnt">{co.count || ''}</span>
                        </div>
                      ))}
                      {quickAdd?.kind === 'company-in-fund' && quickAdd.fundId === fund.id && (
                        <div className="ftm-quick-add-row ftm-quick-add-row-sub">
                          {quickInput('Company name…')}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}

            {/* New fund quick-add */}
            {quickAdd?.kind === 'new-fund' && quickInput('Fund name…')}

            {/* Unassigned */}
            {companiesUnassigned.length > 0 && (
              <>
                <div
                  className="ftm-ssub-heading ftm-ssub-heading-clickable"
                  onClick={() => toggle('companies-unassigned')}
                >
                  <span className="ftm-ssub-label" style={{ margin: 0, opacity: 0.6 }}>Unassigned</span>
                  <span className={`ftm-schevron ftm-ssub-chevron${collapsed['companies-unassigned'] ? ' closed' : ''}`}>▾</span>
                </div>
                {!collapsed['companies-unassigned'] && companiesUnassigned.map(co => (
                  <div
                    key={co.id}
                    className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                    onClick={() => renamingId !== `co-${co.id}` && onNavFilter({ type: 'company', id: co.id, name: co.name })}
                    onContextMenu={e => openCtx(e, companyCtxItems(co))}
                  >
                    <div className="ftm-sdot" style={{ background: '#aaa5', border: '1px solid #aaa' }} />
                    {renamingId === `co-${co.id}`
                      ? <RenameInput {...renameProps('co', co.id)} />
                      : <span className="ftm-sitem-label">{co.name}</span>
                    }
                    <span className="ftm-scnt">{co.count || ''}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* ═══ §5 — CATEGORIES ═══ */}
      <div className="ftm-snav">
        <SectionHeader
          label="Categories"
          collapsed={collapsed.categories}
          onToggle={() => toggle('categories')}
          onAdd={() => startQuickAdd('category')}
          showGear
        />
        {!collapsed.categories && (
          <>
            {hasMacroCategories ? (
              /* Grouped by macro_category */
              MACRO_ORDER.map(macro => {
                const group = categoriesByMacro[macro]
                if (!group || group.length === 0) return null
                return (
                  <div key={macro}>
                    <div className="ftm-smacro-label">{macro}</div>
                    {group.map(cat => (
                      <div
                        key={cat.id}
                        className={`ftm-sitem ftm-sitem-sub${isNavActive('category', cat.id) ? ' active' : ''}`}
                        onClick={() => renamingId !== `cat-${cat.id}` && onNavFilter({
                          type: 'category', id: cat.id, name: cat.name, macroCategory: cat.macro_category,
                        })}
                        onContextMenu={e => openCtx(e, [
                          { label: '✎ Rename', action: () => startRename('cat', cat.id, cat.name) },
                          'divider',
                          { label: '✕ Delete', danger: true, action: async () => { await deleteCategory(cat.id); onDataChanged?.() } },
                        ])}
                      >
                        <div className="ftm-sdot" style={{ background: '#b8933e55', border: '1px solid #b8933e' }} />
                        {renamingId === `cat-${cat.id}`
                          ? <RenameInput {...renameProps('cat', cat.id)} />
                          : <span className="ftm-sitem-label">{cat.name}</span>
                        }
                        <span className="ftm-scnt">{cat.count || ''}</span>
                      </div>
                    ))}
                  </div>
                )
              })
            ) : (
              /* Flat list (no macro_category available) */
              categories.map(cat => (
                <div
                  key={cat.id}
                  className={`ftm-sitem${isNavActive('category', cat.id) ? ' active' : ''}`}
                  onClick={() => renamingId !== `cat-${cat.id}` && onNavFilter({ type: 'category', id: cat.id, name: cat.name })}
                  onContextMenu={e => openCtx(e, [
                    { label: '✎ Rename', action: () => startRename('cat', cat.id, cat.name) },
                    'divider',
                    { label: '✕ Delete', danger: true, action: async () => { await deleteCategory(cat.id); onDataChanged?.() } },
                  ])}
                >
                  <div className="ftm-sdot" style={{ background: '#b8933e55', border: '1px solid #b8933e' }} />
                  {renamingId === `cat-${cat.id}`
                    ? <RenameInput {...renameProps('cat', cat.id)} />
                    : <span className="ftm-sitem-label">{cat.name}</span>
                  }
                  <span className="ftm-scnt">{cat.count || ''}</span>
                </div>
              ))
            )}
            {quickAdd?.kind === 'category' && quickInput('Category name…')}
          </>
        )}
      </div>

      {/* ═══ User footer ═══ */}
      <div className="ftm-sbottom">
        <div className="ftm-user">
          <div className="ftm-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ftm-uname" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div className="ftm-urole">{roleLabel}</div>
          </div>
          <button className="ftm-sgear-btn" onClick={onManage} title="Manage">⚙</button>
          <button
            onClick={signOut}
            title="Sign out"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.3)', fontSize: 14,
              padding: '2px 4px', borderRadius: 4, lineHeight: 1, flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >↪</button>
        </div>
      </div>
    </aside>
  )
}
