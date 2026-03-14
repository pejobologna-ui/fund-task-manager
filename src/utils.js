export function dateDiff(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dt = new Date(dateStr)
  dt.setHours(0, 0, 0, 0)
  return Math.round((dt - today) / 86_400_000)
}

export function formatDue(dateStr, status) {
  if (!dateStr) return '—'
  if (status === 'Done') return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const diff = dateDiff(dateStr)
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function dueCls(dateStr, status) {
  if (!dateStr || status === 'Done') return ''
  const diff = dateDiff(dateStr)
  if (diff < 0) return 'ov'
  if (diff <= 3) return 'soon'
  return ''
}

export function initials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
