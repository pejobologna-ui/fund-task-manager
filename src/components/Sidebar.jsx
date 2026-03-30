import { useMemo, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useManage } from '../hooks/useTasks'

import ContextMenu             from './sidebar/ContextMenu'
import SidebarTeamSection      from './sidebar/SidebarTeamSection'
import SidebarPersonalSection  from './sidebar/SidebarPersonalSection'
import SidebarThreadsSection   from './sidebar/SidebarThreadsSection'
import SidebarCompaniesSection from './sidebar/SidebarCompaniesSection'
import SidebarUserFooter       from './sidebar/SidebarUserFooter'

// ── localStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = 'ftm-sidebar-collapsed'
function loadCollapsed() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
function persistCollapsed(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* noop */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sidebar — composes section sub-components
// ═══════════════════════════════════════════════════════════════════════════════
export default function Sidebar({
  view, onSetView, navFilter, onNavFilter, onOpenThread,
  onNewThread, onEditThread, onManage, onDataChanged,
  counts, allItems, threads: threadList, threadProgress,
  profile,
}) {
  const { signOut } = useAuth()
  const {
    companies:  allCompanies,
    funds,
    addCompany,  updateCompany,  deleteCompany,
    addFund,     renameFund,     deleteFund,
  } = useManage()

  // ── Collapse state (persisted) ────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  const toggle = useCallback((key) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      persistCollapsed(next)
      return next
    })
  }, [])

  // Force-expand a key (used by quick-add to ensure section is visible)
  const expand = useCallback((key) => {
    setCollapsed(prev => {
      if (prev[key] === false || prev[key] === undefined) return prev
      const next = { ...prev, [key]: false }
      persistCollapsed(next)
      return next
    })
  }, [])

  // ── Context menu ──────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState(null)
  const openCtx = useCallback((e, items) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }, [])

  // ── Task counts by company ────────────────────────────────────────────────
  const taskCountByCo = useMemo(() => {
    const m = {}
    ;(allItems ?? []).forEach(t => {
      if (t.status === 'Done' || !t.company?.id) return
      m[t.company.id] = (m[t.company.id] ?? 0) + 1
    })
    return m
  }, [allItems])

  // ── Derived company data ──────────────────────────────────────────────────
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

  // ── Threads: active vs archived ───────────────────────────────────────────
  const { activeThreads, archivedThreads } = useMemo(() => {
    const list = threadList ?? []
    const active = [], archived = []
    list.forEach(th => {
      const prog  = threadProgress?.[th.id] ?? { done: 0, total: 0 }
      const entry = { ...th, done: prog.done, total: prog.total }
      if (th.status === 'completed' || th.status === 'archived') archived.push(entry)
      else active.push(entry)
    })
    return { activeThreads: active, archivedThreads: archived }
  }, [threadList, threadProgress])

  // ── Render ────────────────────────────────────────────────────────────────
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

      <SidebarTeamSection
        view={view}
        navFilter={navFilter}
        counts={counts}
        collapsed={collapsed.team}
        onToggle={() => toggle('team')}
        onSetView={onSetView}
      />

      <SidebarPersonalSection
        view={view}
        navFilter={navFilter}
        counts={counts}
        collapsed={collapsed.personal}
        onToggle={() => toggle('personal')}
        onSetView={onSetView}
      />

      <SidebarThreadsSection
        activeThreads={activeThreads}
        archivedThreads={archivedThreads}
        collapsed={collapsed.threads}
        collapsedArchived={collapsed['threads-archived']}
        onToggle={() => toggle('threads')}
        onToggleArchived={() => toggle('threads-archived')}
        onOpenThread={onOpenThread}
        onEditThread={onEditThread}
        onNewThread={onNewThread}
        onContextMenu={openCtx}
      />

      <SidebarCompaniesSection
        funds={funds}
        sgrCount={sgrCount}
        taskCountByCo={taskCountByCo}
        companiesByFund={companiesByFund}
        companiesUnassigned={companiesUnassigned}
        collapsed={collapsed}
        onToggle={toggle}
        onExpand={expand}
        navFilter={navFilter}
        onNavFilter={onNavFilter}
        onContextMenu={openCtx}
        addCompany={addCompany}
        addFund={addFund}
        updateCompany={updateCompany}
        deleteCompany={deleteCompany}
        renameFund={renameFund}
        deleteFund={deleteFund}
        onDataChanged={onDataChanged}
      />

      <SidebarUserFooter
        profile={profile}
        onManage={onManage}
        onSignOut={signOut}
      />
    </aside>
  )
}
