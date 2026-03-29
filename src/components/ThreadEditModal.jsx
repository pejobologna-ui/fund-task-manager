import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useLookups } from '../hooks/useTasks'

const STATUS_OPTIONS = ['active', 'completed', 'archived']

export default function ThreadEditModal({ threadId, onClose, onSaved, onDeleted }) {
  const { companies, users } = useLookups()

  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState(null)

  // Form state
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [companyId, setCompanyId]     = useState('')
  const [status, setStatus]           = useState('active')
  const [assigneeId, setAssigneeId]   = useState('')
  const [dueDate, setDueDate]         = useState('')

  // Fetch thread on mount
  useEffect(() => {
    if (!threadId) return
    supabase
      .from('threads')
      .select('id, name, description, status, assignee_id, due_date, company:companies(id, name)')
      .eq('id', threadId)
      .single()
      .then(({ data: th }) => {
        if (th) {
          setName(th.name ?? '')
          setDescription(th.description ?? '')
          setCompanyId(th.company?.id ?? '')
          setStatus(th.status ?? 'active')
          setAssigneeId(th.assignee_id ?? '')
          setDueDate(th.due_date ?? '')
        }
        setLoading(false)
      })
  }, [threadId])

  async function handleSave() {
    if (!name.trim()) { setErr('Thread name is required.'); return }
    setSaving(true); setErr(null)

    const { error } = await supabase
      .from('threads')
      .update({
        name:        name.trim(),
        description: description.trim() || null,
        company_id:  companyId  || null,
        status,
        assignee_id: assigneeId || null,
        due_date:    dueDate    || null,
      })
      .eq('id', threadId)

    if (error) { setSaving(false); setErr(error.message); return }

    setSaving(false)
    onSaved()
  }

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
          ) : (
            <div className="ftm-fgrid">
              <div className="ftm-ff full">
                <label className="ftm-flbl">Thread name</label>
                <input
                  autoFocus
                  className="ftm-finput"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
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
                <label className="ftm-flbl">Company (optional)</label>
                <select className="ftm-fsel" value={companyId} onChange={e => setCompanyId(e.target.value)}>
                  <option value="">— None —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Status</label>
                <select className="ftm-fsel" value={status} onChange={e => setStatus(e.target.value)}>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Assignee (optional)</label>
                <select className="ftm-fsel" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="ftm-ff">
                <label className="ftm-flbl">Due date (optional)</label>
                <input
                  className="ftm-finput"
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
              {err && <div className="ftm-ff full" style={{ color: '#a32d2d', fontSize: 11 }}>{err}</div>}
            </div>
          )}
        </div>

        {!loading && (
          <div className="ftm-mftr">
            {onDeleted && (
              <button
                className="ftm-gbtn"
                style={{ color: '#a32d2d', marginRight: 'auto' }}
                onClick={async () => {
                  if (!window.confirm('Delete this thread and all its tasks? This cannot be undone.')) return
                  const { error } = await supabase.from('tasks').delete().eq('thread_id', threadId)
                  if (error) { setErr(error.message); return }
                  const { error: thErr } = await supabase.from('threads').delete().eq('id', threadId)
                  if (thErr) { setErr(thErr.message); return }
                  onDeleted()
                }}
              >
                Delete thread
              </button>
            )}
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
