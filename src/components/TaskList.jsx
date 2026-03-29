import { useMemo } from 'react'
import StatsBar from './StatsBar'
import TaskRow from './TaskRow'
import { useLookups } from '../hooks/useTasks'

export default function TaskList({ tasks, allTasks, loading, error, selectedId, onSelect, onToggle, onUpdate, onAddInCategory, onOpenThread }) {
  const { users, categories, companies, threads } = useLookups()

  const groups = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      const cat = t.category?.name ?? 'Uncategorized'
      if (!map[cat]) map[cat] = []
      map[cat].push(t)
    })
    return map
  }, [tasks])

  if (loading) return <div className="ftm-loading">Loading tasks…</div>
  if (error)   return <div className="ftm-error">Error: {error}</div>

  return (
    <>
      <StatsBar tasks={allTasks} />
      {Object.keys(groups).length === 0 && (
        <div className="ftm-empty">No tasks match current filters.</div>
      )}
      {Object.entries(groups).map(([cat, ts]) => {
        const open = ts.filter(t => t.status !== 'Done').length
        return (
          <div key={cat} className="ftm-group">
            <div className="ftm-ghdr">
              <span className="ftm-gtitle">{cat}</span>
              <span className="ftm-gcnt">{open} open · {ts.length} total</span>
            </div>
            <div className="ftm-table">
              <div className="ftm-row hdr">
                <div />
                <div className="ftm-ch">Task</div>
                <div className="ftm-ch">Labels</div>
                <div className="ftm-ch">Status</div>
                <div className="ftm-ch">Priority</div>
                <div className="ftm-ch">Assignee</div>
                <div className="ftm-ch">Due</div>
                <div />
              </div>
              {ts.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  selected={t.id === selectedId}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  onUpdate={onUpdate}
                  users={users}
                  categories={categories}
                  companies={companies}
                  threads={threads}
                  onOpenThread={onOpenThread}
                />
              ))}
              <div className="ftm-addrow" onClick={() => onAddInCategory(cat)}>
                <span>+</span> Add task in {cat}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
