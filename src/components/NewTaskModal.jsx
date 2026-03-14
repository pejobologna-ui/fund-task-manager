import { useState } from 'react'
import { useLookups, createTask } from '../hooks/useTasks'
import { PRIORITIES } from '../constants'

export default function NewTaskModal({ presetCategory, onClose, onCreated }) {
  const { categories, threads, companies, users, loading } = useLookups()

  const defaultCatId = categories.find(c => c.name === presetCategory)?.id ?? ''

  const [form, setForm] = useState({
    title:       '',
    description: '',
    category_id: defaultCatId,
    thread_id:   '',
    company_id:  '',
    assignee_id: '',
    priority:    'Medium',
    due_date:    '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)

  // Update category_id once lookups load
  if (form.category_id === '' && categories.length > 0 && presetCategory) {
    const found = categories.find(c => c.name === presetCategory)
    if (found) setForm(f => ({ ...f, category_id: found.id }))
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.title.trim()) { setErr('Title is required.'); return }
    if (!form.category_id)  { setErr('Category is required.'); return }
    if (!form.assignee_id)  { setErr('Assignee is required.'); return }
    setSaving(true)
    setErr(null)
    const { data, error } = await createTask(form)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onCreated(data)
  }

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
                  <option value="">Select…</option>
                  {threads.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Company</label>
                <select className="ftm-fsel" value={form.company_id} onChange={e => set('company_id', e.target.value)}>
                  <option value="">None</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Assignee</label>
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
