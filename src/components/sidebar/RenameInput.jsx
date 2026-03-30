export default function RenameInput({ inputRef, value, onChange, onCommit, onCancel }) {
  return (
    <input
      ref={inputRef}
      className="ftm-sinline-input"
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === 'Enter')  { e.preventDefault(); onCommit() }
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={onCommit}
    />
  )
}
