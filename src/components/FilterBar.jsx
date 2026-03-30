const STATUS_OPTS = ['all', 'Open', 'In Progress', 'In Review', 'Done']
const PRIO_OPTS   = ['all', 'High', 'Medium', 'Low']
const MACRO_CATS  = ['Fund Operations', 'Investing', 'Portfolio Management', 'Reporting', 'Governance']
const GROUP_OPTS  = [
  { value: 'none',     label: 'None'     },
  { value: 'category', label: 'Category' },
  { value: 'company',  label: 'Company'  },
]

function Chip({ label, active, gold, onClick }) {
  const cls = active ? (gold ? ' active-cat' : ' active') : ''
  return (
    <div className={`ftm-chip${cls}`} onClick={onClick}>
      {label === 'all' ? 'All' : label}
    </div>
  )
}

export default function FilterBar({
  filterStatus, filterPrio, onStatus, onPrio,
  categories = [], filterCategory = 'all', onCategory,
  groupBy = 'none', onGroupBy,
}) {
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

      <div className="ftm-fdiv" />
      <span className="ftm-flabel">Category</span>
      <Chip label="all" active={filterCategory === 'all'} gold onClick={() => onCategory('all')} />
      {MACRO_CATS.map(m => (
        <Chip key={m} label={m} active={filterCategory === m} gold onClick={() => onCategory(m)} />
      ))}

      <select
        className="ftm-groupby-sel"
        value={groupBy}
        onChange={e => onGroupBy(e.target.value)}
      >
        {GROUP_OPTS.map(o => (
          <option key={o.value} value={o.value}>Group: {o.label}</option>
        ))}
      </select>
    </div>
  )
}
