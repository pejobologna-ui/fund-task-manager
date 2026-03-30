import { useMemo, useState, useEffect } from 'react'
import StatsBar from './StatsBar'
import TaskRow from './TaskRow'
import { useLookups } from '../hooks/useTasks'

const MACRO_ORDER = ['Fund Operations', 'Investing', 'Portfolio Management', 'Reporting', 'Governance']

function buildGroups(tasks, groupBy) {
  if (groupBy === 'category') {
    const map = {}
    tasks.forEach(t => {
      const key = t.category?.macro_category ?? 'Uncategorized'
      ;(map[key] ??= []).push(t)
    })
    const ordered = MACRO_ORDER.filter(k => map[k])
    const extra   = Object.keys(map).filter(k => !MACRO_ORDER.includes(k)).sort()
    return [...ordered, ...extra].map(k => ({ key: k, label: k, tasks: map[k] }))
  }
  if (groupBy === 'company') {
    const map = {}
    tasks.forEach(t => {
      const key = t.company?.name ?? 'General'
      ;(map[key] ??= []).push(t)
    })
    return Object.keys(map).sort((a, b) => {
      // "General" always last
      if (a === 'General') return 1
      if (b === 'General') return -1
      return a.localeCompare(b)
    }).map(k => ({ key: k, label: k, tasks: map[k] }))
  }
  // 'none' — flat list
  return [{ key: '__flat__', label: null, tasks }]
}

export default function TaskList({
  tasks, allTasks, loading, error,
  selectedId, onSelect, onToggle, onUpdate,
  onAddInCategory, onOpenThread,
  groupBy = 'none',
}) {
  const { users, categories, companies, threads } = useLookups()
  const [collapsed, setCollapsed] = useState({})

  // Reset collapse state whenever grouping mode changes
  useEffect(() => { setCollapsed({}) }, [groupBy])

  const groups = useMemo(() => buildGroups(tasks, groupBy), [tasks, groupBy])

  if (loading) return <div className="ftm-loading">Loading tasks…</div>
  if (error)   return <div className="ftm-error">Error: {error}</div>

  const isEmpty = groups.every(g => g.tasks.length === 0)

  return (
    <>
      <StatsBar tasks={allTasks} />
      {isEmpty && (
        <div className="ftm-empty">No tasks match current filters.</div>
      )}
      {!isEmpty && groups.map(({ key, label, tasks: gt }) => {
        const isCollapsed = !!collapsed[key]
        const openCount   = gt.filter(t => t.status !== 'Done').length

        return (
          <div key={key} className="ftm-group">
            {/* Group header — only shown when groupBy !== 'none' */}
            {label !== null && (
              <div
                className="ftm-ghdr"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))}
              >
                <span className="ftm-gtitle">
                  <span className={`ftm-gcollapse${isCollapsed ? '' : ' open'}`}>▸</span>
                  {label}
                </span>
                <span className="ftm-gcnt">{openCount} open · {gt.length} total</span>
              </div>
            )}

            {!isCollapsed && (
              <div className="ftm-table">
                <div className="ftm-row hdr">
                  <div />
                  <div className="ftm-ch">Task</div>
                  <div className="ftm-ch">Status</div>
                  <div className="ftm-ch">Priority</div>
                  <div className="ftm-ch">Assignee</div>
                  <div className="ftm-ch">Due</div>
                  <div />
                </div>
                {gt.map(t => (
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
                <div className="ftm-addrow" onClick={() => onAddInCategory(label)}>
                  <span>+</span> {label ? `Add task in ${label}` : 'Add task'}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
