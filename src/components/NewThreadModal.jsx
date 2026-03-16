import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import SharePicker, { EVERYONE } from './SharePicker'
import StepEditorRows from './StepEditorRows'

export default function NewThreadModal({ onClose, onCreated, companies = [], users = [], profiles = [] }) {
  const { session } = useAuth()

  const [phase, setPhase] = useState('choose')   // 'choose' | 'templates' | 'edit'
  const [templates, setTemplates] = useState([])
  const [tplLoading, setTplLoading] = useState(false)

  // Thread metadata
  const [name, setName]             = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]     = useState('')
  const [companyId, setCompanyId]   = useState('')
  const [shareWith, setShareWith]   = useState([EVERYONE])

  // Steps — each step is a local object with a stable tempId
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
      .select('id, name, category, steps')
      .order('name')
      .then(({ data }) => { setTemplates(data ?? []); setTplLoading(false) })
  }, [phase])

  function mkStep(title = '', desc = '') {
    return { tempId: `${Date.now()}-${Math.random()}`, title, description: desc, assigneeId: '', dueDate: '' }
  }

  function chooseTemplate(tpl) {
    setName(tpl.name)
    setCategory(tpl.category ?? '')
    setSteps((tpl.steps ?? []).map(s => mkStep(s.title, s.description ?? '')))
    setPhase('edit')
  }

  function startBlank() {
    setName('')
    setCategory('')
    setSteps([mkStep()])
    setPhase('edit')
  }

  function addStep() {
    setSteps(prev => [...prev, mkStep()])
  }

  function removeStep(tempId) {
    setSteps(prev => prev.filter(s => s.tempId !== tempId))
  }

  function updateStep(tempId, field, value) {
    setSteps(prev => prev.map(s => s.tempId === tempId ? { ...s, [field]: value } : s))
  }

  // Drag-and-drop reorder
  function onDragStart(e, idx) {
    dragIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
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
    if (!name.trim())                           { setErr('Thread name is required.'); return }
    if (steps.length === 0)                     { setErr('Add at least one step.'); return }
    if (steps.some(s => !s.title.trim()))       { setErr('All steps need a title.'); return }

    setSaving(true)
    setErr(null)

    const isDev = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

    // Derive visibility from shareWith
    const isEveryone = shareWith.includes(EVERYONE)
    const visibility = isEveryone ? 'team' : shareWith.length > 0 ? 'restricted' : 'personal'

    const { data: thread, error: threadErr } = await supabase
      .from('threads')
      .insert({
        name:        name.trim(),
        description: description.trim() || null,
        category:    category.trim() || null,
        company_id:  companyId || null,
        visibility,
        created_by:  isDev ? null : (session?.user?.id ?? null),
      })
      .select('id, name')
      .single()

    if (threadErr) { setSaving(false); setErr(threadErr.message); return }

    // Insert thread_shares for restricted visibility
    if (visibility === 'restricted' && shareWith.length > 0) {
      const shareRows = shareWith.map(uid => ({ thread_id: thread.id, shared_with: uid }))
      await supabase.from('thread_shares').insert(shareRows)
    }

    const stepRows = steps.map((s, i) => ({
      thread_id:   thread.id,
      title:       s.title.trim(),
      description: s.description.trim() || null,
      order:       i,
      status:      'pending',
      assigned_to: s.assigneeId || null,
      due_date:    s.dueDate    || null,
    }))

    const { error: stepsErr } = await supabase.from('thread_steps').insert(stepRows)
    setSaving(false)
    if (stepsErr) { setErr(stepsErr.message); return }

    onCreated(thread)
  }

  // Use profiles if available, fall back to users (dev mode has no profiles)
  const peopleList = profiles.length > 0 ? profiles : users.map(u => ({ ...u, full_name: u.name }))
  const shareableProfiles = peopleList.filter(p => p.id !== session?.user?.id)

  return (
    <div className="ftm-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ftm-modal ftm-thread-modal">

        {/* ── Header ── */}
        <div className="ftm-mhdr">
          {phase !== 'choose' && (
            <button
              className="ftm-gbtn ftm-back-inline"
              onClick={() => setPhase('choose')}
            >
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
                <div className="ftm-thread-choose-sub">Pick a pre-built step sequence and customise it before saving</div>
              </button>
              <button className="ftm-thread-choose-card" onClick={startBlank}>
                <div className="ftm-thread-choose-icon">✦</div>
                <div className="ftm-thread-choose-title">Start blank</div>
                <div className="ftm-thread-choose-sub">Build your own thread with custom steps from scratch</div>
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
                    <div className="ftm-thread-tpl-steps">
                      {(tpl.steps ?? []).map((s, i) => (
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
                <div className="ftm-ff">
                  <label className="ftm-flbl">Category</label>
                  <input
                    className="ftm-finput"
                    placeholder="e.g. Deal Flow"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  />
                </div>
                <div className="ftm-ff">
                  <label className="ftm-flbl">Company (optional)</label>
                  <select className="ftm-fsel" value={companyId} onChange={e => setCompanyId(e.target.value)}>
                    <option value="">— None —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="ftm-ff full">
                  <label className="ftm-flbl">Shared with</label>
                  <SharePicker
                    selected={shareWith}
                    onChange={setShareWith}
                    profiles={shareableProfiles}
                  />
                </div>
              </div>

              {/* Steps editor */}
              <div className="ftm-thread-steps-hdr">
                <span className="ftm-flbl" style={{ margin: 0 }}>Steps</span>
                <span className="ftm-thread-steps-cnt">{steps.length}</span>
              </div>

              <StepEditorRows
                steps={steps}
                users={users}
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
