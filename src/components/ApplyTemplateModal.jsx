import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import StepEditorRows from './StepEditorRows'

/**
 * ApplyTemplateModal — two-phase modal for inserting template steps into an existing thread.
 *
 * Phase 1: Browse and select a template.
 * Phase 2: Edit the steps before inserting them as tasks.
 *
 * Props:
 *   threadId         — current thread ID
 *   existingMaxOrder — number of existing tasks (new tasks start from this order)
 *   onApply(taskRows) — called with shaped task rows to bulk-insert
 *   onClose          — close the modal
 *   users            — array of { id, name } for assignee dropdowns
 *   profiles         — array of profiles (raw) for StepEditorRows
 */
export default function ApplyTemplateModal({ threadId, existingMaxOrder, onApply, onClose, users = [], profiles = [] }) {
  const [phase, setPhase]       = useState('select') // 'select' | 'edit'
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [steps, setSteps]         = useState([])
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState(null)
  const dragIdx = useRef(null)

  // Load templates on mount
  useEffect(() => {
    supabase
      .from('thread_templates')
      .select('id, name, category, description, steps')
      .order('name')
      .then(({ data }) => { setTemplates(data ?? []); setLoading(false) })
  }, [])

  function mkStep(title = '', desc = '', defaultCategory = '') {
    return { tempId: `${Date.now()}-${Math.random()}`, title, description: desc, assigneeId: '', dueDate: '', defaultCategory }
  }

  function chooseTemplate(tpl) {
    setSteps((tpl.steps ?? [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(s => mkStep(s.title, s.description ?? '', s.default_category ?? ''))
    )
    setPhase('edit')
  }

  function addStep()           { setSteps(prev => [...prev, mkStep()]) }
  function removeStep(tempId)  { setSteps(prev => prev.filter(s => s.tempId !== tempId)) }
  function updateStep(tempId, field, value) {
    setSteps(prev => prev.map(s => s.tempId === tempId ? { ...s, [field]: value } : s))
  }

  function onDragStart(e, idx) { dragIdx.current = idx; e.dataTransfer.effectAllowed = 'move' }
  function onDragOver(e, idx) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    setSteps(prev => {
      const arr = [...prev]
      const [moved] = arr.splice(dragIdx.current, 1)
      arr.splice(idx, 0, moved)
      dragIdx.current = idx
      return arr
    })
  }
  function onDragEnd() { dragIdx.current = null }

  async function handleApply() {
    if (steps.length === 0)               { setErr('Add at least one step.'); return }
    if (steps.some(s => !s.title.trim())) { setErr('All steps need a title.'); return }

    setSaving(true)
    setErr(null)

    const taskRows = steps.map((s, i) => ({
      thread_id:   threadId,
      title:       s.title.trim(),
      description: s.description?.trim() || null,
      order:       existingMaxOrder + i,
      status:      'Open',
      priority:    'Medium',
      visibility:  'team',
      assignee_id: s.assigneeId || null,
      due_date:    s.dueDate    || null,
      notes:       '',
    }))

    const error = await onApply(taskRows)
    setSaving(false)
    if (error) { setErr(error.message ?? 'Failed to insert tasks.'); return }
    onClose()
  }

  const peopleList = profiles.length > 0
    ? profiles.map(p => ({ ...p, name: p.full_name ?? p.name }))
    : users

  return (
    <div className="ftm-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ftm-modal ftm-thread-modal">

        {/* Header */}
        <div className="ftm-mhdr">
          {phase === 'edit' && (
            <button className="ftm-gbtn ftm-back-inline" onClick={() => setPhase('select')}>
              ← Back
            </button>
          )}
          <span className="ftm-mtitle">
            {phase === 'select' ? 'Start from template' : 'Edit steps before inserting'}
          </span>
          <button className="ftm-dclose" onClick={onClose}>×</button>
        </div>

        {/* Phase: select template */}
        {phase === 'select' && (
          <div className="ftm-mbody">
            {loading ? (
              <div className="ftm-loading">Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className="ftm-empty" style={{ padding: '24px 0' }}>No templates available. Create one first.</div>
            ) : (
              <div className="ftm-thread-tpl-list">
                {templates.map(tpl => (
                  <button key={tpl.id} className="ftm-thread-tpl-card" onClick={() => chooseTemplate(tpl)}>
                    <div className="ftm-thread-tpl-top">
                      <span className="ftm-thread-tpl-name">{tpl.name}</span>
                      {tpl.category && (
                        <span className="ftm-badge b-cat" style={{ fontSize: 9 }}>{tpl.category}</span>
                      )}
                    </div>
                    {tpl.description && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{tpl.description}</div>
                    )}
                    <div className="ftm-thread-tpl-steps">
                      {(tpl.steps ?? [])
                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                        .map((s, i) => (
                          <span key={i} className="ftm-thread-tpl-step">
                            <span className="ftm-thread-tpl-step-n">{i + 1}</span>
                            {s.title}
                          </span>
                        ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phase: edit steps */}
        {phase === 'edit' && (
          <>
            <div className="ftm-mbody">
              <div className="ftm-thread-steps-hdr">
                <span className="ftm-flbl" style={{ margin: 0 }}>Steps to insert</span>
                <span className="ftm-thread-steps-cnt">{steps.length}</span>
              </div>

              <StepEditorRows
                steps={steps}
                users={peopleList}
                onUpdate={updateStep}
                onRemove={removeStep}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onAdd={addStep}
              />

              {err && (
                <div style={{ color: '#a32d2d', fontSize: 11, marginTop: 10 }}>{err}</div>
              )}
            </div>

            <div className="ftm-mftr">
              <button className="ftm-gbtn" onClick={onClose}>Cancel</button>
              <button className="ftm-btn" onClick={handleApply} disabled={saving}>
                {saving ? 'Inserting…' : `Insert ${steps.length} task${steps.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
