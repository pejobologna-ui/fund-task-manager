import SectionHeader from './SectionHeader'

export default function SidebarThreadsSection({
  activeThreads,
  archivedThreads,
  collapsed,
  collapsedArchived,
  onToggle,
  onToggleArchived,
  onOpenThread,
  onEditThread,
  onNewThread,
  onContextMenu,
}) {
  return (
    <div className="ftm-snav">
      <SectionHeader
        label="Threads"
        collapsed={collapsed}
        onToggle={onToggle}
        onAdd={onNewThread}
      />
      {!collapsed && (
        <>
          {activeThreads.map(th => (
            <div
              key={th.id}
              className="ftm-sitem"
              onClick={() => onOpenThread(th.id)}
              onContextMenu={e => onContextMenu(e, [
                { label: '✎ Edit thread', action: () => onEditThread?.(th.id) },
                { label: '↗ Open',        action: () => onOpenThread(th.id) },
              ])}
            >
              <div className="ftm-sdot" style={{ background: '#378add55', border: '1px solid #378add' }} />
              <span className="ftm-sitem-label">{th.name}</span>
              <button
                className="ftm-sedit-btn"
                title="Edit thread"
                onClick={e => { e.stopPropagation(); onEditThread?.(th.id) }}
              >✎</button>
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

          {archivedThreads.length > 0 && (
            <>
              <div
                className="ftm-ssub-heading ftm-ssub-heading-clickable"
                onClick={onToggleArchived}
              >
                <span className="ftm-ssub-label" style={{ margin: 0, opacity: 0.6 }}>Archived</span>
                <span className="ftm-scnt" style={{ opacity: 0.5 }}>{archivedThreads.length}</span>
                <span className={`ftm-schevron ftm-ssub-chevron${collapsedArchived !== false ? ' closed' : ''}`}>▾</span>
              </div>
              {collapsedArchived === false && archivedThreads.map(th => (
                <div
                  key={th.id}
                  className="ftm-sitem ftm-sitem-sub"
                  style={{ opacity: 0.6 }}
                  onClick={() => onOpenThread(th.id)}
                >
                  <div className="ftm-sdot" style={{ background: '#666', border: '1px solid #888' }} />
                  <span className="ftm-sitem-label">{th.name}</span>
                  <div className="ftm-sprog">
                    <span className="ftm-sprog-txt">{th.done}/{th.total}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
