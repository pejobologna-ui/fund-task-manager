export default function Header({ title, query, onQuery, onNewTask }) {
  return (
    <div className="ftm-top">
      <span className="ftm-top-title">{title}</span>
      <div className="ftm-spacer" />
      <div className="ftm-search">
        <span style={{ color: '#9aa3b8', fontSize: 12 }}>⌕</span>
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={e => onQuery(e.target.value)}
        />
      </div>
      <button className="ftm-btn" onClick={onNewTask}>+ New task</button>
    </div>
  )
}
