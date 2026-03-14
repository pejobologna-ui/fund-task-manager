import { useMemo } from 'react'

const VIEWS = [
  { key: 'all',     label: 'All tasks',      color: '#b8933e' },
  { key: 'mine',    label: 'My tasks',       color: '#5dcaa5' },
  { key: 'overdue', label: 'Overdue',        color: '#e24b4a' },
  { key: 'week',    label: 'Due this week',  color: '#378add' },
]

export default function Sidebar({ view, onSetView, counts, tasks }) {
  const catCounts = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (t.status !== 'Done' && t.category?.name) {
        map[t.category.name] = (map[t.category.name] ?? 0) + 1
      }
    })
    return map
  }, [tasks])

  const activeThreads = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (t.status !== 'Done' && t.thread?.name) {
        map[t.thread.name] = (map[t.thread.name] ?? 0) + 1
      }
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [tasks])

  return (
    <aside className="ftm-sidebar">
      <div className="ftm-brand">
        <div className="ftm-brand-name">Fund Manager</div>
        <div className="ftm-brand-sub">TASK TRACKER</div>
      </div>

      <div className="ftm-snav">
        <div className="ftm-slabel">Views</div>
        {VIEWS.map(v => (
          <div
            key={v.key}
            className={`ftm-sitem${view === v.key ? ' active' : ''}`}
            onClick={() => onSetView(v.key)}
          >
            <div className="ftm-sdot" style={{ background: v.color }} />
            {v.label}
            <span className="ftm-scnt">{counts[v.key] ?? 0}</span>
          </div>
        ))}
      </div>

      {Object.keys(catCounts).length > 0 && (
        <div className="ftm-snav">
          <div className="ftm-slabel">Categories</div>
          {Object.entries(catCounts).map(([name, n]) => (
            <div key={name} className="ftm-sitem" style={{ fontSize: 11 }}>
              <div className="ftm-sdot" style={{ background: '#b8933e55', border: '1px solid #b8933e' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</span>
              <span className="ftm-scnt">{n}</span>
            </div>
          ))}
        </div>
      )}

      {activeThreads.length > 0 && (
        <div className="ftm-snav">
          <div className="ftm-slabel">Threads</div>
          {activeThreads.map(([name, n]) => (
            <div key={name} className="ftm-sitem" style={{ fontSize: 11 }}>
              <div className="ftm-sdot" style={{ background: '#378add55', border: '1px solid #378add' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</span>
              <span className="ftm-scnt">{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="ftm-sbottom">
        <div className="ftm-user">
          <div className="ftm-avatar">PB</div>
          <div>
            <div className="ftm-uname">Pietro B.</div>
            <div className="ftm-urole">General Partner</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
