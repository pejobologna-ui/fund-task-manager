export default function StatsBar({ tasks }) {
  const s = status => tasks.filter(t => t.status === status).length
  return (
    <div className="ftm-stats">
      <div className="ftm-stat">
        <div className="ftm-stat-label">Open</div>
        <div className="ftm-stat-val">{s('Open')}</div>
        <div className="ftm-stat-sub">to start</div>
      </div>
      <div className="ftm-stat">
        <div className="ftm-stat-label">In Progress</div>
        <div className="ftm-stat-val">{s('In Progress')}</div>
        <div className="ftm-stat-sub">active</div>
      </div>
      <div className="ftm-stat">
        <div className="ftm-stat-label">In Review</div>
        <div className="ftm-stat-val">{s('In Review')}</div>
        <div className="ftm-stat-sub">sign-off</div>
      </div>
      <div className="ftm-stat">
        <div className="ftm-stat-label">Done</div>
        <div className="ftm-stat-val">{s('Done')}</div>
        <div className="ftm-stat-sub">completed</div>
      </div>
    </div>
  )
}
