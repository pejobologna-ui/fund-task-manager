import { useState, useEffect, useRef } from 'react'

const STATUSES = ['Open', 'In Progress', 'In Review', 'Done']

/**
 * StepEditModal — centred modal for editing a pipeline step.
 *
 * Props:
 *   step       — step object { id, title, description, assignee, due_date, category, status }
 *   users      — array of { id, name } from useLookups
 *   categories — array of { id, name } from useLookups (optional)
 *   onSave(stepId, dbUpdates, stateUpdates) — called on save
 *   onDelete(stepId)          — called on confirmed delete
 *   onClose()                 — called on cancel / backdrop click
 */
export default function StepEditPopover({ step, users, categories, onSave, onDelete, onClose }) {
  const [title,       setTitle]       = useState(step.title       ?? '')
  const [description, setDescription] = useState(step.description ?? '')
  const [assigneeId,  setAssigneeId]  = useState(step.assignee?.id ?? step.assignee_id ?? '')
  const [dueDate,     setDueDate]     = useState(step.due_date ?? '')
  const [categoryId,  setCategoryId]  = useState(step.category?.id ?? step.category_id ?? '')
  const [status,      setStatus]      = useState(step.status ?? 'Open')
  const [saving,      setSaving]      = useState(false)
  const [confirming,  setConfirming]  = useState(false)
  const confirmTimer = useRef(null)

  useEffect(() => () => clearTimeout(confirmTimer.current), [])

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const dbUpdates = {
      title:       title.trim(),
      description: description.trim() || null,
      assignee_id: assigneeId || null,
      due_date:    dueDate    || null,
      category_id: categoryId || null,
      status,
    }
    // Build stateUpdates with resolved objects for optimistic UI
    const assignee = assigneeId ? users.find(u => u.id === assigneeId) ?? null : null
    const category = categoryId && categories ? categories.find(c => c.id === categoryId) ?? null : null
    const stateUpdates = {
      ...dbUpdates,
      assignee,
      category: category ? { id: category.id, name: category.name } : null,
    }
    await onSave(step.id, dbUpdates, stateUpdates)
    setSaving(false)
    onClose()
  }

  function handleDeleteClick() {
    if (confirming) {
      clearTimeout(confirmTimer.current)
      setConfirming(false)
      onDelete(step.id)
    } else {
      setConfirming(true)
      confirmTimer.current = setTimeout(() => setConfirming(false), 2000)
    }
  }

  return (
    <div
      className="ftm-overlay open"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="ftm-modal" style={{ maxWidth: 440 }}>

        {/* Header */}
        <div className="ftm-mhdr">
          <span className="ftm-mtitle">Edit step</span>
          <button className="ftm-dclose" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="ftm-mbody">
          <div className="ftm-fgrid">

            <div className="ftm-ff full">
              <label className="ftm-flbl">Title</label>
              <input
                autoFocus
                className="ftm-finput"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  handleSave()
                  if (e.key === 'Escape') onClose()
                }}
              />
            </div>

            <div className="ftm-ff full">
              <label className="ftm-flbl">Description</label>
              <textarea
                className="ftm-fta"
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ minHeight: 60 }}
              />
            </div>

            <div className="ftm-ff">
              <label className="ftm-flbl">Status</label>
              <select
                className="ftm-fsel"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {categories && categories.length > 0 && (
              <div className="ftm-ff">
                <label className="ftm-flbl">Category</label>
                <select
                  className="ftm-fsel"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                >
                  <option value="">— No category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="ftm-ff">
              <label className="ftm-flbl">Assignee</label>
              <select
                className="ftm-fsel"
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div className="ftm-ff">
              <label className="ftm-flbl">Due date</label>
              <input
                type="date"
                className="ftm-finput"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="ftm-mftr">
          <button
            className={`ftm-manage-del${confirming ? ' confirm' : ''}`}
            style={{ marginRight: 'auto' }}
            onClick={handleDeleteClick}
          >
            {confirming ? 'Confirm delete?' : '✕ Delete step'}
          </button>
          <button className="ftm-gbtn" onClick={onClose}>Cancel</button>
          <button className="ftm-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  )
}
