/**
 * VisibilityToggle — 3-level shared toggle component.
 * Replaces the inline 2-button Team/Personal toggle in NewTaskModal,
 * NewThreadModal, ThreadEditModal, and ManageModal.
 *
 * Props:
 *   value    — 'team' | 'restricted' | 'personal'
 *   onChange — (v: string) => void
 */
export default function VisibilityToggle({ value, onChange }) {
  return (
    <div className="ftm-vis-toggle">
      <button
        type="button"
        className={`ftm-vis-btn${value === 'team' ? ' active' : ''}`}
        onClick={() => onChange('team')}
      >
        🏢 Team
      </button>
      <button
        type="button"
        className={`ftm-vis-btn restricted${value === 'restricted' ? ' active' : ''}`}
        onClick={() => onChange('restricted')}
      >
        🔐 Restricted
      </button>
      <button
        type="button"
        className={`ftm-vis-btn${value === 'personal' ? ' active personal' : ''}`}
        onClick={() => onChange('personal')}
      >
        🔒 Personal
      </button>
    </div>
  )
}
