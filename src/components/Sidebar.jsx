import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

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
  gp:         'General Partner',
  associate:  'Associate',
  analyst:    'Analyst',
  viewer:     'Viewer',
}

export default function Sidebar({ view, onSetView, counts, tasks, profile }) {
  const { signOut } = useAuth()

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

  const displayName = profile?.full_name ?? '—'
  const initials    = profile?.initials  ?? '?'
  const roleLabel   = ROLE_LABELS[profile?.role] ?? profile?.role ?? ''

  return (
    <aside className="ftm-sidebar">
      <div className="ftm-brand">
        <div className="ftm-brand-name">Fund Manager</div>
        <div className="ftm-brand-sub">TASK TRACKER</div>
      </div>

      <div className="ftm-snav">
        <div className="ftm-slabel">Team</div>
        {TEAM_VIEWS.map(v => (
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

      <div className="ftm-snav">
        <div className="ftm-slabel">Personal</div>
        {PERSONAL_VIEWS.map(v => (
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
          <div className="ftm-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ftm-uname" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div className="ftm-urole">{roleLabel}</div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 14,
              padding: '2px 4px',
              borderRadius: 4,
              lineHeight: 1,
              flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >
            ↪
          </button>
        </div>
      </div>
    </aside>
  )
}
