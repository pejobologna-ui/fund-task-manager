import { useMemo } from 'react'
import { STATUS_CLASS, PRIORITY_CLASS } from '../constants'
import { formatDue, dueCls } from '../utils'

function StatusBadge({ status }) {
  return <span className={`ftm-badge ${STATUS_CLASS[status] ?? 's-open'}`}>{status}</span>
}

function PriorityBadge({ priority }) {
  return <span className={`ftm-badge ${PRIORITY_CLASS[priority] ?? 'p-md'}`}>{priority}</span>
}

function StatsBar({ tasks }) {
  const s = status => tasks.filter(t => t.status === status).length
  return (
    <div className="ftm-stats">
      <div className="ftm-stat">
        <div className="ftm-stat-label">Open</div>
        <div className="ftm-stat-val">{s('Open')}</div>
        <div className="ftm-stat-sub">to start</div>
      </div>
      <div className="ftm-stat">
        <div className="ftm-stat-label">In Progress</div>
        <div className="ftm-stat-val">{s('In Progress')}</div>
        <div className="ftm-stat-sub">active</div>
      </div>
      <div className="ftm-stat">
        <div className="ftm-stat-label">In Review</div>
        <div className="ftm-stat-val">{s('In Review')}</div>
        <div className="ftm-stat-sub">sign-off</div>
      </div>
      <div className="ftm-stat">
        <div className="ftm-stat-label">Done</div>
        <div className="ftm-stat-val">{s('Done')}</div>
        <div className="ftm-stat-sub">completed</div>
      </div>
    </div>
  )
}

function TaskRow({ task, selected, onSelect, onToggle }) {
  const isDone = task.status === 'Done'
  const dc = dueCls(task.due_date, task.status)

  return (
    <div
      className="ftm-row"
      style={selected ? { background: 'var(--gold-bg)' } : undefined}
      onClick={() => onSelect(task.id)}
    >
      <div
        className={`ftm-check${isDone ? ' chk' : ''}`}
        onClick={e => { e.stopPropagation(); onToggle(task.id, task.status) }}
      >
        {isDone ? '✓' : ''}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className={`ftm-ttitle${isDone ? ' done' : ''}`}>{task.title}</div>
        <div className="ftm-tsub">
          {task.company?.name && task.company.name !== 'General (Fund)' ? `${task.company.name} · ` : ''}
          {task.thread?.name ?? '—'}
        </div>
      </div>
      <div style={{ overflow: 'hidden' }}>
        <span className="ftm-badge b-cat" style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex' }}>
          {(task.thread?.name ?? '').split('—')[0].trim()}
        </span>
      </div>
      <StatusBadge status={task.status} />
      <PriorityBadge priority={task.priority} />
      <div className="ftm-asgn">
        <div className="ftm-aavatar">{task.assignee?.initials ?? '?'}</div>
        <div className="ftm-aname">{(task.assignee?.name ?? '—').split(' ')[0]}</div>
      </div>
      <div className={`ftm-due${dc ? ` ${dc}` : ''}`}>{formatDue(task.due_date, task.status)}</div>
      <button className="ftm-more" onClick={e => { e.stopPropagation(); onSelect(task.id) }}>⋯</button>
    </div>
  )
}

export default function TaskList({ tasks, allTasks, loading, error, selectedId, onSelect, onToggle, onAddInCategory }) {
  const groups = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      const cat = t.category?.name ?? 'Other'
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
                <div className="ftm-ch">Thread</div>
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
