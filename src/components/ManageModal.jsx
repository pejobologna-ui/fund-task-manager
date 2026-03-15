import { useState, useEffect, useRef, useCallback } from 'react'
import { useManage, useLookups } from '../hooks/useTasks'
import VisibilityToggle from './VisibilityToggle'
import StepEditorRows from './StepEditorRows'
import { supabase } from '../supabaseClient'

const COMPANY_TYPES = ['portfolio', 'prospect', 'other']

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
  useEffect(() => () => clearTimeout(timer.current), [])

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
  return { tempId: `${Date.now()}-${Math.random()}`, title, description: desc, assigneeId: '', dueDate: '' }
}

// ── Categories tab ────────────────────────────────────────────────────────────
function CategoriesTab({ manage, profiles }) {
  const [editingId, setEditingId]     = useState(null)
  const [editName, setEditName]       = useState('')
  const [newName, setNewName]         = useState('')
  const [addingNew, setAddingNew]     = useState(false)
  const [shareExpanded, setShareExpanded] = useState({}) // catId -> bool
  const [shareMap, setShareMap]       = useState({})     // catId -> Set of user uuids

  // Load existing shares on mount
  useEffect(() => {
    supabase.from('category_shares').select('category_id, shared_with')
      .then(({ data }) => {
        if (!data) return
        const m = {}
        data.forEach(r => {
          if (!m[r.category_id]) m[r.category_id] = new Set()
          m[r.category_id].add(r.shared_with)
        })
        setShareMap(m)
      })
  }, [])

  function startEdit(cat) { setEditingId(cat.id); setEditName(cat.name) }

  async function saveEdit(id) {
    if (editName.trim()) await manage.renameCategory(id, editName.trim())
    setEditingId(null)
  }

  async function saveVisibility(id, vis) {
    await manage.updateCategoryVisibility(id, vis)
    if (vis === 'team') {
      // Remove all shares when switching back to team
      await supabase.from('category_shares').delete().eq('category_id', id)
      setShareMap(prev => { const m = { ...prev }; delete m[id]; return m })
    }
  }

  async function toggleShare(catId, userId) {
    const current = shareMap[catId] ?? new Set()
    const hasIt = current.has(userId)
    const next = new Set(current)
    if (hasIt) {
      next.delete(userId)
      await supabase.from('category_shares').delete().eq('category_id', catId).eq('shared_with', userId)
    } else {
      next.add(userId)
      await supabase.from('category_shares').insert({ category_id: catId, shared_with: userId })
    }
    setShareMap(prev => ({ ...prev, [catId]: next }))
  }

  async function handleAdd() {
    if (!newName.trim()) return
    await manage.addCategory(newName.trim())
    setNewName(''); setAddingNew(false)
  }

  return (
    <>
      <div className="ftm-manage-list">
        {manage.categories.map(cat => (
          <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="ftm-manage-row">
              {editingId === cat.id ? (
                <input
                  autoFocus
                  className="ftm-finput"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => saveEdit(cat.id)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                  style={{ flex: 1 }}
                />
              ) : (
                <span
                  style={{ flex: 1, fontSize: 12, cursor: 'text' }}
                  onDoubleClick={() => startEdit(cat)}
                >
                  {cat.name}
                </span>
              )}
              <div style={{ flexShrink: 0, minWidth: 240 }}>
                <VisibilityToggle
                  value={cat.visibility ?? 'team'}
                  onChange={vis => {
                    saveVisibility(cat.id, vis)
                    if (vis !== 'team') setShareExpanded(prev => ({ ...prev, [cat.id]: true }))
                    else setShareExpanded(prev => ({ ...prev, [cat.id]: false }))
                  }}
                />
              </div>
              <button
                className="ftm-gbtn"
                style={{ fontSize: 10, padding: '2px 6px' }}
                onClick={() => startEdit(cat)}
              >✎</button>
              <DeleteBtn onConfirm={() => manage.deleteCategory(cat.id)} />
            </div>

            {/* Share picker — shown when restricted or personal */}
            {shareExpanded[cat.id] && (cat.visibility === 'restricted' || cat.visibility === 'personal') && profiles.length > 0 && (
              <div className="ftm-share-picker" style={{ marginLeft: 10, marginBottom: 4 }}>
                {profiles.map(p => {
                  const checked = (shareMap[cat.id] ?? new Set()).has(p.id)
                  return (
                    <div
                      key={p.id}
                      className={`ftm-share-row${checked ? ' selected' : ''}`}
                      onClick={() => toggleShare(cat.id, p.id)}
                    >
                      <div className="ftm-share-avatar">{p.initials ?? '?'}</div>
                      <div className="ftm-share-info">
                        <span className="ftm-share-name">{p.full_name}</span>
                      </div>
                      <div className={`ftm-share-check${checked ? ' checked' : ''}`}>{checked ? '✓' : ''}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {addingNew ? (
        <div className="ftm-manage-list" style={{ paddingTop: 0 }}>
          <div className="ftm-manage-row">
            <input
              autoFocus
              className="ftm-finput"
              style={{ flex: 1 }}
              placeholder="Category name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAddingNew(false); setNewName('') } }}
            />
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
  const [newFields, setNewFields] = useState({ name: '', type: 'portfolio', fund: '' })

  async function handleAdd() {
    if (!newFields.name.trim()) return
    await manage.addCompany({ name: newFields.name.trim(), type: newFields.type, fund: newFields.fund.trim() || null })
    setNewFields({ name: '', type: 'portfolio', fund: '' }); setAddingNew(false)
  }

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
            <input
              className="ftm-finput"
              style={{ flex: 1 }}
              placeholder="Fund (e.g. Fund II)"
              defaultValue={co.fund ?? ''}
              onBlur={e => { if ((e.target.value || null) !== co.fund) manage.updateCompany(co.id, { fund: e.target.value.trim() || null }) }}
            />
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
            <input
              className="ftm-finput"
              style={{ flex: 1 }}
              placeholder="Fund (optional)"
              value={newFields.fund}
              onChange={e => setNewFields(f => ({ ...f, fund: e.target.value }))}
            />
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
function TemplatesTab({ manage, users }) {
  const [expandedId, setExpandedId] = useState(null)
  const [editState, setEditState]   = useState({}) // tplId -> { name, category, steps }
  const [addingNew, setAddingNew]   = useState(false)
  const [newState, setNewState]     = useState({ name: '', category: '', steps: [mkStep()] })
  const dragIdx = useRef(null)

  function openEdit(tpl) {
    setExpandedId(tpl.id)
    setEditState(prev => ({
      ...prev,
      [tpl.id]: {
        name:     tpl.name,
        category: tpl.category ?? '',
        steps:    (tpl.steps ?? []).map(s => mkStep(s.title, s.description ?? '')),
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
    const stepsJson = st.steps.map(s => ({ title: s.title, description: s.description || undefined }))
    await manage.updateTemplate(tplId, { name: st.name.trim(), category: st.category.trim() || null, steps: stepsJson })
    closeEdit()
  }

  // New template drag handlers
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
    const stepsJson = newState.steps.map(s => ({ title: s.title, description: s.description || undefined }))
    await manage.addTemplate({ name: newState.name.trim(), category: newState.category.trim() || null, steps: stepsJson })
    setNewState({ name: '', category: '', steps: [mkStep()] }); setAddingNew(false)
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
                  </div>
                  <div className="ftm-thread-steps-hdr" style={{ marginTop: 0 }}>
                    <span className="ftm-flbl" style={{ margin: 0 }}>Steps</span>
                  </div>
                  <StepEditorRows
                    steps={st.steps}
                    users={users}
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
          </div>
          <div className="ftm-thread-steps-hdr" style={{ marginTop: 0 }}>
            <span className="ftm-flbl" style={{ margin: 0 }}>Steps</span>
          </div>
          <StepEditorRows
            steps={newState.steps}
            users={users}
            onUpdate={(tempId, field, value) => setNewState(s => ({ ...s, steps: s.steps.map(st => st.tempId === tempId ? { ...st, [field]: value } : st) }))}
            onRemove={tempId => setNewState(s => ({ ...s, steps: s.steps.filter(st => st.tempId !== tempId) }))}
            onAdd={() => setNewState(s => ({ ...s, steps: [...s.steps, mkStep()] }))}
            {...newDragHandlers}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="ftm-gbtn" onClick={() => { setAddingNew(false); setNewState({ name: '', category: '', steps: [mkStep()] }) }}>Cancel</button>
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
  const { users } = useLookups()

  // profiles for share-with pickers (we reuse the profiles table)
  const [profiles, setProfiles] = useState([])
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, initials, role').order('full_name')
      .then(({ data }) => setProfiles(data ?? []))
  }, [])

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

        {/* Tab strip */}
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
              {tab === 'categories' && <CategoriesTab manage={manage} profiles={profiles} />}
              {tab === 'companies'  && <CompaniesTab  manage={manage} />}
              {tab === 'templates'  && <TemplatesTab  manage={manage} users={users} />}
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
