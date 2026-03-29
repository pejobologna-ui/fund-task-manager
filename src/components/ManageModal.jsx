import { useState, useRef, useCallback } from 'react'
import { useManage } from '../hooks/useTasks'
import StepEditorRows from './StepEditorRows'

const MACRO_CATEGORIES = [
  'Fund Operations',
  'Investing',
  'Portfolio Management',
  'Reporting',
  'Governance',
]

const COMPANY_TYPES = ['sgr', 'fund', 'portfolio', 'prospect']

// ── Inline delete-confirm button ─────────────────────────────────────────────
function DeleteBtn({ onConfirm }) {
  const [confirming, setConfirming] = useState(false)
  const timer = useRef(null)

  function handleClick() {
    if (confirming) {
      clearTimeout(timer.current)
      setConfirming(false)
      onConfirm()
    } else {
      setConfirming(true)
      timer.current = setTimeout(() => setConfirming(false), 2000)
    }
  }

  return (
    <button
      className={`ftm-manage-del${confirming ? ' confirm' : ''}`}
      onClick={handleClick}
      title="Delete"
    >
      {confirming ? 'Confirm?' : '✕'}
    </button>
  )
}

// ── mkStep helper ─────────────────────────────────────────────────────────────
function mkStep(title = '', desc = '') {
  return { tempId: `${Date.now()}-${Math.random()}`, title, description: desc }
}

