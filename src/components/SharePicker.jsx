import { useState, useRef, useEffect } from 'react'

const ROLE_LABELS = { gp: 'GP', associate: 'Associate', analyst: 'Analyst', viewer: 'Viewer' }
const EVERYONE = '__everyone__'

/**
 * Google-Calendar-style share picker.
 *
 * Props:
 *   selected    – array of profile UUIDs (or [EVERYONE])
 *   onChange    – (nextSelected: string[]) => void
 *   profiles   – all selectable profiles (already filtered to exclude current user)
 */
export default function SharePicker({ selected, onChange, profiles }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const isEveryone = selected.includes(EVERYONE)

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const q = query.toLowerCase()
  const suggestions = [
    // "Everyone" option always first
    ...(('everyone'.includes(q) || !q) && !isEveryone
      ? [{ id: EVERYONE, label: 'Everyone', sub: 'Share with all team members', initials: '👥' }]
      : []),
    // Individual profiles (not already selected, not when Everyone is chosen)
    ...(!isEveryone
      ? profiles
          .filter(p => !selected.includes(p.id))
          .filter(p => {
            const displayName = (p.full_name || p.name || '').toLowerCase()
            return !q || displayName.includes(q) || (ROLE_LABELS[p.role] ?? '').toLowerCase().includes(q)
          })
          .map(p => ({ id: p.id, label: p.full_name || p.name, sub: ROLE_LABELS[p.role] ?? p.role, initials: p.initials ?? '?' }))
      : []),
  ]

  function select(id) {
    if (id === EVERYONE) {
      onChange([EVERYONE])
    } else {
      onChange([...selected.filter(s => s !== EVERYONE), id])
    }
    setQuery('')
    inputRef.current?.focus()
  }

  function remove(id) {
    onChange(selected.filter(s => s !== id))
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      onChange(selected.slice(0, -1))
    }
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  // Resolve profile info for chips
  function chipLabel(id) {
    if (id === EVERYONE) return { label: 'Everyone', initials: '👥' }
    const p = profiles.find(pr => pr.id === id)
    return p ? { label: p.full_name || p.name, initials: p.initials ?? '?' } : { label: '?', initials: '?' }
  }

  const placeholder = selected.length === 0
    ? 'Add people or Everyone…'
    : ''

  return (
    <div ref={wrapRef} className="ftm-sp-wrap">
      <div className="ftm-sp-box" onClick={() => { inputRef.current?.focus(); setOpen(true) }}>
        {selected.map(id => {
          const c = chipLabel(id)
          return (
            <span key={id} className={`ftm-sp-chip${id === EVERYONE ? ' everyone' : ''}`}>
              <span className="ftm-sp-chip-avatar">{c.initials}</span>
              {c.label}
              <button
                className="ftm-sp-chip-x"
                onClick={e => { e.stopPropagation(); remove(id) }}
              >×</button>
            </span>
          )
        })}
        <input
          ref={inputRef}
          className="ftm-sp-input"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="ftm-sp-dropdown">
          {suggestions.map(s => (
            <div
              key={s.id}
              className="ftm-sp-option"
              onMouseDown={e => { e.preventDefault(); select(s.id) }}
            >
              <div className={`ftm-sp-opt-avatar${s.id === EVERYONE ? ' everyone' : ''}`}>{s.initials}</div>
              <div className="ftm-sp-opt-info">
                <div className="ftm-sp-opt-name">{s.label}</div>
                <div className="ftm-sp-opt-sub">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.length === 0 && (
        <div className="ftm-sp-hint">Only you will see this task</div>
      )}
    </div>
  )
}

export { EVERYONE }
