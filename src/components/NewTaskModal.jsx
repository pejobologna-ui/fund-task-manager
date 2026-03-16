import { useState } from 'react'
import { useLookups, useProfiles, createTaskWithShares } from '../hooks/useTasks'
import { useAuth } from '../context/AuthContext'
import { PRIORITIES } from '../constants'
import SharePicker, { EVERYONE } from './SharePicker'

export default function NewTaskModal({ presetCategory, navFilter, onClose, onCreated }) {
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
  })
  const [shareWith, setShareWith] = useState([EVERYONE])  // default: shared with everyone
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState(null)
  const [defaultsApplied, setDefaultsApplied] = useState(false)

  // Resolve preset category & navFilter defaults once lookups load
  if (!defaultsApplied && categories.length > 0) {
    const updates = {}

    // presetCategory (from "Add task in <category>" button in task list)
    if (presetCategory) {
      const found = categories.find(c => c.name === presetCategory)
      if (found) updates.category_id = found.id
    }

    // navFilter defaults: if user is viewing a specific category/company, pre-select it
    if (navFilter) {
      if (navFilter.type === 'category' && !updates.category_id) {
        updates.category_id = navFilter.id
      }
      if (navFilter.type === 'company') {
        updates.company_id = navFilter.id
      }
    }

    if (Object.keys(updates).length > 0) {
      setForm(f => ({ ...f, ...updates }))
    }
    setDefaultsApplied(true)
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.title.trim()) { setErr('Title is required.'); return }
    if (!form.category_id)  { setErr('Category is required.'); return }

    // Derive visibility from shareWith
    const isEveryone = shareWith.includes(EVERYONE)
    const visibility = isEveryone ? 'team' : shareWith.length > 0 ? 'restricted' : 'personal'
    const shareIds = isEveryone ? [] : shareWith

    setSaving(true)
    setErr(null)
    const { data, error } = await createTaskWithShares({ ...form, visibility }, shareIds)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onCreated(data)
  }

  // Use profiles if available, fall back to users (dev mode has no profiles)
  const peopleList = profiles.length > 0 ? profiles : users.map(u => ({ ...u, full_name: u.name }))
  const shareableProfiles = peopleList.filter(p => p.id !== session?.user?.id)

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

              <div className="ftm-ff full">
                <label className="ftm-flbl">Title</label>
                <input className="ftm-finput" placeholder="Task title…" value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
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

              <div className="ftm-ff">
                <label className="ftm-flbl">Assignee</label>
                <select className="ftm-fsel" value={form.assignee_id} onChange={e => set('assignee_id', e.target.value)}>
                  <option value="">— Unassigned —</option>
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

              {/* Share picker — replaces old visibility toggle */}
              <div className="ftm-ff full">
                <label className="ftm-flbl">Shared with</label>
                <SharePicker
                  selected={shareWith}
                  onChange={setShareWith}
                  profiles={shareableProfiles}
                />
              </div>

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
