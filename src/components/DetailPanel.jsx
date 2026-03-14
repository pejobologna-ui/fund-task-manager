import { useState, useEffect } from 'react'
import { STATUS_CLASS, PRIORITY_CLASS } from '../constants'
import { formatDue } from '../utils'

export default function DetailPanel({ task, onClose, onToggle, onUpdateNotes }) {
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setNotes(task?.notes ?? '')
  }, [task?.id])

  if (!task) return <div className="ftm-detail" />

  function handleNotesBlur() {
    if (notes !== (task.notes ?? '')) {
      onUpdateNotes(task.id, notes)
    }
  }

  return (
    <div className="ftm-detail open">
      <div className="ftm-dhdr">
        <div style={{ flex: 1 }}>
          <div className="ftm-dtitle">{task.title}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
            <span className={`ftm-badge ${STATUS_CLASS[task.status] ?? 's-open'}`}>{task.status}</span>
            <span className={`ftm-badge ${PRIORITY_CLASS[task.priority] ?? 'p-md'}`}>{task.priority}</span>
          </div>
        </div>
        <button className="ftm-dclose" onClick={onClose}>×</button>
      </div>

      <div className="ftm-dbody">
        <div className="ftm-dsec">
          <div className="ftm-dsec-t">Details</div>
          <div className="ftm-drow">
            <span className="ftm-dlbl">Assignee</span>
            <span className="ftm-dval">{task.assignee?.name ?? '—'}</span>
          </div>
          <div className="ftm-drow">
            <span className="ftm-dlbl">Category</span>
            <span className="ftm-dval">{task.category?.name ?? '—'}</span>
          </div>
          <div className="ftm-drow">
            <span className="ftm-dlbl">Thread</span>
            <span className="ftm-dval">{task.thread?.name ?? '—'}</span>
          </div>
          <div className="ftm-drow">
            <span className="ftm-dlbl">Company</span>
            <span className="ftm-dval">{task.company?.name ?? '—'}</span>
          </div>
          <div className="ftm-drow">
            <span className="ftm-dlbl">Due</span>
            <span className="ftm-dval">{formatDue(task.due_date, task.status)}</span>
          </div>
        </div>

        <div className="ftm-dsec">
          <div className="ftm-dsec-t">Description</div>
          <div className="ftm-ddesc">{task.description || 'No description.'}</div>
        </div>

        <div className="ftm-dsec">
          <div className="ftm-dsec-t">Notes</div>
          <textarea
            className="ftm-dnotes"
            placeholder="Add notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
          />
        </div>

        <div className="ftm-dsec">
          <div className="ftm-dsec-t">Activity</div>
          <div className="ftm-actitem">
            <div className="ftm-actdot" />
            <div>
              <div className="ftm-acttxt">Task created</div>
              <div className="ftm-acttime">{task.created_at?.split('T')[0] ?? '—'}</div>
            </div>
          </div>
          {task.assignee && (
            <div className="ftm-actitem">
              <div className="ftm-actdot" />
              <div>
                <div className="ftm-acttxt">Assigned to {task.assignee.name}</div>
                <div className="ftm-acttime">{task.created_at?.split('T')[0] ?? '—'}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 8 }}>
          <button
            className="ftm-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onToggle(task.id, task.status)}
          >
            {task.status === 'Done' ? 'Reopen task' : 'Mark as done'}
          </button>
        </div>
      </div>
    </div>
  )
}
