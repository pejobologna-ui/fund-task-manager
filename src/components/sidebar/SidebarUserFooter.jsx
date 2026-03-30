const ROLE_LABELS = {
  gp: 'General Partner', associate: 'Associate', analyst: 'Analyst', viewer: 'Viewer',
}

export default function SidebarUserFooter({ profile, onManage, onSignOut }) {
  const displayName = profile?.full_name ?? '—'
  const initials    = profile?.initials  ?? '?'
  const roleLabel   = ROLE_LABELS[profile?.role] ?? profile?.role ?? ''

  return (
    <div className="ftm-sbottom">
      <div className="ftm-user">
        <div className="ftm-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ftm-uname" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          <div className="ftm-urole">{roleLabel}</div>
        </div>
        <button className="ftm-sgear-btn" onClick={onManage} title="Manage">⚙</button>
        <button
          onClick={onSignOut}
          title="Sign out"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', fontSize: 14,
            padding: '2px 4px', borderRadius: 4, lineHeight: 1, flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >↪</button>
      </div>
    </div>
  )
}