// ── Categories tab ────────────────────────────────────────────────────────────
function CategoriesTab({ manage }) {
  const [editingId,  setEditingId]  = useState(null)
  const [editName,   setEditName]   = useState('')
  const [editMacro,  setEditMacro]  = useState('')
  const [newName,    setNewName]    = useState('')
  const [newMacro,   setNewMacro]   = useState(MACRO_CATEGORIES[0])
  const [addingNew,  setAddingNew]  = useState(false)

  function startEdit(cat) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditMacro(cat.macro_category ?? '')
  }

  async function saveEdit(id) {
    if (editName.trim()) {
      await manage.updateCategory(id, { name: editName.trim(), macro_category: editMacro || null })
    }
    setEditingId(null)
  }

  async function handleAdd() {
    if (!newName.trim()) return
    await manage.addCategory(newName.trim(), newMacro || null)
    setNewName(''); setNewMacro(MACRO_CATEGORIES[0]); setAddingNew(false)
  }

  // Group categories by macro_category for display
  const grouped = {}
  for (const cat of manage.categories) {
    const key = cat.macro_category ?? 'Other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(cat)
  }

  return (
    <>
      <div className="ftm-manage-list">
        {Object.entries(grouped).map(([macro, cats]) => (
          <div key={macro}>
            <div style={{ padding: '6px 20px 2px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {macro}
            </div>
            {cats.map(cat => (
              <div key={cat.id} className="ftm-manage-row">
                {editingId === cat.id ? (
                  <>
                    <input
                      autoFocus
                      className="ftm-finput"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => saveEdit(cat.id)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                      style={{ flex: 2 }}
                    />
                    <select
                      className="ftm-fsel"
                      style={{ flex: 1 }}
                      value={editMacro}
                      onChange={e => setEditMacro(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {MACRO_CATEGORIES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </>
                ) : (
                  <span style={{ flex: 1, fontSize: 12, cursor: 'text' }} onDoubleClick={() => startEdit(cat)}>
                    {cat.name}
                  </span>
                )}
                <button className="ftm-gbtn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => startEdit(cat)}>✎</button>
                <DeleteBtn onConfirm={() => manage.deleteCategory(cat.id)} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {addingNew ? (
        <div className="ftm-manage-list" style={{ paddingTop: 0 }}>
          <div className="ftm-manage-row">
            <input
              autoFocus
              className="ftm-finput"
              style={{ flex: 2 }}
              placeholder="Category name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddingNew(false) }}
            />
            <select
              className="ftm-fsel"
              style={{ flex: 1 }}
              value={newMacro}
              onChange={e => setNewMacro(e.target.value)}
            >
              {MACRO_CATEGORIES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button className="ftm-btn" style={{ fontSize: 11 }} onClick={handleAdd}>Add</button>
            <button className="ftm-gbtn" style={{ fontSize: 11 }} onClick={() => { setAddingNew(false); setNewName('') }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="ftm-manage-add" onClick={() => setAddingNew(true)}>
          + Add category
        </button>
      )}
    </>
  )
}

// ── Companies tab ─────────────────────────────────────────────────────────────
function CompaniesTab({ manage }) {
  const [addingNew, setAddingNew] = useState(false)
  const [newFields, setNewFields] = useState({ name: '', type: 'portfolio', fund_id: '' })

  async function handleAdd() {
    if (!newFields.name.trim()) return
    await manage.addCompany({
      name:    newFields.name.trim(),
      type:    newFields.type,
      fund_id: newFields.fund_id || null,
    })
    setNewFields({ name: '', type: 'portfolio', fund_id: '' }); setAddingNew(false)
  }

  // Fund companies for the fund_id selector
  const funds = manage.companies.filter(c => c.type === 'fund')

  return (
    <>
      <div className="ftm-manage-list">
        {manage.companies.map(co => (
          <div key={co.id} className="ftm-manage-row">
            <input
              className="ftm-finput"
              style={{ flex: 2 }}
              defaultValue={co.name}
              onBlur={e => { if (e.target.value.trim() !== co.name) manage.updateCompany(co.id, { name: e.target.value.trim() }) }}
            />
            <select
              className="ftm-fsel"
              style={{ flex: 1 }}
              defaultValue={co.type}
              onChange={e => manage.updateCompany(co.id, { type: e.target.value })}
            >
              {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="ftm-fsel"
              style={{ flex: 1 }}
              defaultValue={co.fund_id ?? ''}
              onChange={e => manage.updateCompany(co.id, { fund_id: e.target.value || null })}
            >
              <option value="">— No fund —</option>
              {funds.filter(f => f.id !== co.id).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <DeleteBtn onConfirm={() => manage.deleteCompany(co.id)} />
          </div>
        ))}
      </div>

      {addingNew ? (
        <div className="ftm-manage-list" style={{ paddingTop: 0 }}>
          <div className="ftm-manage-row" style={{ flexWrap: 'wrap' }}>
            <input
              autoFocus
              className="ftm-finput"
              style={{ flex: 2 }}
              placeholder="Company name…"
              value={newFields.name}
              onChange={e => setNewFields(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddingNew(false) }}
            />
            <select
              className="ftm-fsel"
              style={{ flex: 1 }}
              value={newFields.type}
              onChange={e => setNewFields(f => ({ ...f, type: e.target.value }))}
            >
              {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="ftm-fsel"
              style={{ flex: 1 }}
              value={newFields.fund_id}
              onChange={e => setNewFields(f => ({ ...f, fund_id: e.target.value }))}
            >
              <option value="">— No fund —</option>
              {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button className="ftm-btn" style={{ fontSize: 11 }} onClick={handleAdd}>Add</button>
            <button className="ftm-gbtn" style={{ fontSize: 11 }} onClick={() => setAddingNew(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="ftm-manage-add" onClick={() => setAddingNew(true)}>
          + Add company
        </button>
      )}
    </>
  )
}

// ── Templates tab ─────────────────────────────────────────────────────────────
function TemplatesTab({ manage }) {
  const [expandedId, setExpandedId] = useState(null)
  const [editState, setEditState]   = useState({})
  const [addingNew, setAddingNew]   = useState(false)
  const [newState, setNewState]     = useState({ name: '', category: '', description: '', steps: [mkStep()] })
  const dragIdx = useRef(null)

  function openEdit(tpl) {
    setExpandedId(tpl.id)
    setEditState(prev => ({
      ...prev,
      [tpl.id]: {
        name:        tpl.name,
        category:    tpl.category ?? '',
        description: tpl.description ?? '',
        steps:       (tpl.steps ?? [])
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map(s => mkStep(s.title, s.description ?? '')),
      },
    }))
  }

  function closeEdit() { setExpandedId(null) }

  function updateField(tplId, field, value) {
    setEditState(prev => ({ ...prev, [tplId]: { ...prev[tplId], [field]: value } }))
  }

  function updateStep(tplId, tempId, field, value) {
    setEditState(prev => ({
      ...prev,
      [tplId]: {
        ...prev[tplId],
        steps: prev[tplId].steps.map(s => s.tempId === tempId ? { ...s, [field]: value } : s),
      },
    }))
  }

  function removeStep(tplId, tempId) {
    setEditState(prev => ({
      ...prev,
      [tplId]: { ...prev[tplId], steps: prev[tplId].steps.filter(s => s.tempId !== tempId) },
    }))
  }

  function addStep(tplId) {
    setEditState(prev => ({
      ...prev,
      [tplId]: { ...prev[tplId], steps: [...prev[tplId].steps, mkStep()] },
    }))
  }

  const makeDragHandlers = useCallback((tplId) => ({
    onDragStart: (e, idx) => { dragIdx.current = idx; e.dataTransfer.effectAllowed = 'move' },
    onDragOver:  (e, idx) => {
      e.preventDefault()
      if (dragIdx.current === null || dragIdx.current === idx) return
      setEditState(prev => {
        const arr = [...prev[tplId].steps]
        const [moved] = arr.splice(dragIdx.current, 1)
        arr.splice(idx, 0, moved)
        dragIdx.current = idx
        return { ...prev, [tplId]: { ...prev[tplId], steps: arr } }
      })
    },
    onDragEnd: () => { dragIdx.current = null },
  }), [])

  async function saveTemplate(tplId) {
    const st = editState[tplId]
    if (!st?.name?.trim()) return
    const stepsJson = st.steps.map((s, i) => ({
      order: i,
      title: s.title,
      description: s.description || undefined,
    }))
    await manage.updateTemplate(tplId, {
      name: st.name.trim(),
      category: st.category.trim() || null,
      description: st.description.trim() || null,
      steps: stepsJson,
    })
    closeEdit()
  }

  const newDragIdx = useRef(null)
  const newDragHandlers = {
    onDragStart: (e, idx) => { newDragIdx.current = idx; e.dataTransfer.effectAllowed = 'move' },
    onDragOver:  (e, idx) => {
      e.preventDefault()
      if (newDragIdx.current === null || newDragIdx.current === idx) return
      setNewState(prev => {
        const arr = [...prev.steps]
        const [moved] = arr.splice(newDragIdx.current, 1)
        arr.splice(idx, 0, moved)
        newDragIdx.current = idx
        return { ...prev, steps: arr }
      })
    },
    onDragEnd: () => { newDragIdx.current = null },
  }

  async function handleAddTemplate() {
    if (!newState.name.trim()) return
    const stepsJson = newState.steps.map((s, i) => ({
      order: i,
      title: s.title,
      description: s.description || undefined,
    }))
    await manage.addTemplate({
      name: newState.name.trim(),
      category: newState.category.trim() || null,
      description: newState.description.trim() || null,
      steps: stepsJson,
    })
    setNewState({ name: '', category: '', description: '', steps: [mkStep()] }); setAddingNew(false)
  }

  return (
    <>
      <div className="ftm-manage-list">
        {manage.templates.map(tpl => (
          <div key={tpl.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div className="ftm-manage-row">
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{tpl.name}</span>
              {tpl.category && <span className="ftm-badge b-cat" style={{ fontSize: 9 }}>{tpl.category}</span>}
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{(tpl.steps ?? []).length} steps</span>
              <button
                className="ftm-gbtn"
                style={{ fontSize: 10, padding: '2px 8px' }}
                onClick={() => expandedId === tpl.id ? closeEdit() : openEdit(tpl)}
              >
                {expandedId === tpl.id ? 'Close' : 'Edit'}
              </button>
              <DeleteBtn onConfirm={() => manage.deleteTemplate(tpl.id)} />
            </div>

            {expandedId === tpl.id && editState[tpl.id] && (() => {
              const st = editState[tpl.id]
              const dh = makeDragHandlers(tpl.id)
              return (
                <div className="ftm-manage-tpl-expand">
                  <div className="ftm-fgrid" style={{ marginBottom: 12 }}>
                    <div className="ftm-ff">
                      <label className="ftm-flbl">Template name</label>
                      <input className="ftm-finput" value={st.name} onChange={e => updateField(tpl.id, 'name', e.target.value)} />
                    </div>
                    <div className="ftm-ff">
                      <label className="ftm-flbl">Category</label>
                      <input className="ftm-finput" value={st.category} onChange={e => updateField(tpl.id, 'category', e.target.value)} placeholder="e.g. Deal Flow" />
                    </div>
                    <div className="ftm-ff full">
                      <label className="ftm-flbl">Description</label>
                      <input className="ftm-finput" value={st.description} onChange={e => updateField(tpl.id, 'description', e.target.value)} placeholder="Brief description…" />
                    </div>
                  </div>
                  <div className="ftm-thread-steps-hdr" style={{ marginTop: 0 }}>
                    <span className="ftm-flbl" style={{ margin: 0 }}>Steps</span>
                  </div>
                  <StepEditorRows
                    steps={st.steps}
                    users={[]}
                    onUpdate={(tempId, field, value) => updateStep(tpl.id, tempId, field, value)}
                    onRemove={tempId => removeStep(tpl.id, tempId)}
                    onAdd={() => addStep(tpl.id)}
                    {...dh}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                    <button className="ftm-gbtn" onClick={closeEdit}>Cancel</button>
                    <button className="ftm-btn" onClick={() => saveTemplate(tpl.id)}>Save template</button>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      {addingNew ? (
        <div className="ftm-manage-tpl-expand" style={{ margin: '0 20px 16px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)' }}>
          <div className="ftm-fgrid" style={{ marginBottom: 12 }}>
            <div className="ftm-ff">
              <label className="ftm-flbl">Template name</label>
              <input autoFocus className="ftm-finput" value={newState.name} onChange={e => setNewState(s => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="ftm-ff">
              <label className="ftm-flbl">Category</label>
              <input className="ftm-finput" value={newState.category} onChange={e => setNewState(s => ({ ...s, category: e.target.value }))} placeholder="e.g. Deal Flow" />
            </div>
            <div className="ftm-ff full">
              <label className="ftm-flbl">Description</label>
              <input className="ftm-finput" value={newState.description} onChange={e => setNewState(s => ({ ...s, description: e.target.value }))} placeholder="Brief description…" />
            </div>
          </div>
          <div className="ftm-thread-steps-hdr" style={{ marginTop: 0 }}>
            <span className="ftm-flbl" style={{ margin: 0 }}>Steps</span>
          </div>
          <StepEditorRows
            steps={newState.steps}
            users={[]}
            onUpdate={(tempId, field, value) => setNewState(s => ({ ...s, steps: s.steps.map(st => st.tempId === tempId ? { ...st, [field]: value } : st) }))}
            onRemove={tempId => setNewState(s => ({ ...s, steps: s.steps.filter(st => st.tempId !== tempId) }))}
            onAdd={() => setNewState(s => ({ ...s, steps: [...s.steps, mkStep()] }))}
            {...newDragHandlers}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="ftm-gbtn" onClick={() => { setAddingNew(false); setNewState({ name: '', category: '', description: '', steps: [mkStep()] }) }}>Cancel</button>
            <button className="ftm-btn" onClick={handleAddTemplate}>Add template</button>
          </div>
        </div>
      ) : (
        <button className="ftm-manage-add" onClick={() => setAddingNew(true)}>
          + Add template
        </button>
      )}
    </>
  )
}

// ── ManageModal ───────────────────────────────────────────────────────────────
export default function ManageModal({ onClose, onSaved }) {
  const [tab, setTab] = useState('categories')
  const manage = useManage()

  function handleClose() {
    onSaved?.()
    onClose()
  }

  const TABS = [
    { key: 'categories', label: 'Categories' },
    { key: 'companies',  label: 'Companies'  },
    { key: 'templates',  label: 'Templates'  },
  ]

  return (
    <div className="ftm-overlay open" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="ftm-modal ftm-manage-modal">
        <div className="ftm-mhdr">
          <span className="ftm-mtitle">Manage</span>
          <button className="ftm-dclose" onClick={handleClose}>×</button>
        </div>

        <div className="ftm-mtabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`ftm-mtab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
          {manage.loading ? (
            <div className="ftm-loading" style={{ padding: 24 }}>Loading…</div>
          ) : (
            <>
              {tab === 'categories' && <CategoriesTab manage={manage} />}
              {tab === 'companies'  && <CompaniesTab  manage={manage} />}
              {tab === 'templates'  && <TemplatesTab  manage={manage} />}
            </>
          )}
        </div>

        <div className="ftm-mftr">
          <button className="ftm-btn" onClick={handleClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
