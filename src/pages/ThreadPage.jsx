import { useState, useMemo } from 'react'
import { useThread, useLookups, useProfiles } from '../hooks/useTasks'
import StepEditPopover from '../components/StepEditPopover'
import SaveAsTemplateModal from '../components/SaveAsTemplateModal'
import ApplyTemplateModal from '../components/ApplyTemplateModal'
import StatsBar from '../components/StatsBar'
import TaskRow from '../components/TaskRow'
import CellPopover from '../components/CellPopover'

function groupCompanies(companies) {
  const sgr        = companies.filter(c => c.type === 'sgr')
  const funds      = companies.filter(c => c.type === 'fund')
  const withFund   = companies.filter(c => c.fund_id && c.type !== 'fund')
  const unassigned = companies.filter(c => !c.fund_id && c.type !== 'fund' && c.type !== 'sgr')
  const groups = []
  if (sgr.length) groups.push({ label: 'SGR', items: sgr })
  funds.forEach(f => {
    const children = withFund.filter(c => c.fund_id === f.id)
    groups.push({ label: f.name, items: [f, ...children] })
  })
  if (unassigned.length) groups.push({ label: 'Unassigned', items: unassigned })
  return groups
}

const TASK_STATUS = {
  'Open':        { bg: '#ededec', color: '#666',    label: 'Open'        },
  'In Progress': { bg: '#faeeda', color: '#854f0b', label: 'In Progress' },
  'In Review':   { bg: '#dbe8fa', color: '#1f4e8c', label: 'In Review'   },
  'Done':        { bg: '#eaf3de', color: '#3b6d11', label: 'Done'        },
}

const PRIORITY_STYLE = {
  'High':   { cls: 'p-hi', label: 'High'   },
  'Medium': { cls: 'p-md', label: 'Medium' },
  'Low':    { cls: 'p-lo', label: 'Low'    },
}
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low']

const THREAD_STATUSES = ['active', 'completed', 'archived']
const THREAD_STATUS_STYLE = {
  active:    { bg: '#eaf3de', color: '#3b6d11' },
  completed: { bg: '#ededec', color: '#666'    },
  archived:  { bg: '#f3eade', color: '#7a6530' },
}

