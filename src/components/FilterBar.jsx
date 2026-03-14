const STATUS_OPTS = ['all', 'Open', 'In Progress', 'In Review', 'Done']
const PRIO_OPTS   = ['all', 'High', 'Medium', 'Low']

function Chip({ label, active, onClick }) {
  return (
    <div className={`ftm-chip${active ? ' active' : ''}`} onClick={onClick}>
      {label === 'all' ? 'All' : label}
    </div>
  )
}

export default function FilterBar({ filterStatus, filterPrio, onStatus, onPrio }) {
  return (
    <div className="ftm-filters">
      <span className="ftm-flabel">Status</span>
      {STATUS_OPTS.map(s => (
        <Chip key={s} label={s} active={filterStatus === s} onClick={() => onStatus(s)} />
      ))}
      <div className="ftm-fdiv" />
      <span className="ftm-flabel">Priority</span>
      {PRIO_OPTS.map(p => (
        <Chip key={p} label={p} active={filterPrio === p} onClick={() => onPrio(p)} />
      ))}
    </div>
  )
}
