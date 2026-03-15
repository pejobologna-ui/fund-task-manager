import { useState } from 'react'
import { useLookups, useProfiles, createTaskWithShares } from '../hooks/useTasks'
import { useAuth } from '../context/AuthContext'
import { PRIORITIES } from '../constants'

const ROLE_LABELS = { gp: 'GP', associate: 'Associate', analyst: 'Analyst', viewer: 'Viewer' }

export default function NewTaskModal({ presetCategory, onClose, onCreated }) {
  const { session } = useAuth()
  const { categories, threads, companies, users, loading: lookupsLoading } = useLookups()
  const { profiles, loading: profilesLoading }                             = useProfiles()

  const loading = lookupsLoading || profilesLoading

  const [form, setForm] = useState({
    title:       '',
    description: '',
    category_id: '',
    thread_id:   '',
    company_id:  '',
    assignee_id: '',
    priority:    'Medium',
    due_date:    '',
    visibility:  'team',
  })
  const [shareWith, setShareWith] = useState([])  // array of profile UUIDs
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState(null)

  // Resolve preset category once lookups load
  if (form.category_id === '' && categories.length > 0 && presetCategory) {
    const found = categories.find(c => c.name === presetCategory)
    if (found) setForm(f => ({ ...f, category_id: found.id }))
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function setVisibility(v) {
    setForm(f => ({ ...f, visibility: v }))
    if (v === 'team') setShareWith([])
  }

  function toggleShare(profileId) {
    setShareWith(prev =>
      prev.includes(profileId) ? prev.filter(id => id !== profileId) : [...prev, profileId]
    )
  }

  async function handleSave() {
    if (!form.title.trim()) { setErr('Title is required.'); return }
    if (!form.category_id)  { setErr('Category is required.'); return }
    if (form.visibility === 'team' && !form.assignee_id) {
      setErr('Assignee is required for team tasks.'); return
    }
    // thread_id and company_id are optional — empty string = null (No thread / No company)
    setSaving(true)
    setErr(null)
    const { data, error } = await createTaskWithShares(form, shareWith)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onCreated(data)
  }

  // Exclude the current auth user from the share picker
  const shareableProfiles = profiles.filter(p => p.id !== session?.user?.id)

  const isPersonal = form.visibility === 'personal'

  return (
    <div className="ftm-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ftm-modal">
        <div className="ftm-mhdr">
          <span className="ftm-mtitle">New task</span>
          <button className="ftm-dclose" onClick={onClose}>×</button>
        </div>

        <div className="ftm-mbody">
          {loading ? (
            <div className="ftm-loading">Loading…</div>
          ) : (
            <div className="ftm-fgrid">

              {/* Visibility toggle — full width, first field */}
              <div className="ftm-ff full">
                <label className="ftm-flbl">Visibility</label>
                <div className="ftm-vis-toggle">
                  <button
                    type="button"
                    className={`ftm-vis-btn${!isPersonal ? ' active' : ''}`}
                    onClick={() => setVisibility('team')}
                  >
                    🏢 Team
                  </button>
                  <button
                    type="button"
                    className={`ftm-vis-btn${isPersonal ? ' active personal' : ''}`}
                    onClick={() => setVisibility('personal')}
                  >
                    🔒 Personal
                  </button>
                </div>
              </div>

              <div className="ftm-ff full">
                <label className="ftm-flbl">Title</label>
                <input className="ftm-finput" placeholder="Task title…" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div className="ftm-ff full">
                <label className="ftm-flbl">Description</label>
                <textarea className="ftm-fta" placeholder="Optional…" value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Category</label>
                <select className="ftm-fsel" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                  <option value="">Select…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Thread</label>
                <select className="ftm-fsel" value={form.thread_id} onChange={e => set('thread_id', e.target.value)}>
                  <option value="">— No thread —</option>
                  {threads.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Company</label>
                <select className="ftm-fsel" value={form.company_id} onChange={e => set('company_id', e.target.value)}>
                  <option value="">— General / No company —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Assignee: required for team, optional for personal */}
              <div className="ftm-ff">
                <label className="ftm-flbl">Assignee{isPersonal ? ' (optional)' : ''}</label>
                <select className="ftm-fsel" value={form.assignee_id} onChange={e => set('assignee_id', e.target.value)}>
                  <option value="">Select…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>

              <div className="ftm-ff">
                <label className="ftm-flbl">Priority</label>
                <select className="ftm-fsel" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Due date</label>
                <input className="ftm-finput" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
              </div>

              {/* Share-with picker — only shown for personal tasks */}
              {isPersonal && shareableProfiles.length > 0 && (
                <div className="ftm-ff full">
                  <label className="ftm-flbl">Share with (optional)</label>
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
                          <div className={`ftm-share-check${checked ? ' checked' : ''}`}>
                            {checked ? '✓' : ''}
                          </div>
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

        <div className="ftm-mftr">
          <button className="ftm-gbtn" onClick={onClose}>Cancel</button>
          <button className="ftm-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  )
}