function TaskCard({
  task, index, isActive, isDragging, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd, onCycleStatus, onEditTask,
}) {
  const ts     = TASK_STATUS[task.status] ?? TASK_STATUS['Open']
  const isDone = task.status === 'Done'
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null

  return (
    <div
      className={[
        'ftm-step-card',
        isActive  ? 'ftm-step-active'   : '',
        isDone    ? 'ftm-step-done'     : '',
        isDragging  ? 'ftm-step-dragging' : '',
        isDragOver  ? 'ftm-step-dragover' : '',
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDrop={e => { e.preventDefault(); onDrop() }}
      onDragEnd={onDragEnd}
    >
      <div className={`ftm-step-num${isDone ? ' done' : isActive ? ' active' : ''}`}>
        {isDone ? '✓' : index + 1}
      </div>

      {isActive && <div className="ftm-step-active-pill">ACTIVE</div>}

      <div className="ftm-step-title">{task.title}</div>

      {task.category?.name && (
        <span className="ftm-badge b-cat" style={{ fontSize: 10, marginBottom: 4 }}>{task.category.name}</span>
      )}

      {task.description && (
        <div className="ftm-step-desc">{task.description}</div>
      )}

      <span
        className="ftm-badge ftm-step-status-badge"
        style={{ background: ts.bg, color: ts.color, cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); onCycleStatus() }}
        title="Click to advance status"
      >
        {ts.label}
      </span>

      <div className="ftm-step-meta">
        {task.assignee && (
          <div
            className="ftm-aavatar"
            style={{ width: 18, height: 18, fontSize: 7, flexShrink: 0 }}
            title={task.assignee.name}
          >
            {task.assignee.initials}
          </div>
        )}
        {task.due_date && (
          <span className="ftm-step-due">{fmtDate(task.due_date)}</span>
        )}
      </div>

      <button
        className="ftm-step-edit-btn"
        title="Edit task"
        onClick={e => { e.stopPropagation(); onEditTask?.(task.id) }}
      >✎</button>

      <div className="ftm-step-drag-handle" title="Drag to reorder">⠿</div>
    </div>
  )
}

export default function ThreadPage({
  threadId,
  onBack, onOpenThread, onEditThread, onNewTask, myUserId,
}) {
  const {
    thread, tasks, loading,
    addTask, cycleTaskStatus, reorderTasks, updateTask, deleteTask,
    updateThread, cascadeToTasks, addMultipleTasks,
  } = useThread(threadId)
  const { users, categories, companies, threads } = useLookups()
  const { profiles } = useProfiles()

  const [dragIdx,          setDragIdx]          = useState(null)
  const [dragOverIdx,      setDragOverIdx]      = useState(null)
  const [addingTask,       setAddingTask]       = useState(false)
  const [newTitle,         setNewTitle]         = useState('')
  const [saving,           setSaving]           = useState(false)
  const [editingTaskId,    setEditingTaskId]    = useState(null)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false)

  // View toggle — persisted to localStorage
  const [threadView, setThreadView] = useState(
    () => localStorage.getItem('ftm-thread-view-pref') ?? 'pipeline'
  )
  function switchView(v) {
    setThreadView(v)
    localStorage.setItem('ftm-thread-view-pref', v)
    setAddingTask(false)
    setNewTitle('')
  }

  // Inline editing state
  const [editName,     setEditName]     = useState(null) // null = not editing
  const [editDesc,     setEditDesc]     = useState(null)
  const [statusPopOpen, setStatusPopOpen] = useState(false)
  const [coPopOpen,     setCoPopOpen]     = useState(false)
  const [asPopOpen,     setAsPopOpen]     = useState(false)
  const [dtPopOpen,     setDtPopOpen]     = useState(false)
  const [catPopOpen,    setCatPopOpen]    = useState(false)
  const [prPopOpen,     setPrPopOpen]     = useState(false)

  const coGroups  = useMemo(() => groupCompanies(companies), [companies])
  const catGroups = useMemo(() => {
    const groups = {}
    categories.forEach(c => { const k = c.macro_category ?? 'Other'; (groups[k] ??= []).push(c) })
    return Object.entries(groups)
  }, [categories])

  // First non-Done task index
  const activeIdx = tasks.findIndex(t => t.status !== 'Done')

  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null) }

  async function handleDrop(targetIdx) {
    if (dragIdx === null || dragIdx === targetIdx) { handleDragEnd(); return }
    const reordered = [...tasks]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    handleDragEnd()
    await reorderTasks(reordered)
  }

  async function handleAddTask() {
    if (!newTitle.trim()) return
    setSaving(true)
    await addTask(newTitle.trim())
    setNewTitle('')
    setAddingTask(false)
    setSaving(false)
  }

  // Save inline thread name
  async function saveThreadName() {
    if (editName === null) return
    const trimmed = editName.trim()
    if (trimmed && trimmed !== thread.name) {
      await updateThread({ name: trimmed })
    }
    setEditName(null)
  }

  // Save inline thread description
  async function saveThreadDesc() {
    if (editDesc === null) return
    const trimmed = editDesc.trim()
    if (trimmed !== (thread.description ?? '')) {
      await updateThread({ description: trimmed || null })
    }
    setEditDesc(null)
  }

  if (loading) return (
    <div className="ftm-thread-page">
      <div className="ftm-loading" style={{ margin: '40px auto' }}>Loading thread…</div>
    </div>
  )
  if (!thread) return (
    <div className="ftm-thread-page">
      <div className="ftm-error" style={{ margin: '40px auto' }}>Thread not found.</div>
    </div>
  )

  const doneCount  = tasks.filter(t => t.status === 'Done').length
  const totalCount = tasks.length

  const editingTask = tasks.find(t => t.id === editingTaskId) ?? null

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null
  const createdByUser = thread.created_by ? users.find(u => u.id === thread.created_by) : null
  const statusStyle = THREAD_STATUS_STYLE[thread.status] ?? THREAD_STATUS_STYLE.active

  return (
    <div className="ftm-thread-page">

      {/* ── Task edit modal ── */}
      {editingTask && (
        <StepEditPopover
          step={editingTask}
          users={users}
          categories={categories}
          onSave={async (taskId, dbUpdates, stateUpdates) => { await updateTask(taskId, dbUpdates, stateUpdates) }}
          onDelete={async (taskId) => { await deleteTask(taskId); setEditingTaskId(null) }}
          onClose={() => setEditingTaskId(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="ftm-thread-hdr">
        <div className="ftm-thread-hdr-top">
          <button className="ftm-back-btn" onClick={onBack}>← Back</button>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
            <button className="ftm-gbtn" onClick={() => setApplyTemplateOpen(true)}>
              Start from template
            </button>
            <button className="ftm-gbtn" onClick={() => setSaveTemplateOpen(true)}>
              Save as template
            </button>
            <button className="ftm-btn" onClick={() =>
              onNewTask
                ? onNewTask({ id: threadId, name: thread.name, company: thread.company ?? null })
                : setAddingTask(true)
            }>
              + Add task
            </button>
          </div>
        </div>
        <div className="ftm-thread-info">
          {/* Inline-editable name */}
          {editName !== null ? (
            <input
              autoFocus
              className="ftm-finput ftm-thread-name-edit"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={saveThreadName}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.target.blur() }
                if (e.key === 'Escape') { setEditName(null) }
              }}
            />
          ) : (
            <h1
              className="ftm-thread-name ftm-thread-name-editable"
              onClick={() => setEditName(thread.name)}
              title="Click to edit name"
            >
              {thread.name}
            </h1>
          )}

          <div className="ftm-thread-meta">
            {/* Status badge */}
            <CellPopover
              open={statusPopOpen}
              onOpen={() => setStatusPopOpen(true)}
              onClose={() => setStatusPopOpen(false)}
              trigger={
                <span
                  className="ftm-badge ftm-thread-status-badge"
                  style={{ background: statusStyle.bg, color: statusStyle.color, cursor: 'pointer', textTransform: 'capitalize' }}
                >
                  {thread.status ?? 'active'}
                </span>
              }
            >
              <div className="ftm-pop-list">
                {THREAD_STATUSES.map(s => {
                  const st = THREAD_STATUS_STYLE[s]
                  return (
                    <div
                      key={s}
                      className={`ftm-pop-item${thread.status === s ? ' active' : ''}`}
                      onClick={e => {
                        e.stopPropagation()
                        setStatusPopOpen(false)
                        updateThread({ status: s })
                      }}
                    >
                      <span className="ftm-badge" style={{ background: st.bg, color: st.color, textTransform: 'capitalize' }}>{s}</span>
                    </div>
                  )
                })}
              </div>
            </CellPopover>

            {/* ── Category CellPopover ── */}
            <CellPopover
              open={catPopOpen}
              onOpen={() => setCatPopOpen(true)}
              onClose={() => setCatPopOpen(false)}
              trigger={
                thread.category
                  ? <span className="ftm-badge b-cat ftm-thread-meta-btn">{thread.category.name}</span>
                  : <span className="ftm-thread-meta-placeholder">+ Category</span>
              }
            >
              <div className="ftm-pop-list">
                <div
                  className={`ftm-pop-item${!thread.category ? ' active' : ''}`}
                  onClick={() => {
                    setCatPopOpen(false)
                    updateThread({ category_id: null }, { category: null })
                    cascadeToTasks({ category_id: null })
                  }}
                >— None —</div>
                {catGroups.map(([macro, cats]) => (
                  <div key={macro}>
                    <div className="ftm-pop-group-label">{macro}</div>
                    {cats.map(c => (
                      <div
                        key={c.id}
                        className={`ftm-pop-item${thread.category?.id === c.id ? ' active' : ''}`}
                        onClick={() => {
                          setCatPopOpen(false)
                          updateThread({ category_id: c.id }, { category: { id: c.id, name: c.name, macro_category: c.macro_category } })
                          cascadeToTasks({ category_id: c.id })
                        }}
                      >{c.name}</div>
                    ))}
                  </div>
                ))}
              </div>
            </CellPopover>

            {/* ── Priority CellPopover ── */}
            <CellPopover
              open={prPopOpen}
              onOpen={() => setPrPopOpen(true)}
              onClose={() => setPrPopOpen(false)}
              trigger={
                thread.priority
                  ? <span className={`ftm-badge ${PRIORITY_STYLE[thread.priority]?.cls ?? 'p-md'} ftm-thread-meta-btn`}>{thread.priority}</span>
                  : <span className="ftm-thread-meta-placeholder">+ Priority</span>
              }
            >
              <div className="ftm-pop-list">
                <div
                  className={`ftm-pop-item${!thread.priority ? ' active' : ''}`}
                  onClick={() => {
                    setPrPopOpen(false)
                    updateThread({ priority: null })
                    cascadeToTasks({ priority: 'Medium' })
                  }}
                >— None (reset to Medium) —</div>
                {PRIORITY_OPTIONS.map(p => {
                  const ps = PRIORITY_STYLE[p]
                  return (
                    <div
                      key={p}
                      className={`ftm-pop-item${thread.priority === p ? ' active' : ''}`}
                      onClick={() => {
                        setPrPopOpen(false)
                        updateThread({ priority: p })
                        cascadeToTasks({ priority: p })
                      }}
                    >
                      <span className={`ftm-badge ${ps.cls}`}>{ps.label}</span>
                    </div>
                  )
                })}
              </div>
            </CellPopover>

            {/* ── Company CellPopover ── */}
            <CellPopover
              open={coPopOpen}
              onOpen={() => setCoPopOpen(true)}
              onClose={() => setCoPopOpen(false)}
              trigger={
                <span className={`ftm-badge b-co ftm-thread-meta-btn${thread.company?.name ? '' : ' ftm-thread-meta-placeholder'}`}>
                  {thread.company?.name ?? '+ Company'}
                </span>
              }
            >
              <div className="ftm-pop-list">
                <div
                  className={`ftm-pop-item${!thread.company?.id ? ' active' : ''}`}
                  onClick={() => {
                    setCoPopOpen(false)
                    updateThread({ company_id: null }, { company: null })
                    cascadeToTasks({ company_id: null })
                  }}
                >— None —</div>
                {coGroups.map(({ label, items }) => (
                  <div key={label}>
                    <div className="ftm-pop-group-label">{label}</div>
                    {items.map(c => (
                      <div
                        key={c.id}
                        className={`ftm-pop-item${thread.company?.id === c.id ? ' active' : ''}`}
                        onClick={() => {
                          setCoPopOpen(false)
                          updateThread({ company_id: c.id }, { company: { id: c.id, name: c.name, type: c.type } })
                          cascadeToTasks({ company_id: c.id })
                        }}
                      >{c.name}</div>
                    ))}
                  </div>
                ))}
              </div>
            </CellPopover>

            {/* ── Assignee CellPopover ── */}
            <CellPopover
              open={asPopOpen}
              onOpen={() => setAsPopOpen(true)}
              onClose={() => setAsPopOpen(false)}
              trigger={
                thread.assignee
                  ? (
                    <div
                      className="ftm-aavatar ftm-thread-meta-btn"
                      style={{ width: 20, height: 20, fontSize: 8 }}
                      title={thread.assignee.name}
                    >
                      {thread.assignee.initials}
                    </div>
                  )
                  : <span className="ftm-thread-meta-placeholder">+ Assignee</span>
              }
            >
              <div className="ftm-pop-list">
                <div
                  className={`ftm-pop-item${!thread.assignee ? ' active' : ''}`}
                  onClick={() => {
                    setAsPopOpen(false)
                    updateThread({ assignee_id: null }, { assignee: null })
                    cascadeToTasks({ assignee_id: null })
                  }}
                >— Unassigned —</div>
                {users.filter(u => !u._legacy).length === 0 && (
                  <div style={{ padding: '6px 10px', fontSize: 11, color: '#aaa' }}>
                    No team members found.<br/>Run migration 017 in Supabase.
                  </div>
                )}
                {users.filter(u => !u._legacy).map(u => (
                  <div
                    key={u.id}
                    className={`ftm-pop-item${thread.assignee?.id === u.id ? ' active' : ''}`}
                    onClick={() => {
                      setAsPopOpen(false)
                      updateThread(
                        { assignee_id: u.id },
                        { assignee: { id: u.id, name: u.name, initials: u.initials } },
                      )
                      cascadeToTasks({ assignee_id: u.id })
                    }}
                  >
                    <div className="ftm-aavatar" style={{ width: 16, height: 16, fontSize: 7 }}>{u.initials}</div>
                    {u.name}
                  </div>
                ))}
              </div>
            </CellPopover>

            {/* ── Due Date CellPopover ── */}
            <CellPopover
              open={dtPopOpen}
              onOpen={() => setDtPopOpen(true)}
              onClose={() => setDtPopOpen(false)}
              disableAutoClose
              trigger={
                <span className={`ftm-thread-date ftm-thread-meta-btn${thread.due_date ? '' : ' ftm-thread-meta-placeholder'}`}>
                  {thread.due_date ? fmtDate(thread.due_date) : '+ Due date'}
                </span>
              }
            >
              <div className="ftm-pop-date">
                <input
                  type="date"
                  value={thread.due_date ?? ''}
                  onChange={e => {
                    setDtPopOpen(false)
                    updateThread({ due_date: e.target.value || null })
                  }}
                  onBlur={() => setDtPopOpen(false)}
                />
              </div>
            </CellPopover>

            {createdByUser && (
              <span className="ftm-thread-created-by">
                by {createdByUser.name}
              </span>
            )}
            {thread.created_at && (
              <span className="ftm-thread-date">
                <i style={{ fontStyle: 'italic', color: '#aaa', marginRight: 3 }}>Creation date:</i>
                {fmtDate(thread.created_at)}
              </span>
            )}
          </div>

          {/* Inline-editable description */}
          {editDesc !== null ? (
            <textarea
              autoFocus
              className="ftm-fta ftm-thread-desc-edit"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              onBlur={saveThreadDesc}
              onKeyDown={e => {
                if (e.key === 'Escape') { setEditDesc(null) }
              }}
              style={{ minHeight: 40, marginTop: 6 }}
            />
          ) : (
            <div
              className="ftm-thread-desc ftm-thread-desc-editable"
              onClick={() => setEditDesc(thread.description ?? '')}
              title="Click to edit description"
            >
              {thread.description || 'Add a description…'}
            </div>
          )}
        </div>
      </div>

      {/* ── Pipeline / Table toggle section ── */}
      <div className="ftm-section-block">
        <div className="ftm-section-label">
          {threadView === 'pipeline' ? 'Pipeline' : 'Tasks'}
          {totalCount > 0 && (
            <span className="ftm-section-progress">{doneCount} / {totalCount} complete</span>
          )}
          <div className="ftm-view-toggle">
            <button
              className={`ftm-view-btn${threadView === 'pipeline' ? ' active' : ''}`}
              title="Pipeline view"
              onClick={() => switchView('pipeline')}
            >⊞</button>
            <button
              className={`ftm-view-btn${threadView === 'table' ? ' active' : ''}`}
              title="Table view"
              onClick={() => switchView('table')}
            >☰</button>
          </div>
        </div>

        <StatsBar tasks={tasks} />

        {/* ── Pipeline view ── */}
        {threadView === 'pipeline' && (
          <div className="ftm-pipeline-wrap">
            <div className="ftm-pipeline">
              {tasks.map((task, i) => (
                <div key={task.id} className="ftm-step-wrap" style={{ display: 'flex', alignItems: 'center' }}>
                  <TaskCard
                    task={task}
                    index={i}
                    isActive={i === activeIdx}
                    isDragging={dragIdx === i}
                    isDragOver={dragOverIdx === i}
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={() => setDragOverIdx(i)}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={handleDragEnd}
                    onCycleStatus={() => cycleTaskStatus(task.id, task.status)}
                    onEditTask={id => setEditingTaskId(id)}
                  />
                  {i < tasks.length - 1 && (
                    <div className={`ftm-step-connector${task.status === 'Done' ? ' done' : ''}`} />
                  )}
                </div>
              ))}

              {addingTask ? (
                <div className="ftm-step-wrap">
                  {tasks.length > 0 && <div className="ftm-step-connector" />}
                  <div className="ftm-step-add-form">
                    <input
                      autoFocus
                      className="ftm-finput"
                      placeholder="Task title…"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddTask()
                        if (e.key === 'Escape') { setAddingTask(false); setNewTitle('') }
                      }}
                    />
                    <button className="ftm-btn" onClick={handleAddTask} disabled={saving}>
                      {saving ? '…' : 'Add'}
                    </button>
                    <button className="ftm-gbtn" onClick={() => { setAddingTask(false); setNewTitle('') }}>✕</button>
                  </div>
                </div>
              ) : (
                tasks.length === 0 && (
                  <button className="ftm-step-empty-btn" onClick={() => setAddingTask(true)}>
                    + Add first task
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* ── Table view ── */}
        {threadView === 'table' && (
          tasks.length === 0 && !addingTask ? (
            <div className="ftm-empty" style={{ padding: '24px 0' }}>
              No tasks yet — add one above or start from a template.
            </div>
          ) : (
            <div className="ftm-table">
              <div className="ftm-row hdr">
                <div />
                <div className="ftm-ch">Task</div>
                <div className="ftm-ch">Status</div>
                <div className="ftm-ch">Priority</div>
                <div className="ftm-ch">Assignee</div>
                <div className="ftm-ch">Due</div>
                <div />
              </div>
              {tasks.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  selected={editingTaskId === t.id}
                  onSelect={id => setEditingTaskId(id)}
                  onToggle={(id, status) => cycleTaskStatus(id, status)}
                  onUpdate={(id, db, state) => updateTask(id, db, state)}
                  users={users}
                  categories={categories}
                  companies={companies}
                  threads={threads}
                  onOpenThread={onOpenThread}
                  hideThread
                />
              ))}
              {addingTask ? (
                <div className="ftm-addrow ftm-addrow-form">
                  <input
                    autoFocus
                    className="ftm-finput"
                    style={{ flex: 1, height: 28, fontSize: 12 }}
                    placeholder="Task title…"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddTask()
                      if (e.key === 'Escape') { setAddingTask(false); setNewTitle('') }
                    }}
                  />
                  <button className="ftm-btn" style={{ height: 28, fontSize: 12 }} onClick={handleAddTask} disabled={saving}>
                    {saving ? '…' : 'Add'}
                  </button>
                  <button className="ftm-gbtn" style={{ height: 28, fontSize: 12 }} onClick={() => { setAddingTask(false); setNewTitle('') }}>✕</button>
                </div>
              ) : (
                <div className="ftm-addrow" onClick={() => setAddingTask(true)}>
                  <span>+</span> Add task
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* ── Save-as-template modal ── */}
      {saveTemplateOpen && (
        <SaveAsTemplateModal
          thread={thread}
          steps={tasks}
          onClose={() => setSaveTemplateOpen(false)}
          onSaved={() => setSaveTemplateOpen(false)}
        />
      )}

      {/* ── Apply template modal ── */}
      {applyTemplateOpen && (
        <ApplyTemplateModal
          threadId={threadId}
          existingMaxOrder={tasks.length}
          onApply={addMultipleTasks}
          onClose={() => setApplyTemplateOpen(false)}
          users={users}
          profiles={profiles}
        />
      )}

    </div>
  )
}
