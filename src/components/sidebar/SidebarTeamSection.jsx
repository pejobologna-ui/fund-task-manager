import SectionHeader from './SectionHeader'

const TEAM_VIEWS = [
  { key: 'all',     label: 'All tasks',     color: '#b8933e' },
  { key: 'mine',    label: 'My tasks',      color: '#5dcaa5' },
  { key: 'overdue', label: 'Overdue',       color: '#e24b4a' },
  { key: 'week',    label: 'Due this week', color: '#378add' },
]

export default function SidebarTeamSection({ view, navFilter, counts, collapsed, onToggle, onSetView }) {
  return (
    <div className="ftm-snav">
      <SectionHeader label="Team" collapsed={collapsed} onToggle={onToggle} />
      {!collapsed && TEAM_VIEWS.map(v => (
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
  )
}
