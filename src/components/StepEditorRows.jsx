/**
 * StepEditorRows — controlled, reusable step list editor.
 * Extracted from NewThreadModal's edit phase so it can also be used
 * in ManageModal's Templates tab.
 *
 * Props:
 *   steps        — array of { tempId, title, description, assigneeId, dueDate }
 *   users        — array of { id, name } for assignee dropdown
 *   onUpdate(tempId, field, value)
 *   onRemove(tempId)
 *   onDragStart(e, idx)
 *   onDragOver(e, idx)
 *   onDragEnd()
 *   onAdd()
 */
export default function StepEditorRows({
  steps, users,
  onUpdate, onRemove,
  onDragStart, onDragOver, onDragEnd,
  onAdd,
}) {
  return (
    <div className="ftm-thread-steps-list">
      {steps.map((step, idx) => (
        <div
          key={step.tempId}
          className="ftm-thread-step-row"
          draggable
          onDragStart={e => onDragStart(e, idx)}
          onDragOver={e => onDragOver(e, idx)}
          onDragEnd={onDragEnd}
        >
          <div className="ftm-thread-step-drag" title="Drag to reorder">⠿</div>
          <div className="ftm-thread-step-num">{idx + 1}</div>
          <div className="ftm-thread-step-fields">
            <input
              className="ftm-finput ftm-thread-step-title"
              placeholder={`Step ${idx + 1} name…`}
              value={step.title}
              onChange={e => onUpdate(step.tempId, 'title', e.target.value)}
            />
            <div className="ftm-thread-step-row2">
              <select
                className="ftm-fsel ftm-thread-step-sel"
                value={step.assigneeId}
                onChange={e => onUpdate(step.tempId, 'assigneeId', e.target.value)}
              >
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input
                type="date"
                className="ftm-finput ftm-thread-step-date"
                value={step.dueDate}
                onChange={e => onUpdate(step.tempId, 'dueDate', e.target.value)}
              />
            </div>
          </div>
          <button
            className="ftm-thread-step-del"
            onClick={() => onRemove(step.tempId)}
            title="Remove step"
          >×</button>
        </div>
      ))}

      <button className="ftm-thread-step-add" onClick={onAdd}>
        + Add step
      </button>
    </div>
  )
}
