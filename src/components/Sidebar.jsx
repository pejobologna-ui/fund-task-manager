import { useMemo, useState, useEffect, useRef } from 'react'
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
  gp:        'General Partner',
  associate: 'Associate',
  analyst:   'Analyst',
  viewer:    'Viewer',
}

// ─── Rename Input ─────────────────────────────────────────────────────────────
// Must live at module level — defining components inside other components causes
// React to unmount/remount on every parent re-render, breaking focus & Enter key.
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

// ─── Context Menu ────────────────────────────────────────────────────────────
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

// ─── Sidebar ─────────────────────────────────────────────────────────────────
export default function Sidebar({
  view, onSetView, navFilter, onNavFilter, onOpenThread,
  onNewThread, onEditThread, onManage, onDataChanged, counts, tasks, profile,
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

  const [collapsed, setCollapsed]           = useState({ categories: false, companies: false, threads: false })
  const [collapsedFunds, setCollapsedFunds] = useState({})   // { [fundId]: bool }
  const [ctxMenu, setCtxMenu]               = useState(null) // { x, y, items }
  const [renamingId, setRenamingId]         = useState(null) // 'cat-<id>' | 'co-<id>' | 'fund-<id>'
  const [renameVal, setRenameVal]           = useState('')
  // quickAdd: null | { kind: 'category'|'company-fund-level'|'company-in-fund'|'new-fund', fundId? }
  const [quickAdd, setQuickAdd]             = useState(null)
  const [quickVal, setQuickVal]             = useState('')
  const renameInputRef  = useRef(null)
  const quickInputRef   = useRef(null)
  const submittingRef   = useRef(false)

  function toggle(key) {
    setCollapsed(c => ({ ...c, [key]: !c[key] }))
  }
  function toggleFund(id) {
    setCollapsedFunds(c => ({ ...c, [id]: !c[id] }))
  }

  function isNavActive(type, id) {
    return navFilter?.type === type && navFilter?.id === id
  }

  function openCtx(e, items) {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }

  useEffect(() => {
    if (renamingId && renameInputRef.current) renameInputRef.current.focus()
  }, [renamingId])

  useEffect(() => {
    if (quickAdd && quickInputRef.current) quickInputRef.current.focus()
  }, [quickAdd])

  // ── Rename helpers ─────────────────────────────────────────────────────────
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

  // ── Quick-add helpers ──────────────────────────────────────────────────────
  async function commitQuickAdd() {
    if (submittingRef.current) return
    const v = quickVal.trim()
    if (v && quickAdd) {
      submittingRef.current = true
      try {
        if (quickAdd.kind === 'category') {
          await addCategory(v)
        } else if (quickAdd.kind === 'company-fund-level') {
          await addCompany({ name: v, type: 'other', fund: null, fund_id: null })
        } else if (quickAdd.kind === 'company-in-fund') {
          await addCompany({ name: v, type: 'portfolio', fund: null, fund_id: quickAdd.fundId })
        } else if (quickAdd.kind === 'new-fund') {
          await addFund(v)
        }
      } finally {
        submittingRef.current = false
      }
    }
    setQuickAdd(null)
    setQuickVal('')
  }

  function cancelQuickAdd() {
    setQuickAdd(null)
    setQuickVal('')
  }

  function startQuickAdd(kind, fundId) {
    setQuickAdd({ kind, fundId })
    setQuickVal('')
    // Expand the relevant section
    if (kind === 'category')        setCollapsed(c => ({ ...c, categories: false }))
    if (kind.startsWith('company')) setCollapsed(c => ({ ...c, companies: false }))
    if (kind === 'company-in-fund' && fundId) setCollapsedFunds(c => ({ ...c, [fundId]: false }))
  }

  // ── Task counts ────────────────────────────────────────────────────────────
  const taskCountByCat = useMemo(() => {
    const m = {}
    tasks.forEach(t => {
      if (t.status === 'Done' || !t.category?.id) return
      m[t.category.id] = (m[t.category.id] ?? 0) + 1
    })
    return m
  }, [tasks])

  const taskCountByCo = useMemo(() => {
    const m = {}
    tasks.forEach(t => {
      if (t.status === 'Done' || !t.company?.id) return
      m[t.company.id] = (m[t.company.id] ?? 0) + 1
    })
    return m
  }, [tasks])

  // ── Derived company lists ──────────────────────────────────────────────────
  const companiesFundLevel = useMemo(() =>
    allCompanies
      .filter(c => c.type === 'other')
      .map(c => ({ ...c, count: taskCountByCo[c.id] ?? 0 }))
  , [allCompanies, taskCountByCo])

  // Companies grouped by fund_id
  const companiesByFund = useMemo(() => {
    const m = {}
    allCompanies
      .filter(c => c.type !== 'other' && c.fund_id)
      .forEach(c => {
        if (!m[c.fund_id]) m[c.fund_id] = []
        m[c.fund_id].push({ ...c, count: taskCountByCo[c.id] ?? 0 })
      })
    return m
  }, [allCompanies, taskCountByCo])

  // Companies not fund-level and not in any fund
  const companiesUnassigned = useMemo(() =>
    allCompanies
      .filter(c => c.type !== 'other' && !c.fund_id)
      .map(c => ({ ...c, count: taskCountByCo[c.id] ?? 0 }))
  , [allCompanies, taskCountByCo])

  const categories = useMemo(() =>
    allCategories.map(c => ({ ...c, count: taskCountByCat[c.id] ?? 0 }))
  , [allCategories, taskCountByCat])

  // ── Threads ────────────────────────────────────────────────────────────────
  const threads = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (!t.thread?.id) return
      if (!map[t.thread.id]) map[t.thread.id] = { id: t.thread.id, name: t.thread.name, done: 0, total: 0 }
      map[t.thread.id].total++
      if (t.status === 'Done') map[t.thread.id].done++
    })
    return Object.values(map).filter(th => th.total > 0).sort((a, b) => b.total - a.total)
  }, [tasks])

  const displayName = profile?.full_name ?? '—'
  const initials    = profile?.initials  ?? '?'
  const roleLabel   = ROLE_LABELS[profile?.role] ?? profile?.role ?? ''

  // ── Company context menu items ─────────────────────────────────────────────
  function companyCtxItems(co) {
    const moveToFund = funds
      .filter(f => f.id !== co.fund_id)
      .map(f => ({
        label: `→ Move to ${f.name}`,
        action: () => updateCompany(co.id, { fund_id: f.id, type: co.type === 'other' ? 'portfolio' : co.type }),
      }))
    const moveToFundLevel = co.type !== 'other'
      ? [{ label: '→ Move to Fund-Level', action: () => updateCompany(co.id, { type: 'other', fund_id: null }) }]
      : []
    const moveFromFundLevel = co.type === 'other' && funds.length > 0
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

  // Helper to build props for the module-level RenameInput
  function renameProps(prefix, id) {
    return {
      inputRef: renameInputRef,
      value:    renameVal,
      onChange: setRenameVal,
      onCommit: () => commitRename(prefix, id),
      onCancel: () => { setRenamingId(null); setRenameVal('') },
    }
  }

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

      {/* ── Team views ── */}
      <div className="ftm-snav">
        <div className="ftm-slabel">Team</div>
        {TEAM_VIEWS.map(v => (
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

      {/* ── Personal views ── */}
      <div className="ftm-snav">
        <div className="ftm-slabel">Personal</div>
        {PERSONAL_VIEWS.map(v => (
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

      {/* ── Categories ── */}
      <div className="ftm-snav">
        <div className="ftm-sheading" onClick={() => toggle('categories')}>
          <span className="ftm-slabel" style={{ margin: 0 }}>Categories</span>
          <button
            className="ftm-snew-btn"
            title="Add category"
            onClick={e => { e.stopPropagation(); startQuickAdd('category') }}
          >+</button>
          <span className={`ftm-schevron${collapsed.categories ? ' closed' : ''}`}>▾</span>
        </div>
        {!collapsed.categories && (
          <>
            {categories.map(cat => (
              <div
                key={cat.id}
                className={`ftm-sitem${isNavActive('category', cat.id) ? ' active' : ''}`}
                onClick={() => renamingId !== `cat-${cat.id}` && onNavFilter({ type: 'category', id: cat.id, name: cat.name })}
                onContextMenu={e => openCtx(e, [
                  { label: '✎ Rename', action: () => startRename('cat', cat.id, cat.name) },
                  { label: '⚙ Edit in Manage', action: () => onManage() },
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
            {quickAdd?.kind === 'category' && (
              <div className="ftm-quick-add-row">
                <input
                  ref={quickInputRef}
                  className="ftm-quick-add-input"
                  placeholder="Category name…"
                  value={quickVal}
                  onChange={e => setQuickVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitQuickAdd(); if (e.key === 'Escape') cancelQuickAdd() }}
                  onBlur={commitQuickAdd}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Companies ── */}
      <div className="ftm-snav">
        <div className="ftm-sheading" onClick={() => toggle('companies')}>
          <span className="ftm-slabel" style={{ margin: 0 }}>Companies</span>
          <button
            className="ftm-snew-btn"
            title="Add fund"
            onClick={e => { e.stopPropagation(); startQuickAdd('new-fund') }}
          >+</button>
          <span className={`ftm-schevron${collapsed.companies ? ' closed' : ''}`}>▾</span>
        </div>

        {!collapsed.companies && (
          <>
            {/* ── Fund-Level sub-section (static) ── */}
            <div className="ftm-ssub-heading">
              <span className="ftm-ssub-label" style={{ margin: 0 }}>Fund-Level</span>
              <button
                className="ftm-snew-btn"
                title="Add fund-level company"
                onClick={e => { e.stopPropagation(); startQuickAdd('company-fund-level') }}
              >+</button>
            </div>
            {companiesFundLevel.map(co => (
              <div
                key={co.id}
                className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                onClick={() => renamingId !== `co-${co.id}` && onNavFilter({ type: 'company', id: co.id, name: co.name })}
                onContextMenu={e => openCtx(e, companyCtxItems(co))}
              >
                <div className="ftm-sdot" style={{ background: '#9b71d455', border: '1px solid #9b71d4' }} />
                {renamingId === `co-${co.id}`
                  ? <RenameInput {...renameProps('co', co.id)} />
                  : <span className="ftm-sitem-label">{co.name}</span>
                }
                <span className="ftm-scnt">{co.count || ''}</span>
              </div>
            ))}
            {quickAdd?.kind === 'company-fund-level' && (
              <div className="ftm-quick-add-row ftm-quick-add-row-sub">
                <input
                  ref={quickInputRef}
                  className="ftm-quick-add-input"
                  placeholder="Company name…"
                  value={quickVal}
                  onChange={e => setQuickVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitQuickAdd(); if (e.key === 'Escape') cancelQuickAdd() }}
                  onBlur={commitQuickAdd}
                />
              </div>
            )}

            {/* ── Dynamic fund sub-sections ── */}
            {funds.map(fund => (
              <div key={fund.id}>
                <div
                  className="ftm-ssub-heading ftm-ssub-heading-clickable"
                  onClick={() => toggleFund(fund.id)}
                  onContextMenu={e => openCtx(e, [
                    { label: '✎ Rename fund', action: () => startRename('fund', fund.id, fund.name) },
                    'divider',
                    { label: '✕ Delete fund', danger: true, action: () => deleteFund(fund.id) },
                  ])}
                >
                  {renamingId === `fund-${fund.id}`
                    ? <RenameInput {...renameProps('fund', fund.id)} />
                    : (
                      <span className="ftm-ssub-label" style={{ margin: 0 }}>{fund.name}</span>
                    )
                  }
                  <button
                    className="ftm-snew-btn"
                    title={`Add company to ${fund.name}`}
                    onClick={e => { e.stopPropagation(); startQuickAdd('company-in-fund', fund.id) }}
                  >+</button>
                  <span className={`ftm-schevron ftm-ssub-chevron${collapsedFunds[fund.id] ? ' closed' : ''}`}>▾</span>
                </div>

                {!collapsedFunds[fund.id] && (
                  <>
                    {(companiesByFund[fund.id] ?? []).map(co => (
                      <div
                        key={co.id}
                        className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                        onClick={() => renamingId !== `co-${co.id}` && onNavFilter({ type: 'company', id: co.id, name: co.name })}
                        onContextMenu={e => openCtx(e, companyCtxItems(co))}
                      >
                        <div className="ftm-sdot" style={{ background: '#378add55', border: '1px solid #378add' }} />
                        {renamingId === `co-${co.id}`
                          ? <RenameInput {...renameProps('co', co.id)} />
                          : <span className="ftm-sitem-label">{co.name}</span>
                        }
                        <span className="ftm-scnt">{co.count || ''}</span>
                      </div>
                    ))}
                    {quickAdd?.kind === 'company-in-fund' && quickAdd.fundId === fund.id && (
                      <div className="ftm-quick-add-row ftm-quick-add-row-sub">
                        <input
                          ref={quickInputRef}
                          className="ftm-quick-add-input"
                          placeholder="Company name…"
                          value={quickVal}
                          onChange={e => setQuickVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitQuickAdd(); if (e.key === 'Escape') cancelQuickAdd() }}
                          onBlur={commitQuickAdd}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* New fund quick-add */}
            {quickAdd?.kind === 'new-fund' && (
              <div className="ftm-quick-add-row">
                <input
                  ref={quickInputRef}
                  className="ftm-quick-add-input"
                  placeholder="Fund name…"
                  value={quickVal}
                  onChange={e => setQuickVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitQuickAdd(); if (e.key === 'Escape') cancelQuickAdd() }}
                  onBlur={commitQuickAdd}
                />
              </div>
            )}

            {/* Unassigned companies (no fund, not fund-level) */}
            {companiesUnassigned.length > 0 && (
              <>
                <div className="ftm-ssub-heading">
                  <span className="ftm-ssub-label" style={{ margin: 0, opacity: 0.6 }}>Unassigned</span>
                </div>
                {companiesUnassigned.map(co => (
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

      {/* ── Threads ── */}
      <div className="ftm-snav">
        <div className="ftm-sheading" onClick={() => toggle('threads')}>
          <span className="ftm-slabel" style={{ margin: 0 }}>Threads</span>
          <button
            className="ftm-snew-btn"
            title="New thread"
            onClick={e => { e.stopPropagation(); onNewThread() }}
          >+</button>
          <span className={`ftm-schevron${collapsed.threads ? ' closed' : ''}`}>▾</span>
        </div>
        {!collapsed.threads && threads.map(th => (
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
      </div>

      <div className="ftm-sbottom">
        <div className="ftm-user">
          <div className="ftm-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ftm-uname" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div className="ftm-urole">{roleLabel}</div>
          </div>
          <button
            className="ftm-sgear-btn"
            onClick={onManage}
            title="Manage categories, companies & templates"
          >⚙</button>
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
