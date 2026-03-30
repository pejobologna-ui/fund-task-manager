import SectionHeader from './SectionHeader'

const PERSONAL_VIEWS = [
  { key: 'personal', label: 'My personal tasks', color: '#9b71d4' },
  { key: 'shared',   label: 'Shared with me',    color: '#d47171' },
]

export default function SidebarPersonalSection({ view, navFilter, counts, collapsed, onToggle, onSetView }) {
  return (
    <div className="ftm-snav">
      <SectionHeader label="Personal" collapsed={collapsed} onToggle={onToggle} />
      {!collapsed && PERSONAL_VIEWS.map(v => (
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
