import { useState } from 'react'
import CellPopover from './CellPopover'
import { STATUS_CLASS, PRIORITY_CLASS, STATUSES, PRIORITIES } from '../constants'
import { formatDue, dueCls } from '../utils'

export function StatusBadge({ status }) {
  return <span className={`ftm-badge ${STATUS_CLASS[status] ?? 's-open'}`}>{status}</span>
}

export function PriorityBadge({ priority }) {
  return <span className={`ftm-badge ${PRIORITY_CLASS[priority] ?? 'p-md'}`}>{priority}</span>
}

export default function TaskRow({ task, selected, onSelect, onToggle, onUpdate, users, categories, companies, threads, onOpenThread, hideThread }) {
  const [openCell, setOpenCell] = useState(null)
  const isDone = task.status === 'Done'
  const dc = dueCls(task.due_date, task.status)

  function close() { setOpenCell(null) }

  return (
    <div
      className="ftm-row"
      style={selected ? { background: 'var(--gold-bg)' } : undefined}
      onClick={() => onSelect(task.id)}
    >
      <div
        className={`ftm-check${isDone ? ' chk' : ''}`}
        onClick={e => { e.stopPropagation(); onToggle(task.id, task.status) }}
      >
        {isDone ? '✓' : ''}
      </div>

      {/* Title only — context lives in the labels column */}
      <div style={{ minWidth: 0 }}>
        <div className={`ftm-ttitle${isDone ? ' done' : ''}`}>{task.title}</div>
      </div>

      {/* Labels column: category · company · thread — all editable */}
      <div className="ftm-labels">
        {/* Category */}
        <CellPopover
          open={openCell === 'category'}
          onOpen={() => setOpenCell('category')}
          onClose={close}
          trigger={<span className="ftm-badge b-cat ftm-label-badge">{task.category?.name ?? '—'}</span>}
        >
          <div className="ftm-pop-list">
            {categories.map(cat => (
              <div
                key={cat.id}
                className={`ftm-pop-item${task.category?.id === cat.id ? ' active' : ''}`}
                onClick={e => {
                  e.stopPropagation(); close()
                  onUpdate(task.id, { category_id: cat.id }, { category: { id: cat.id, name: cat.name } })
                }}
              >
                <span className="ftm-badge b-cat">{cat.name}</span>
              </div>
            ))}
          </div>
        </CellPopover>

        {/* Company */}
        <CellPopover
          open={openCell === 'company'}
          onOpen={() => setOpenCell('company')}
          onClose={close}
          trigger={<span className="ftm-badge b-co ftm-label-badge">{task.company?.name ?? 'No company'}</span>}
        >
          <div className="ftm-pop-list">
            <div
              className={`ftm-pop-item${!task.company ? ' active' : ''}`}
              onClick={e => { e.stopPropagation(); close(); onUpdate(task.id, { company_id: null }, { company: null }) }}
            >
              <span className="ftm-pop-null">General / No company</span>
            </div>
            {companies.map(co => (
              <div
                key={co.id}
                className={`ftm-pop-item${task.company?.id === co.id ? ' active' : ''}`}
                onClick={e => {
                  e.stopPropagation(); close()
                  onUpdate(task.id, { company_id: co.id }, { company: co })
                }}
              >
                {co.name}
              </div>
            ))}
          </div>
        </CellPopover>

        {/* Thread — hidden when inside a thread page */}
        {!hideThread && (
          <CellPopover
            open={openCell === 'thread'}
            onOpen={() => setOpenCell('thread')}
            onClose={close}
            trigger={<span className="ftm-badge b-thread ftm-label-badge">{task.thread?.name ?? 'No thread'}</span>}
          >
            <div className="ftm-pop-list">
              {/* Navigate to thread detail page */}
              {task.thread && (
                <div
                  className="ftm-pop-item ftm-pop-navigate"
                  onClick={e => { e.stopPropagation(); close(); onOpenThread(task.thread.id) }}
                >
                  View thread →
                </div>
              )}
              <div
                className={`ftm-pop-item${!task.thread ? ' active' : ''}`}
                onClick={e => { e.stopPropagation(); close(); onUpdate(task.id, { thread_id: null }, { thread: null }) }}
              >
                <span className="ftm-pop-null">No thread</span>
              </div>
              {threads.map(th => (
                <div
                  key={th.id}
                  className={`ftm-pop-item${task.thread?.id === th.id ? ' active' : ''}`}
                  onClick={e => {
                    e.stopPropagation(); close()
                    onUpdate(task.id, { thread_id: th.id }, { thread: { id: th.id, name: th.name } })
                  }}
                >
                  {th.name}
                </div>
              ))}
            </div>
          </CellPopover>
        )}
      </div>

      {/* Status */}
      <CellPopover
        open={openCell === 'status'}
        onOpen={() => setOpenCell('status')}
        onClose={close}
        trigger={<StatusBadge status={task.status} />}
      >
        <div className="ftm-pop-list">
          {STATUSES.map(s => (
            <div
              key={s}
              className={`ftm-pop-item${task.status === s ? ' active' : ''}`}
              onClick={e => { e.stopPropagation(); close(); onUpdate(task.id, { status: s }, { status: s }) }}
            >
              <StatusBadge status={s} />
            </div>
          ))}
        </div>
      </CellPopover>

      {/* Priority */}
      <CellPopover
        open={openCell === 'priority'}
        onOpen={() => setOpenCell('priority')}
        onClose={close}
        trigger={<PriorityBadge priority={task.priority} />}
      >
        <div className="ftm-pop-list">
          {PRIORITIES.map(p => (
            <div
              key={p}
              className={`ftm-pop-item${task.priority === p ? ' active' : ''}`}
              onClick={e => { e.stopPropagation(); close(); onUpdate(task.id, { priority: p }, { priority: p }) }}
            >
              <PriorityBadge priority={p} />
            </div>
          ))}
        </div>
      </CellPopover>

      {/* Assignee */}
      <CellPopover
        open={openCell === 'assignee'}
        onOpen={() => setOpenCell('assignee')}
        onClose={close}
        trigger={
          <div className="ftm-asgn">
            <div className="ftm-aavatar">{task.assignee?.initials ?? '?'}</div>
            <div className="ftm-aname">{(task.assignee?.name ?? '—').split(' ')[0]}</div>
          </div>
        }
      >
        <div className="ftm-pop-list">
          {users.map(u => (
            <div
              key={u.id}
              className={`ftm-pop-item${task.assignee?.id === u.id ? ' active' : ''}`}
              onClick={e => {
                e.stopPropagation()
                close()
                onUpdate(task.id, { assignee_id: u.id }, { assignee: u })
              }}
            >
              <div className="ftm-aavatar" style={{ width: 18, height: 18, fontSize: 7, flexShrink: 0 }}>{u.initials}</div>
              <span>{u.name}</span>
            </div>
          ))}
        </div>
      </CellPopover>

      {/* Due date */}
      <CellPopover
        open={openCell === 'due'}
        onOpen={() => setOpenCell('due')}
        onClose={close}
        trigger={<div className={`ftm-due${dc ? ` ${dc}` : ''}`}>{formatDue(task.due_date, task.status)}</div>}
      >
        <div className="ftm-pop-date">
          <input
            type="date"
            defaultValue={task.due_date ?? ''}
            onClick={e => e.stopPropagation()}
            onChange={e => {
              close()
              onUpdate(task.id, { due_date: e.target.value || null }, { due_date: e.target.value || null })
            }}
          />
        </div>
      </CellPopover>

      <button className="ftm-more" onClick={e => { e.stopPropagation(); onSelect(task.id) }}>⋯</button>
    </div>
  )
}
