import { useState, useEffect } from 'react'
import { STATUS_CLASS, PRIORITY_CLASS, STATUSES, PRIORITIES } from '../constants'

export default function DetailPanel({
  task, onClose, onToggle, onUpdateNotes, onUpdate,
  categories = [], threads = [], companies = [], users = [],
}) {
  const [title, setTitle]   = useState('')
  const [desc,  setDesc]    = useState('')
  const [notes, setNotes]   = useState('')

  // Reset local state whenever the selected task changes
  useEffect(() => {
    setTitle(task?.title       ?? '')
    setDesc (task?.description ?? '')
    setNotes(task?.notes       ?? '')
  }, [task?.id])

  if (!task) return <div className="ftm-detail" />

  // Persist a field change — dbUpdates goes to Supabase, stateUpdates patches
  // the in-memory task object (pass when the DB column differs from the shape
  // stored in state, e.g. category_id → category: { id, name })
  function save(dbUpdates, stateUpdates) {
    onUpdate?.(task.id, dbUpdates, stateUpdates)
  }

  return (
    <div className="ftm-detail open">

      {/* ── Header ── */}
      <div className="ftm-dhdr">
        <input
          className="ftm-dtitle-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => {
            const v = title.trim()
            if (v && v !== task.title) save({ title: v })
            else setTitle(task.title) // revert if empty
          }}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
        />
        <button className="ftm-dclose" onClick={onClose}>×</button>
      </div>

      <div className="ftm-dbody">

        {/* ── Status chips ── */}
        <div className="ftm-dsec">
          <div className="ftm-dsec-t">Status</div>
          <div className="ftm-dchips">
            {STATUSES.map(s => (
              <button
                key={s}
                className={`ftm-dchip ftm-badge ${STATUS_CLASS[s] ?? 's-open'}${task.status === s ? ' ftm-dchip-active' : ''}`}
                onClick={() => save({ status: s })}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* ── Priority chips ── */}
        <div className="ftm-dsec">
          <div className="ftm-dsec-t">Priority</div>
          <div className="ftm-dchips">
            {PRIORITIES.map(p => (
              <button
                key={p}
                className={`ftm-dchip ftm-badge ${PRIORITY_CLASS[p] ?? 'p-md'}${task.priority === p ? ' ftm-dchip-active' : ''}`}
                onClick={() => save({ priority: p })}
              >{p}</button>
            ))}
          </div>
        </div>

        {/* ── Editable detail rows ── */}
        <div className="ftm-dsec">
          <div className="ftm-dsec-t">Details</div>

          <div className="ftm-drow">
            <span className="ftm-dlbl">Assignee</span>
            <select
              className="ftm-dsel"
              value={task.assignee?.id ?? ''}
              onChange={e => {
                const u = users.find(u => u.id === e.target.value)
                save(
                  { assignee_id: e.target.value || null },
                  { assignee: u ?? null },
                )
              }}
            >
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="ftm-drow">
            <span className="ftm-dlbl">Category</span>
            <select
              className="ftm-dsel"
              value={task.category?.id ?? ''}
              onChange={e => {
                const c = categories.find(c => c.id === e.target.value)
                save(
                  { category_id: e.target.value || null },
                  { category: c ? { id: c.id, name: c.name } : null },
                )
              }}
            >
              <option value="">— None —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="ftm-drow">
            <span className="ftm-dlbl">Thread</span>
            <select
              className="ftm-dsel"
              value={task.thread?.id ?? ''}
              onChange={e => {
                const t = threads.find(t => t.id === e.target.value)
                save(
                  { thread_id: e.target.value || null },
                  { thread: t ? { id: t.id, name: t.name } : null },
                )
              }}
            >
              <option value="">— No thread —</option>
              {threads.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="ftm-drow">
            <span className="ftm-dlbl">Company</span>
            <select
              className="ftm-dsel"
              value={task.company?.id ?? ''}
              onChange={e => {
                const c = companies.find(c => c.id === e.target.value)
                save(
                  { company_id: e.target.value || null },
                  { company: c ? { id: c.id, name: c.name, type: c.type } : null },
                )
              }}
            >
              <option value="">— None —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="ftm-drow">
            <span className="ftm-dlbl">Due</span>
            <input
              className="ftm-dsel"
              type="date"
              value={task.due_date ?? ''}
              onChange={e => save({ due_date: e.target.value || null })}
            />
          </div>
        </div>

        {/* ── Description ── */}
        <div className="ftm-dsec">
          <div className="ftm-dsec-t">Description</div>
          <textarea
            className="ftm-dnotes"
            placeholder="Add a description…"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            onBlur={() => {
              if (desc !== (task.description ?? '')) save({ description: desc || null })
            }}
            style={{ minHeight: 56 }}
          />
        </div>

        {/* ── Notes ── */}
        <div className="ftm-dsec">
          <div className="ftm-dsec-t">Notes</div>
          <textarea
            className="ftm-dnotes"
            placeholder="Add notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (task.notes ?? '')) onUpdateNotes(task.id, notes)
            }}
          />
        </div>

        {/* ── Activity ── */}
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

      </div>
    </div>
  )
}
