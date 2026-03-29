import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import StepEditorRows from './StepEditorRows'

export default function NewThreadModal({ onClose, onCreated, companies = [], users = [], profiles = [] }) {
  const { session } = useAuth()

  const [phase, setPhase] = useState('choose')   // 'choose' | 'templates' | 'edit'
  const [templates, setTemplates] = useState([])
  const [tplLoading, setTplLoading] = useState(false)

  // Thread metadata
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [companyId, setCompanyId]     = useState('')

  // Tasks/steps — each is a local object with a stable tempId
  const [steps, setSteps] = useState([])

  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)

  const dragIdx = useRef(null)

  // Load templates when entering that phase
  useEffect(() => {
    if (phase !== 'templates') return
    setTplLoading(true)
    supabase
      .from('thread_templates')
      .select('id, name, category, description, steps')
      .order('name')
      .then(({ data }) => { setTemplates(data ?? []); setTplLoading(false) })
  }, [phase])

  function mkStep(title = '', desc = '', defaultCategory = '') {
    return { tempId: `${Date.now()}-${Math.random()}`, title, description: desc, assigneeId: '', dueDate: '', defaultCategory }
  }

  function chooseTemplate(tpl) {
    setName(tpl.name)
    setSteps((tpl.steps ?? [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(s => mkStep(s.title, s.description ?? '', s.default_category ?? ''))
    )
    setPhase('edit')
  }

  function startBlank() {
    setName('')
    setSteps([mkStep()])
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

  async function handleSave() {
    if (!name.trim())                     { setErr('Thread name is required.'); return }
    if (steps.length === 0)               { setErr('Add at least one task.'); return }
    if (steps.some(s => !s.title.trim())) { setErr('All tasks need a title.'); return }

    setSaving(true)
    setErr(null)

    const isDev = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

    // Create the thread (no category, no visibility — threads are team-visible)
    const { data: thread, error: threadErr } = await supabase
      .from('threads')
      .insert({
        name:        name.trim(),
        description: description.trim() || null,
        company_id:  companyId || null,
        status:      'active',
        created_by:  isDev ? null : (session?.user?.id ?? null),
      })
      .select('id, name')
      .single()

    if (threadErr) { setSaving(false); setErr(threadErr.message); return }

    // Insert tasks for each step
    const taskRows = steps.map((s, i) => ({
      thread_id:   thread.id,
      title:       s.title.trim(),
      description: s.description.trim() || null,
      order:       i,
      status:      'Open',
      priority:    'Medium',
      visibility:  'team',
      company_id:  companyId || null,
      assignee_id: s.assigneeId || null,
      due_date:    s.dueDate    || null,
      notes:       '',
    }))

    const { error: tasksErr } = await supabase.from('tasks').insert(taskRows)
    setSaving(false)
    if (tasksErr) { setErr(tasksErr.message); return }

    onCreated(thread)
  }

  // Use profiles for the assignee list in StepEditorRows
  const peopleList = profiles.length > 0
    ? profiles.map(p => ({ ...p, name: p.full_name }))
    : users

  return (
    <div className="ftm-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ftm-modal ftm-thread-modal">

        {/* ── Header ── */}
        <div className="ftm-mhdr">
          {phase !== 'choose' && (
            <button className="ftm-gbtn ftm-back-inline" onClick={() => setPhase('choose')}>
              ← Back
            </button>
          )}
          <span className="ftm-mtitle">
            {phase === 'choose'    && 'New thread'}
            {phase === 'templates' && 'Choose a template'}
            {phase === 'edit'      && 'Configure thread'}
          </span>
          <button className="ftm-dclose" onClick={onClose}>×</button>
        </div>

        {/* ── Phase: choose ── */}
        {phase === 'choose' && (
          <div className="ftm-mbody">
            <div className="ftm-thread-choose-grid">
              <button className="ftm-thread-choose-card" onClick={() => setPhase('templates')}>
                <div className="ftm-thread-choose-icon">📋</div>
                <div className="ftm-thread-choose-title">Start from template</div>
                <div className="ftm-thread-choose-sub">Pick a pre-built task sequence and customise it before saving</div>
              </button>
              <button className="ftm-thread-choose-card" onClick={startBlank}>
                <div className="ftm-thread-choose-icon">✦</div>
                <div className="ftm-thread-choose-title">Start blank</div>
                <div className="ftm-thread-choose-sub">Build your own thread with custom tasks from scratch</div>
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: templates ── */}
        {phase === 'templates' && (
          <div className="ftm-mbody">
            {tplLoading ? (
              <div className="ftm-loading">Loading templates…</div>
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

        {/* ── Phase: edit ── */}
        {phase === 'edit' && (
          <>
            <div className="ftm-mbody">
              <div className="ftm-fgrid">
                <div className="ftm-ff full">
                  <label className="ftm-flbl">Thread name</label>
                  <input
                    className="ftm-finput"
                    placeholder="e.g. Series A – Acme Corp"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="ftm-ff full">
                  <label className="ftm-flbl">Description (optional)</label>
                  <textarea
                    className="ftm-fta"
                    placeholder="Brief description of this thread…"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    style={{ minHeight: 48 }}
                  />
                </div>
                <div className="ftm-ff full">
                  <label className="ftm-flbl">Company (optional)</label>
                  <select className="ftm-fsel" value={companyId} onChange={e => setCompanyId(e.target.value)}>
                    <option value="">— None —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Tasks editor */}
              <div className="ftm-thread-steps-hdr">
                <span className="ftm-flbl" style={{ margin: 0 }}>Tasks</span>
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
              <button className="ftm-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Creating…' : 'Create thread'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
