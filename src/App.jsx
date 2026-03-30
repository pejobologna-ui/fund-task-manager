import { useState, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import TaskList from './components/TaskList'
import DetailPanel from './components/DetailPanel'
import NewTaskModal from './components/NewTaskModal'
import ThreadPage from './pages/ThreadPage'
import NewThreadModal from './components/NewThreadModal'
import ManageModal from './components/ManageModal'
import ThreadEditModal from './components/ThreadEditModal'
import LoginPage from './pages/LoginPage'
import { useTasks, useLookups, useProfiles, useActiveSteps, useTemplates } from './hooks/useTasks'
import { useAuth } from './context/AuthContext'
import { dateDiff } from './utils'

export default function App() {
  const { session, profile, loading: authLoading } = useAuth()
  const { tasks, loading, error, refetch, toggleDone, updateNotes, updateField } = useTasks()
  const { categories, threads, companies, users, threadProgress, loading: lookupsLoading, refetch: refetchLookups } = useLookups()
  const { profiles } = useProfiles()
  const { activeSteps, refetch: refetchSteps, cycleActiveStep, updateActiveStep } = useActiveSteps()
  const templates = useTemplates()

  // Single function that refreshes both task list and all dropdown lookups
  function refetchAll() { refetch(); refetchLookups(); refetchSteps() }

  // Merge real tasks with synthetic active-step tasks
  const allItems = useMemo(() => [...tasks, ...activeSteps], [tasks, activeSteps])

  // Wrapper dispatchers that route step-tasks to step mutations
  function handleToggle(id, status) {
    if (typeof id === 'string' && id.startsWith('step-')) return cycleActiveStep(id, status)
    return toggleDone(id, status)
  }
  function handleUpdate(id, dbUpdates, stateUpdates) {
    if (typeof id === 'string' && id.startsWith('step-')) return updateActiveStep(id, dbUpdates)
    return updateField(id, dbUpdates, stateUpdates)
  }
  const [view, setView]         = useState('all')
  const [navFilter, setNavFilter] = useState(null)   // { type: 'category'|'company'|'thread', id, name }
  const [threadPage, setThreadPage] = useState(null) // threadId string | null
  const [filterStatus, setFS]   = useState('all')
  const [filterPrio, setFP]     = useState('all')
  const [filterCat,  setFC]     = useState('all')  // macro_category string or 'all'
  const [groupBy,    setGroupBy] = useState('none') // 'none' | 'category' | 'company'
  const [query, setQuery]       = useState('')
  const [selectedId, select]  = useState(null)
  const [modalOpen, setModal] = useState(false)
  const [modalPresetCat, setModalPresetCat] = useState(null)
  const [modalThreadContext, setModalThreadContext] = useState(null)
  const [threadModalOpen, setThreadModal] = useState(false)
  const [manageOpen, setManageOpen]       = useState(false)
  const [editThreadId, setEditThreadId]   = useState(null)

  if (authLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="ftm-loading">Loading…</div>
    </div>
  )
  if (!session) return <LoginPage />

  const myInitials = profile?.initials ?? ''
  const myUserId   = session.user.id

  const isMyPersonal   = t => t.visibility === 'personal' && t.created_by === myUserId
  const isSharedWithMe = t => t.visibility === 'personal' && t.created_by !== myUserId

  // Switching a team/personal view always clears the nav filter and thread page
  function handleSetView(v) {
    setView(v)
    setNavFilter(null)
    setThreadPage(null)
  }

  // Clicking the already-active filter toggles it off; clears thread page
  function handleNavFilter(f) {
    setThreadPage(null)
    setNavFilter(prev =>
      prev?.type === f.type && prev?.id === f.id ? null : f
    )
  }

  // Opens the thread detail page
  function handleOpenThread(id) {
    setThreadPage(id)
    setNavFilter(null)
  }

  const counts = useMemo(() => ({
    all:      allItems.filter(t => t.visibility !== 'personal' && t.status !== 'Done').length,
    mine:     allItems.filter(t => t.visibility !== 'personal' && t.assignee?.initials === myInitials && t.status !== 'Done').length,
    overdue:  allItems.filter(t => t.visibility !== 'personal' && dateDiff(t.due_date) < 0 && t.status !== 'Done').length,
    week:     allItems.filter(t => t.visibility !== 'personal' && (() => { const d = dateDiff(t.due_date); return d >= 0 && d <= 7 })() && t.status !== 'Done').length,
    personal: allItems.filter(t => isMyPersonal(t)).length,
    shared:   allItems.filter(t => isSharedWithMe(t)).length,
  }), [allItems, myInitials, myUserId])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return allItems.filter(t => {
      if (navFilter) {
        // Nav filter overrides the view — show all matching tasks regardless of visibility
        if (navFilter.type === 'category' && t.category?.id !== navFilter.id) return false
        if (navFilter.type === 'company'  && t.company?.id  !== navFilter.id) return false
        if (navFilter.type === 'thread'   && t.thread?.id   !== navFilter.id) return false
        if (navFilter.type === 'sgr'      && t.company?.type !== 'sgr') return false
        if (navFilter.type === 'fund'     && t.company?.id !== navFilter.id && t.company?.fund_id !== navFilter.id) return false
      } else {
        if (view === 'personal') { if (!isMyPersonal(t))   return false }
        else if (view === 'shared') { if (!isSharedWithMe(t)) return false }
        else {
          if (t.visibility === 'personal') return false
          if (view === 'mine'    && t.assignee?.initials !== myInitials) return false
          if (view === 'overdue' && (dateDiff(t.due_date) >= 0 || t.status === 'Done')) return false
          if (view === 'week') {
            const d = dateDiff(t.due_date)
            if (d < 0 || d > 7 || t.status === 'Done') return false
          }
        }
      }
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterPrio   !== 'all' && t.priority !== filterPrio)  return false
      if (filterCat    !== 'all' && !navFilter) {
        // Only apply when navFilter isn't active — navFilter takes precedence
        if (t.category?.macro_category !== filterCat) return false
      }
      if (q) {
        const hay = [t.title, t.category?.name, t.thread?.name, t.company?.name].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allItems, view, navFilter, filterStatus, filterPrio, filterCat, query, myInitials, myUserId])

  const selectedTask = allItems.find(t => t.id === selectedId) ?? null

  function openNewTask(presetCat = null, threadContext = null) {
    setModalPresetCat(presetCat)
    setModalThreadContext(threadContext)
    setModal(true)
  }

  const VIEW_TITLES = {
    all:      'All tasks',
    mine:     'My tasks',
    overdue:  'Overdue tasks',
    week:     'Due this week',
    personal: 'My personal tasks',
    shared:   'Shared with me',
  }

  const pageTitle = navFilter
    ? (navFilter.type === 'category' && navFilter.macroCategory
        ? `${navFilter.macroCategory} › ${navFilter.name}`
        : navFilter.name)
    : (VIEW_TITLES[view] ?? view)

  return (
    <div className="ftm">
      <Sidebar
        view={view}
        onSetView={handleSetView}
        navFilter={navFilter}
        onNavFilter={handleNavFilter}
        onOpenThread={handleOpenThread}
        onNewThread={() => setThreadModal(true)}
        onEditThread={id => setEditThreadId(id)}
        onManage={() => setManageOpen(true)}
        onDataChanged={refetchAll}
        counts={counts}
        allItems={allItems}
        threads={threads}
        threadProgress={threadProgress}
        categories={categories}
        profile={profile}
      />

      {threadPage ? (
        <div className="ftm-main">
          <ThreadPage
            threadId={threadPage}
            onBack={() => setThreadPage(null)}
            onOpenThread={handleOpenThread}
            onEditThread={id => setEditThreadId(id)}
            onNewTask={tc => openNewTask(null, tc)}
            myUserId={myUserId}
          />
        </div>
      ) : (
        <div className="ftm-main">
          <Header
            title={pageTitle}
            query={query}
            onQuery={setQuery}
            onNewTask={() => openNewTask()}
          />
          <FilterBar
            filterStatus={filterStatus}
            filterPrio={filterPrio}
            onStatus={setFS}
            onPrio={setFP}
            categories={categories}
            filterCategory={filterCat}
            onCategory={setFC}
            groupBy={groupBy}
            onGroupBy={setGroupBy}
          />
          <div className="ftm-content">
            <TaskList
              tasks={filtered}
              allTasks={allItems}
              loading={loading}
              error={error}
              selectedId={selectedId}
              onSelect={select}
              onToggle={handleToggle}
              onUpdate={handleUpdate}
              onAddInCategory={openNewTask}
              onOpenThread={handleOpenThread}
              groupBy={groupBy}
            />
          </div>
        </div>
      )}

      <DetailPanel
        task={selectedTask}
        onClose={() => select(null)}
        onToggle={toggleDone}
        onUpdateNotes={updateNotes}
        onUpdate={updateField}
        categories={categories}
        threads={threads}
        companies={companies}
        users={users}
      />

      {modalOpen && (
        <NewTaskModal
          presetCategory={modalPresetCat}
          navFilter={navFilter}
          threadContext={modalThreadContext}
          templates={templates}
          categories={categories}
          threads={threads}
          companies={companies}
          users={users}
          profiles={profiles}
          lookupsLoading={lookupsLoading}
          onClose={() => { setModal(false); setModalThreadContext(null) }}
          onCreated={() => { refetchAll(); setModal(false); setModalThreadContext(null) }}
        />
      )}

      {threadModalOpen && (
        <NewThreadModal
          companies={companies}
          users={users}
          profiles={profiles}
          onClose={() => setThreadModal(false)}
          onCreated={thread => {
            setThreadModal(false)
            handleOpenThread(thread.id)
            refetchAll()
          }}
        />
      )}

      {manageOpen && (
        <ManageModal
          onClose={() => setManageOpen(false)}
          onSaved={refetch}
        />
      )}

      {editThreadId && (
        <ThreadEditModal
          threadId={editThreadId}
          onClose={() => setEditThreadId(null)}
          onSaved={() => { setEditThreadId(null); refetchAll() }}
          onDeleted={() => { setEditThreadId(null); setThreadPage(null); refetchAll() }}
        />
      )}
    </div>
  )
}
