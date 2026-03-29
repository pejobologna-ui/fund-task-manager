import { useState } from 'react'
import { createTemplate } from '../hooks/useTasks'

export default function SaveAsTemplateModal({ thread, steps, onClose, onSaved }) {
  const [name, setSaveName] = useState(thread?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const stepsJson = [...steps]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s, i) => ({
        order:            i,
        title:            s.title,
        description:      s.description || '',
        default_category: s.category?.name ?? '',
      }))

    const { error: err } = await createTemplate({
      name:     name.trim(),
      category: null,
      steps:    stepsJson,
    })

    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      onSaved?.()
    }
  }

  return (
    <div className="ftm-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ftm-modal" style={{ maxWidth: 480 }}>
        <div className="ftm-mhdr">
          <span className="ftm-mtitle">Save as template</span>
          <button className="ftm-dclose" onClick={onClose}>×</button>
        </div>

        <div className="ftm-mbody">
          <div className="ftm-fgrid">
            <div className="ftm-ff full">
              <label className="ftm-flbl">Template name</label>
              <input
                className="ftm-finput"
                value={name}
                onChange={e => setSaveName(e.target.value)}
                placeholder="e.g. Investment Process"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>

            <div className="ftm-ff full">
              <label className="ftm-flbl">Tasks ({steps.length})</label>
              <ol className="ftm-template-steps-preview">
                {[...steps]
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((s, i) => (
                    <li key={s.id ?? i} className="ftm-template-step-item">
                      {s.title}
                    </li>
                  ))}
                {steps.length === 0 && (
                  <li className="ftm-template-step-item" style={{ color: '#999', fontStyle: 'italic' }}>
                    No tasks to save
                  </li>
                )}
              </ol>
            </div>
          </div>

          {error && <div className="ftm-error" style={{ marginTop: 8 }}>{error}</div>}
        </div>

        <div className="ftm-mftr">
          <button className="ftm-gbtn" onClick={onClose}>Cancel</button>
          <button className="ftm-btn" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </div>
    </div>
  )
}
