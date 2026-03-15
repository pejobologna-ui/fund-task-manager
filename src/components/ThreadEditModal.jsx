import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useLookups } from '../hooks/useTasks'
import VisibilityToggle from './VisibilityToggle'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = { gp: 'GP', associate: 'Associate', analyst: 'Analyst', viewer: 'Viewer' }

export default function ThreadEditModal({ threadId, onClose, onSaved }) {
  const { session } = useAuth()
  const { companies } = useLookups()
  const [profiles, setProfiles] = useState([])

  const [thread, setThread]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState(null)

  // Form state
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState('')
  const [companyId, setCompanyId]     = useState('')
  const [visibility, setVisibility]   = useState('team')
  const [shareWith, setShareWith]     = useState([])  // array of user UUIDs

  // Fetch thread + existing shares on mount
  useEffect(() => {
    if (!threadId) return
    Promise.all([
      supabase
        .from('threads')
        .select('id, name, category, description, visibility, created_by, company:companies(id, name)')
        .eq('id', threadId)
        .single(),
      supabase
        .from('thread_shares')
        .select('shared_with')
        .eq('thread_id', threadId),
      supabase
        .from('profiles')
        .select('id, full_name, initials, role')
        .order('full_name'),
    ]).then(([{ data: th }, { data: shares }, { data: profs }]) => {
      if (th) {
        setThread(th)
        setName(th.name ?? '')
        setDescription(th.description ?? '')
        setCategory(th.category ?? '')
        setCompanyId(th.company?.id ?? '')
        setVisibility(th.visibility ?? 'team')
      }
      setShareWith((shares ?? []).map(r => r.shared_with))
      setProfiles(profs ?? [])
      setLoading(false)
    })
  }, [threadId])

  function toggleShare(uid) {
    setShareWith(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])
  }

  function handleVisibilityChange(v) {
    setVisibility(v)
    if (v === 'team') setShareWith([])
  }

  async function handleSave() {
    if (!name.trim()) { setErr('Thread name is required.'); return }
    setSaving(true); setErr(null)

    const { error } = await supabase
      .from('threads')
      .update({
        name:        name.trim(),
        description: description.trim() || null,
        category:    category.trim()    || null,
        company_id:  companyId          || null,
        visibility,
      })
      .eq('id', threadId)

    if (error) { setSaving(false); setErr(error.message); return }

    // Sync thread_shares: delete all, re-insert current selection
    await supabase.from('thread_shares').delete().eq('thread_id', threadId)
    if ((visibility === 'restricted' || visibility === 'personal') && shareWith.length > 0) {
      await supabase.from('thread_shares').insert(
        shareWith.map(uid => ({ thread_id: threadId, shared_with: uid }))
      )
    }

    setSaving(false)
    onSaved()
  }

  const isDev = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
  const myUserId = isDev
    ? 'dev-00000000-0000-0000-0000-000000000000'
    : (session?.user?.id ?? '')

  // Ownership guard — only show edit controls to the owner (or in dev mode)
  const canEdit = !thread || thread.visibility === 'team' || thread.created_by === null || thread.created_by === myUserId

  const shareableProfiles = profiles.filter(p => p.id !== myUserId)

  return (
    <div className="ftm-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ftm-modal">
        <div className="ftm-mhdr">
          <span className="ftm-mtitle">Edit thread</span>
          <button className="ftm-dclose" onClick={onClose}>×</button>
        </div>

        <div className="ftm-mbody">
          {loading ? (
            <div className="ftm-loading">Loading…</div>
          ) : !canEdit ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>
              You don't have permission to edit this thread.
            </div>
          ) : (
            <div className="ftm-fgrid">
              <div className="ftm-ff full">
                <label className="ftm-flbl">Thread name</label>
                <input
                  autoFocus
                  className="ftm-finput"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="ftm-ff full">
                <label className="ftm-flbl">Description (optional)</label>
                <textarea
                  className="ftm-fta"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{ minHeight: 48 }}
                />
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Category</label>
                <input className="ftm-finput" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Deal Flow" />
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Company (optional)</label>
                <select className="ftm-fsel" value={companyId} onChange={e => setCompanyId(e.target.value)}>
                  <option value="">— None —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="ftm-ff full">
                <label className="ftm-flbl">Visibility</label>
                <VisibilityToggle value={visibility} onChange={handleVisibilityChange} />
              </div>

              {/* Share-with picker for restricted / personal */}
              {(visibility === 'restricted' || visibility === 'personal') && shareableProfiles.length > 0 && (
                <div className="ftm-ff full">
                  <label className="ftm-flbl">Share with</label>
                  <div className="ftm-share-picker">
                    {shareableProfiles.map(p => {
                      const checked = shareWith.includes(p.id)
                      return (
                        <div
                          key={p.id}
                          className={`ftm-share-row${checked ? ' selected' : ''}`}
                          onClick={() => toggleShare(p.id)}
                        >
                          <div className="ftm-share-avatar">{p.initials ?? '?'}</div>
                          <div className="ftm-share-info">
                            <span className="ftm-share-name">{p.full_name}</span>
                            <span className="ftm-share-role">{ROLE_LABELS[p.role] ?? p.role}</span>
                          </div>
                          <div className={`ftm-share-check${checked ? ' checked' : ''}`}>{checked ? '✓' : ''}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {err && <div className="ftm-ff full" style={{ color: '#a32d2d', fontSize: 11 }}>{err}</div>}
            </div>
          )}
        </div>

        {canEdit && !loading && (
          <div className="ftm-mftr">
            <button className="ftm-gbtn" onClick={onClose}>Cancel</button>
            <button className="ftm-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save thread'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
