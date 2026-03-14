import { useState, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import TaskList from './components/TaskList'
import DetailPanel from './components/DetailPanel'
import NewTaskModal from './components/NewTaskModal'
import { useTasks } from './hooks/useTasks'
import { dateDiff } from './utils'

export default function App() {
  const { tasks, loading, error, refetch, toggleDone, updateNotes } = useTasks()

  const [view, setView]       = useState('all')
  const [filterStatus, setFS] = useState('all')
  const [filterPrio, setFP]   = useState('all')
  const [query, setQuery]     = useState('')
  const [selectedId, select]  = useState(null)
  const [modalOpen, setModal] = useState(false)
  const [modalPresetCat, setModalPresetCat] = useState(null)

  // Sidebar counts (all non-done tasks)
  const counts = useMemo(() => ({
    all:     tasks.filter(t => t.status !== 'Done').length,
    mine:    tasks.filter(t => t.assignee?.id === 'PB' && t.status !== 'Done').length,
    overdue: tasks.filter(t => dateDiff(t.due_date) < 0 && t.status !== 'Done').length,
    week:    tasks.filter(t => { const d = dateDiff(t.due_date); return d >= 0 && d <= 7 && t.status !== 'Done' }).length,
  }), [tasks])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return tasks.filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterPrio   !== 'all' && t.priority !== filterPrio)  return false
      if (view === 'mine'    && t.assignee?.id !== 'PB')         return false
      if (view === 'overdue' && (dateDiff(t.due_date) >= 0 || t.status === 'Done')) return false
      if (view === 'week') {
        const d = dateDiff(t.due_date)
        if (d < 0 || d > 7 || t.status === 'Done') return false
      }
      if (q) {
        const hay = [t.title, t.category?.name, t.thread?.name, t.company?.name].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tasks, view, filterStatus, filterPrio, query])

  const selectedTask = tasks.find(t => t.id === selectedId) ?? null

  function openNewTask(presetCat = null) {
    setModalPresetCat(presetCat)
    setModal(true)
  }

  const VIEW_TITLES = { all: 'All tasks', mine: 'My tasks', overdue: 'Overdue tasks', week: 'Due this week' }

  return (
    <div className="ftm">
      <Sidebar
        view={view}
        onSetView={setView}
        counts={counts}
        tasks={tasks}
      />

      <div className="ftm-main">
        <Header
          title={VIEW_TITLES[view]}
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
            onAddInCategory={openNewTask}
          />
        </div>
      </div>

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
          onCreated={task => {
            refetch()
            setModal(false)
          }}
        />
      )}
    </div>
  )
}
