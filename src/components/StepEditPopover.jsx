import { useState, useEffect, useRef } from 'react'

/**
 * StepEditModal — centred modal for editing a pipeline step.
 * Replaces the old inline popover that broke the horizontal pipeline layout.
 *
 * Props:
 *   step      — step object { id, title, description, assignee, due_date }
 *   users     — array of { id, name } from useLookups
 *   onSave(stepId, dbUpdates) — called on save
 *   onDelete(stepId)          — called on confirmed delete
 *   onClose()                 — called on cancel / backdrop click
 */
export default function StepEditPopover({ step, users, onSave, onDelete, onClose }) {
  const [title,       setTitle]       = useState(step.title       ?? '')
  const [description, setDescription] = useState(step.description ?? '')
  const [assigneeId,  setAssigneeId]  = useState(step.assignee?.id ?? step.assigned_to ?? '')
  const [dueDate,     setDueDate]     = useState(step.due_date ?? '')
  const [saving,      setSaving]      = useState(false)
  const [confirming,  setConfirming]  = useState(false)
  const confirmTimer = useRef(null)

  useEffect(() => () => clearTimeout(confirmTimer.current), [])

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave(step.id, {
      title:       title.trim(),
      description: description.trim() || null,
      assigned_to: assigneeId || null,
      due_date:    dueDate    || null,
    })
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
