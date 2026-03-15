import { useMemo, useState } from 'react'
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
  gp:        'General Partner',
  associate: 'Associate',
  analyst:   'Analyst',
  viewer:    'Viewer',
}

export default function Sidebar({ view, onSetView, navFilter, onNavFilter, counts, tasks, profile }) {
  const { signOut } = useAuth()
  const [collapsed, setCollapsed] = useState({ categories: false, companies: false, threads: false })

  function toggle(key) {
    setCollapsed(c => ({ ...c, [key]: !c[key] }))
  }

  function isNavActive(type, id) {
    return navFilter?.type === type && navFilter?.id === id
  }

  // Categories: only those with at least one active (non-done) task
  const categories = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (t.status === 'Done' || !t.category?.id) return
      if (!map[t.category.id]) map[t.category.id] = { id: t.category.id, name: t.category.name, count: 0 }
      map[t.category.id].count++
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [tasks])

  // Companies split into fund-level (type='other') and portfolio/prospect
  const companies = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (t.status === 'Done' || !t.company?.id) return
      if (!map[t.company.id]) {
        map[t.company.id] = { id: t.company.id, name: t.company.name, type: t.company.type, count: 0 }
      }
      map[t.company.id].count++
    })
    const all = Object.values(map)
    return {
      fund:      all.filter(c => c.type === 'other').sort((a, b) => b.count - a.count),
      portfolio: all.filter(c => c.type !== 'other').sort((a, b) => b.count - a.count),
    }
  }, [tasks])

  // Threads with done/total progress
  const threads = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (!t.thread?.id) return
      if (!map[t.thread.id]) map[t.thread.id] = { id: t.thread.id, name: t.thread.name, done: 0, total: 0 }
      map[t.thread.id].total++
      if (t.status === 'Done') map[t.thread.id].done++
    })
    return Object.values(map)
      .filter(th => th.total > 0)
      .sort((a, b) => b.total - a.total)
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
          <span className={`ftm-schevron${collapsed.categories ? ' closed' : ''}`}>▾</span>
        </div>
        {!collapsed.categories && categories.map(cat => (
          <div
            key={cat.id}
            className={`ftm-sitem${isNavActive('category', cat.id) ? ' active' : ''}`}
            onClick={() => onNavFilter({ type: 'category', id: cat.id, name: cat.name })}
          >
            <div className="ftm-sdot" style={{ background: '#b8933e55', border: '1px solid #b8933e' }} />
            <span className="ftm-sitem-label">{cat.name}</span>
            <span className="ftm-scnt">{cat.count}</span>
          </div>
        ))}
      </div>

      {/* Companies */}
      <div className="ftm-snav">
        <div className="ftm-sheading" onClick={() => toggle('companies')}>
          <span className="ftm-slabel" style={{ margin: 0 }}>Companies</span>
          <span className={`ftm-schevron${collapsed.companies ? ' closed' : ''}`}>▾</span>
        </div>
        {!collapsed.companies && (
          <>
            {companies.fund.length > 0 && (
              <>
                <div className="ftm-ssub-label">Fund-level</div>
                {companies.fund.map(co => (
                  <div
                    key={co.id}
                    className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                    onClick={() => onNavFilter({ type: 'company', id: co.id, name: co.name })}
                  >
                    <div className="ftm-sdot" style={{ background: '#9b71d455', border: '1px solid #9b71d4' }} />
                    <span className="ftm-sitem-label">{co.name}</span>
                    <span className="ftm-scnt">{co.count}</span>
                  </div>
                ))}
              </>
            )}
            {companies.portfolio.length > 0 && (
              <>
                <div className="ftm-ssub-label">Portfolio & Prospects</div>
                {companies.portfolio.map(co => (
                  <div
                    key={co.id}
                    className={`ftm-sitem ftm-sitem-sub${isNavActive('company', co.id) ? ' active' : ''}`}
                    onClick={() => onNavFilter({ type: 'company', id: co.id, name: co.name })}
                  >
                    <div className="ftm-sdot" style={{ background: '#378add55', border: '1px solid #378add' }} />
                    <span className="ftm-sitem-label">{co.name}</span>
                    <span className="ftm-scnt">{co.count}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Threads */}
      <div className="ftm-snav">
        <div className="ftm-sheading" onClick={() => toggle('threads')}>
          <span className="ftm-slabel" style={{ margin: 0 }}>Threads</span>
          <span className={`ftm-schevron${collapsed.threads ? ' closed' : ''}`}>▾</span>
        </div>
        {!collapsed.threads && threads.map(th => (
          <div
            key={th.id}
            className={`ftm-sitem${isNavActive('thread', th.id) ? ' active' : ''}`}
            onClick={() => onNavFilter({ type: 'thread', id: th.id, name: th.name })}
          >
            <div className="ftm-sdot" style={{ background: '#378add55', border: '1px solid #378add' }} />
            <span className="ftm-sitem-label">{th.name}</span>
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
