import { useState, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import TaskList from './components/TaskList'
import DetailPanel from './components/DetailPanel'
import NewTaskModal from './components/NewTaskModal'
import ThreadPage from './pages/ThreadPage'
import LoginPage from './pages/LoginPage'
import { useTasks } from './hooks/useTasks'
import { useAuth } from './context/AuthContext'
import { dateDiff } from './utils'

export default function App() {
  const { session, profile, loading: authLoading } = useAuth()
  const { tasks, loading, error, refetch, toggleDone, updateNotes, updateField } = useTasks()

  const [view, setView]         = useState('all')
  const [navFilter, setNavFilter] = useState(null)   // { type: 'category'|'company'|'thread', id, name }
  const [threadPage, setThreadPage] = useState(null) // threadId string | null
  const [filterStatus, setFS] = useState('all')
  const [filterPrio, setFP]   = useState('all')
  const [query, setQuery]     = useState('')
  const [selectedId, select]  = useState(null)
  const [modalOpen, setModal] = useState(false)
  const [modalPresetCat, setModalPresetCat] = useState(null)

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
    all:      tasks.filter(t => t.visibility !== 'personal' && t.status !== 'Done').length,
    mine:     tasks.filter(t => t.visibility !== 'personal' && t.assignee?.initials === myInitials && t.status !== 'Done').length,
    overdue:  tasks.filter(t => t.visibility !== 'personal' && dateDiff(t.due_date) < 0 && t.status !== 'Done').length,
    week:     tasks.filter(t => t.visibility !== 'personal' && (() => { const d = dateDiff(t.due_date); return d >= 0 && d <= 7 })() && t.status !== 'Done').length,
    personal: tasks.filter(t => isMyPersonal(t)).length,
    shared:   tasks.filter(t => isSharedWithMe(t)).length,
  }), [tasks, myInitials, myUserId])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return tasks.filter(t => {
      if (navFilter) {
        // Nav filter overrides the view — show all matching tasks regardless of visibility
        if (navFilter.type === 'category' && t.category?.id !== navFilter.id) return false
        if (navFilter.type === 'company'  && t.company?.id  !== navFilter.id) return false
        if (navFilter.type === 'thread'   && t.thread?.id   !== navFilter.id) return false
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
      if (q) {
        const hay = [t.title, t.category?.name, t.thread?.name, t.company?.name].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tasks, view, navFilter, filterStatus, filterPrio, query, myInitials, myUserId])

  const selectedTask = tasks.find(t => t.id === selectedId) ?? null

  function openNewTask(presetCat = null) {
    setModalPresetCat(presetCat)
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

  const pageTitle = navFilter ? navFilter.name : (VIEW_TITLES[view] ?? view)

  return (
    <div className="ftm">
      <Sidebar
        view={view}
        onSetView={handleSetView}
        navFilter={navFilter}
        onNavFilter={handleNavFilter}
        onOpenThread={handleOpenThread}
        counts={counts}
        tasks={tasks}
        profile={profile}
      />

      {threadPage ? (
        <div className="ftm-main">
          <ThreadPage
            threadId={threadPage}
            tasks={tasks.filter(t => t.thread?.id === threadPage)}
            allTasks={tasks}
            selectedId={selectedId}
            onSelect={select}
            onToggle={toggleDone}
            onUpdate={updateField}
            onBack={() => setThreadPage(null)}
            onOpenThread={handleOpenThread}
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
          />
          <div className="ftm-content">
            <TaskList
              tasks={filtered}
              allTasks={tasks}
              loading={loading}
              error={error}
              selectedId={selectedId}
              onSelect={select}
              onToggle={toggleDone}
              onUpdate={updateField}
              onAddInCategory={openNewTask}
              onOpenThread={handleOpenThread}
            />
          </div>
        </div>
      )}

      <DetailPanel
        task={selectedTask}
        onClose={() => select(null)}
        onToggle={toggleDone}
        onUpdateNotes={updateNotes}
      />

      {modalOpen && (
        <NewTaskModal
          presetCategory={modalPresetCat}
          onClose={() => setModal(false)}
          onCreated={() => { refetch(); setModal(false) }}
        />
      )}
    </div>
  )
}
