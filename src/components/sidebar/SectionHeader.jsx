export default function SectionHeader({ label, collapsed, onToggle, onAdd, showGear }) {
  return (
    <div className="ftm-sheading" onClick={onToggle}>
      <span className="ftm-slabel" style={{ margin: 0 }}>{label}</span>
      {showGear && (
        <button
          className="ftm-snew-btn ftm-sgear-placeholder"
          title="Settings (coming soon)"
          onClick={e => e.stopPropagation()}
          style={{ opacity: 0.35, cursor: 'default' }}
        >⚙</button>
      )}
      {onAdd && (
        <button
          className="ftm-snew-btn"
          title={`Add ${label.toLowerCase()}`}
          onClick={e => { e.stopPropagation(); onAdd() }}
        >+</button>
      )}
      <span className={`ftm-schevron${collapsed ? ' closed' : ''}`}>▾</span>
    </div>
  )
}
