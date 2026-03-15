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
  gp:        'General Partner',
  associate: 'Associate',
  analyst:   'Analyst',
  viewer:    'Viewer',
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

  // Clamp so menu doesn't overflow viewport
  const style = {
    position: 'fixed',
    top:  Math.min(y, window.innerHeight - 8 - (items.length * 32 + 8)),
    left: Math.min(x, window.innerWidth  - 160 - 8),
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
  onNewThread, onEditThread, onManage, counts, tasks, profile,
}) {
  const { signOut } = useAuth()
  const {
    categories: allCategories, companies: allCompanies,
    addCategory, renameCategory, deleteCategory,
    addCompany, updateCompany, deleteCompany,
  } = useManage()

  const [collapsed, setCollapsed] = useState({ categories: false, companies: false, threads: false })
  const [ctxMenu, setCtxMenu]     = useState(null)   // { x, y, items }
  const [renamingId, setRenamingId] = useState(null) // 'cat-<id>' | 'co-<id>'
  const [renameVal, setRenameVal]   = useState('')
  const [quickAdd, setQuickAdd]     = useState(null) // 'category' | 'company-fund' | 'company-portfolio'
  const [quickVal, setQuickVal]     = useState('')
  const renameInputRef = useRef(null)
  const quickInputRef  = useRef(null)

  function toggle(key) {
    setCollapsed(c => ({ ...c, [key]: !c[key] }))
  }

  function isNavActive(type, id) {
    return navFilter?.type === type && navFilter?.id === id
  }

  function openCtx(e, items) {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) renameInputRef.current.focus()
  }, [renamingId])

  // Focus quick-add input when it appears
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
      if (prefix === 'cat') await renameCategory(id, v)
      if (prefix === 'co')  await updateCompany(id, { name: v })
    }
    setRenamingId(null)
    setRenameVal('')
  }

  // ── Quick-add helpers ──────────────────────────────────────────────────────
  async function commitQuickAdd() {
    const v = quickVal.trim()
    if (v) {
      if (quickAdd === 'category') {
        await addCategory(v)
      } else if (quickAdd === 'company-fund') {
        await addCompany({ name: v, type: 'other', fund: null })
      } else if (quickAdd === 'company-portfolio') {
        await addCompany({ name: v, type: 'portfolio', fund: null })
      }
    }
    setQuickAdd(null)
    setQuickVal('')
  }

  function cancelQuickAdd() {
    setQuickAdd(null)
    setQuickVal('')
  }

  // ── Derived lists ──────────────────────────────────────────────────────────
  // Task counts per category / company (for badge numbers)
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

  // Merge manage-hook data (all items) with task counts
  const categories = useMemo(() =>
    allCategories.map(c => ({ ...c, count: taskCountByCat[c.id] ?? 0 }))
  , [allCategories, taskCountByCat])

  const companiesFund = useMemo(() =>
    allCompanies
      .filter(c => c.type === 'other')
      .map(c => ({ ...c, count: taskCountByCo[c.id] ?? 0 }))
  , [allCompanies, taskCountByCo])

  const companiesPortfolio = useMemo(() =>
    allCompanies
      .filter(c => c.type !== 'other')
      .map(c => ({ ...c, count: taskCountByCo[c.id] ?? 0 }))
  , [allCompanies, taskCountByCo])

  // Threads: derived from tasks as before
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

  // ── Render ─────────────────────────────────────────────────────────────────
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

      {/* Team views */}
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

      {/* Personal views */}
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

      {/* Categories */}
      <div className="ftm-snav">
        <div className="ftm-sheading" onClick={() => toggle('categories')}>
          <span className="ftm-slabel" style={{ margin: 0 }}>Categories</span>
          <button
            className="ftm-snew-btn"
            title="Add category"
            onClick={e => {
              e.stopPropagation()
              setCollapsed(c => ({ ...c, categories: false }))
              setQuickAdd('category')
              setQuickVal('')
            }}
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
                  { label: '✕ Delete', danger: true, action: () => deleteCategory(cat.id) },
                ])}
              >
                <div className="ftm-sdot" style={{ background: '#b8933e55', border: '1px solid #b8933e' }} />
                {renamingId === `cat-${cat.id}` ? (
                  <input
                    ref={renameInputRef}
                    className="ftm-sinline-input"
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitRename('cat', cat.id)
                      if (e.key === 'Escape') { setRenamingId(null); setRenameVal('') }
                    }}
                    onBlur={() => commitRename('cat', cat.id)}
                  />
                ) : (
                  <span className="ftm-sitem-label">{cat.name}</span>
                )}
                <span className="ftm-scnt">{cat.count || ''}</span>
              </div>
            ))}
            {quickAdd === 'category' && (
              <div className="ftm-quick-add-row">
                <input
                  ref={quickInputRef}
                  className="ftm-quick-add-input"
                  placeholder="Category name…"
                  value={quickVal}
                  onChange={e => setQuickVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  commitQuickAdd()
                    if (e.key === 'Escape') cancelQuickAdd()
                  }}
                  onBlur={commitQuickAdd}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Companies */}
      <div className="ftm-snav">
        <div className="ftm-sheading" onClick={() => toggle('companies')}>
          <span className="ftm-slabel" style={{ margin: 0 }}>Companies</span>
          <span className={`ftm-schevron${collapsed.companies ? ' closed' : ''}`}>▾</span>
        </div>
        {!collapsed.companies && (
          <>
            {/* Fund-level sub-section */}
            <div className="ftm-ssub-heading">
              <span className="ftm-ssub-label" style={{ margin: 0 }}>Fund-level</span>
              <button
                className="ftm-snew-btn"
                title="Add fund-level company"
                onClick={e => {
                  e.stopPropagation()
                  setCollapsed(c => ({ ...c, companies: false }))
                  setQuickAdd('company-fund')
                  setQuickVal('')
                }}
              >+</button>
            </div>
            {companiesFund.map(co => (
              <div
                key={co.id}
                className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                onClick={() => renamingId !== `co-${co.id}` && onNavFilter({ type: 'company', id: co.id, name: co.name })}
                onContextMenu={e => openCtx(e, [
                  { label: '✎ Rename', action: () => startRename('co', co.id, co.name) },
                  { label: '→ Move to Portfolio', action: () => updateCompany(co.id, { type: 'portfolio' }) },
                  'divider',
                  { label: '✕ Delete', danger: true, action: () => deleteCompany(co.id) },
                ])}
              >
                <div className="ftm-sdot" style={{ background: '#9b71d455', border: '1px solid #9b71d4' }} />
                {renamingId === `co-${co.id}` ? (
                  <input
                    ref={renameInputRef}
                    className="ftm-sinline-input"
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitRename('co', co.id)
                      if (e.key === 'Escape') { setRenamingId(null); setRenameVal('') }
                    }}
                    onBlur={() => commitRename('co', co.id)}
                  />
                ) : (
                  <span className="ftm-sitem-label">{co.name}</span>
                )}
                <span className="ftm-scnt">{co.count || ''}</span>
              </div>
            ))}
            {quickAdd === 'company-fund' && (
              <div className="ftm-quick-add-row ftm-quick-add-row-sub">
                <input
                  ref={quickInputRef}
                  className="ftm-quick-add-input"
                  placeholder="Company name…"
                  value={quickVal}
                  onChange={e => setQuickVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  commitQuickAdd()
                    if (e.key === 'Escape') cancelQuickAdd()
                  }}
                  onBlur={commitQuickAdd}
                />
              </div>
            )}

            {/* Portfolio & Prospects sub-section */}
            <div className="ftm-ssub-heading">
              <span className="ftm-ssub-label" style={{ margin: 0 }}>Portfolio & Prospects</span>
              <button
                className="ftm-snew-btn"
                title="Add portfolio company"
                onClick={e => {
                  e.stopPropagation()
                  setCollapsed(c => ({ ...c, companies: false }))
                  setQuickAdd('company-portfolio')
                  setQuickVal('')
                }}
              >+</button>
            </div>
            {companiesPortfolio.map(co => (
              <div
                key={co.id}
                className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                onClick={() => renamingId !== `co-${co.id}` && onNavFilter({ type: 'company', id: co.id, name: co.name })}
                onContextMenu={e => openCtx(e, [
                  { label: '✎ Rename', action: () => startRename('co', co.id, co.name) },
                  { label: '→ Move to Fund-level', action: () => updateCompany(co.id, { type: 'other' }) },
                  'divider',
                  { label: '✕ Delete', danger: true, action: () => deleteCompany(co.id) },
                ])}
              >
                <div className="ftm-sdot" style={{ background: '#378add55', border: '1px solid #378add' }} />
                {renamingId === `co-${co.id}` ? (
                  <input
                    ref={renameInputRef}
                    className="ftm-sinline-input"
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitRename('co', co.id)
                      if (e.key === 'Escape') { setRenamingId(null); setRenameVal('') }
                    }}
                    onBlur={() => commitRename('co', co.id)}
                  />
                ) : (
                  <span className="ftm-sitem-label">{co.name}</span>
                )}
                <span className="ftm-scnt">{co.count || ''}</span>
              </div>
            ))}
            {quickAdd === 'company-portfolio' && (
              <div className="ftm-quick-add-row ftm-quick-add-row-sub">
                <input
                  ref={quickInputRef}
                  className="ftm-quick-add-input"
                  placeholder="Company name…"
                  value={quickVal}
                  onChange={e => setQuickVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  commitQuickAdd()
                    if (e.key === 'Escape') cancelQuickAdd()
                  }}
                  onBlur={commitQuickAdd}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Threads */}
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
