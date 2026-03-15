import { useState, useRef } from 'react'
import { useThread } from '../hooks/useTasks'
import TaskList from '../components/TaskList'

const STEP_STATUS = {
  completed:   { bg: '#eaf3de', color: '#3b6d11', label: 'Done'        },
  in_progress: { bg: '#faeeda', color: '#854f0b', label: 'In Progress' },
  pending:     { bg: '#ededec', color: '#888',    label: 'Pending'     },
}

function StepCard({
  step, index, isActive, isDragging, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd, onCycleStatus,
}) {
  const ss      = STEP_STATUS[step.status] ?? STEP_STATUS.pending
  const isDone  = step.status === 'completed'
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
      {/* Step number */}
      <div className={`ftm-step-num${isDone ? ' done' : isActive ? ' active' : ''}`}>
        {isDone ? '✓' : index + 1}
      </div>

      {isActive && <div className="ftm-step-active-pill">ACTIVE</div>}

      <div className="ftm-step-title">{step.title}</div>

      {step.description && (
        <div className="ftm-step-desc">{step.description}</div>
      )}

      {/* Status badge — click cycles status */}
      <span
        className="ftm-badge ftm-step-status-badge"
        style={{ background: ss.bg, color: ss.color, cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); onCycleStatus() }}
        title="Click to advance status"
      >
        {ss.label}
      </span>

      {/* Assignee + due */}
      <div className="ftm-step-meta">
        {step.assignee && (
          <div
            className="ftm-aavatar"
            style={{ width: 18, height: 18, fontSize: 7, flexShrink: 0 }}
            title={step.assignee.full_name}
          >
            {step.assignee.initials}
          </div>
        )}
        {step.due_date && (
          <span className="ftm-step-due">{fmtDate(step.due_date)}</span>
        )}
      </div>

      {/* Drag handle — shown on hover via CSS */}
      <div className="ftm-step-drag-handle" title="Drag to reorder">⠿</div>
    </div>
  )
}

export default function ThreadPage({
  threadId, tasks, allTasks,
  selectedId, onSelect, onToggle, onUpdate,
  onBack, onOpenThread,
}) {
  const { thread, steps, loading, addStep, cycleStepStatus, reorderSteps } = useThread(threadId)

  const [dragIdx,     setDragIdx]     = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [addingStep,  setAddingStep]  = useState(false)
  const [newTitle,    setNewTitle]    = useState('')
  const [saving,      setSaving]      = useState(false)

  // First non-completed step index
  const activeIdx = steps.findIndex(s => s.status !== 'completed')

  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null) }

  async function handleDrop(targetIdx) {
    if (dragIdx === null || dragIdx === targetIdx) { handleDragEnd(); return }
    const reordered = [...steps]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    handleDragEnd()
    await reorderSteps(reordered)
  }

  async function handleAddStep() {
    if (!newTitle.trim()) return
    setSaving(true)
    await addStep(newTitle.trim())
    setNewTitle('')
    setAddingStep(false)
    setSaving(false)
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

  const doneCount  = steps.filter(s => s.status === 'completed').length
  const totalCount = steps.length

  return (
    <div className="ftm-thread-page">

      {/* ── Header ── */}
      <div className="ftm-thread-hdr">
        <button className="ftm-back-btn" onClick={onBack}>← Back</button>
        <div className="ftm-thread-info">
          <h1 className="ftm-thread-name">{thread.name}</h1>
          <div className="ftm-thread-meta">
            {thread.category   && <span className="ftm-badge b-cat">{thread.category}</span>}
            {thread.company?.name && <span className="ftm-badge b-co">{thread.company.name}</span>}
            {thread.description && <span className="ftm-thread-desc">{thread.description}</span>}
          </div>
        </div>
        <button className="ftm-btn" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => setAddingStep(true)}>
          + Add step
        </button>
      </div>

      {/* ── Pipeline ── */}
      <div className="ftm-section-block">
        <div className="ftm-section-label">
          Pipeline
          {totalCount > 0 && (
            <span className="ftm-section-progress">{doneCount} / {totalCount} complete</span>
          )}
        </div>

        <div className="ftm-pipeline-wrap">
          <div className="ftm-pipeline">
            {steps.map((step, i) => (
              <div key={step.id} className="ftm-step-wrap">
                <StepCard
                  step={step}
                  index={i}
                  isActive={i === activeIdx}
                  isDragging={dragIdx === i}
                  isDragOver={dragOverIdx === i}
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={() => setDragOverIdx(i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  onCycleStatus={() => cycleStepStatus(step.id, step.status)}
                />
                {i < steps.length - 1 && (
                  <div className={`ftm-step-connector${step.status === 'completed' ? ' done' : ''}`} />
                )}
              </div>
            ))}

            {/* Inline add-step form */}
            {addingStep ? (
              <div className="ftm-step-wrap">
                {steps.length > 0 && <div className="ftm-step-connector" />}
                <div className="ftm-step-add-form">
                  <input
                    autoFocus
                    className="ftm-finput"
                    placeholder="Step title…"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddStep()
                      if (e.key === 'Escape') { setAddingStep(false); setNewTitle('') }
                    }}
                  />
                  <button className="ftm-btn" onClick={handleAddStep} disabled={saving}>
                    {saving ? '…' : 'Add'}
                  </button>
                  <button className="ftm-gbtn" onClick={() => { setAddingStep(false); setNewTitle('') }}>✕</button>
                </div>
              </div>
            ) : (
              steps.length === 0 && (
                <button className="ftm-step-empty-btn" onClick={() => setAddingStep(true)}>
                  + Add first step
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Linked tasks ── */}
      <div className="ftm-section-block">
        <div className="ftm-section-label">
          Tasks in this thread
          <span className="ftm-section-progress">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="ftm-thread-tasks">
          <TaskList
            tasks={tasks}
            allTasks={allTasks}
            loading={false}
            error={null}
            selectedId={selectedId}
            onSelect={onSelect}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onAddInCategory={() => {}}
            onOpenThread={onOpenThread}
          />
        </div>
      </div>

    </div>
  )
}
