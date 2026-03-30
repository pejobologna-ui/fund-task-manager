import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Normalise a profiles row into the { id, name, initials, role } shape that
// all UI components expect (they were written against the old users table).
function shapeProfile(p) {
  if (!p) return null
  return { id: p.id, name: p.full_name ?? p.name ?? '', initials: p.initials ?? '', role: p.role ?? '' }
}

// ── Column-detection ─────────────────────────────────────────────────────────
// Migration 012 adds macro_category, "order", threads.status, etc.
// No module-level cache — schema can change after migrations are applied.
async function schemaCols() {
  const [catTest, taskTest, threadTest, tplTest, thAssigneeTest, thDueDateTest, thCatTest, thPriTest] = await Promise.all([
    supabase.from('activity_categories').select('macro_category').limit(0),
    supabase.from('tasks').select('"order"').limit(0),
    supabase.from('threads').select('status').limit(0),
    supabase.from('thread_templates').select('description').limit(0),
    supabase.from('threads').select('assignee_id').limit(0),
    supabase.from('threads').select('due_date').limit(0),
    supabase.from('threads').select('category_id').limit(0),
    supabase.from('threads').select('priority').limit(0),
  ])
  return {
    hasMacroCategory:  !catTest.error,
    hasOrder:          !taskTest.error,
    hasThreadStatus:   !threadTest.error,
    hasTplDescription: !tplTest.error,
    hasThreadAssignee: !thAssigneeTest.error,
    hasThreadDueDate:  !thDueDateTest.error,
    hasThreadCategory: !thCatTest.error,
    hasThreadPriority: !thPriTest.error,
  }
}

// Build select fragments based on detected schema
function catSelect(s) {
  return s.hasMacroCategory
    ? 'category:activity_categories(id, name, macro_category)'
    : 'category:activity_categories(id, name)'
}
function threadEmbed(s) {
  return s.hasThreadStatus
    ? 'thread:threads(id, name, status)'
    : 'thread:threads(id, name)'
}
function threadEmbedFull(s) {
  return s.hasThreadStatus
    ? 'thread:threads!thread_id(id, name, status, company:companies(id, name, type))'
    : 'thread:threads!thread_id(id, name, company:companies(id, name, type))'
}

// ── useTasks ─────────────────────────────────────────────────────────────────
/**
 * Fetches standalone tasks (thread_id IS NULL) with their related data joined.
 * Thread tasks are surfaced separately via useActiveSteps / useThread.
 */
export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const s = await schemaCols()
    const cols = [
      'id, title, description, status, priority, due_date, notes, created_at',
      'visibility, created_by',
      s.hasOrder ? '"order"' : null,
      catSelect(s),
      threadEmbed(s),
      'company:companies(id, name, type, fund_id)',
      'assignee:profiles!assignee_id(id, full_name, initials, role)',
    ].filter(Boolean).join(',\n        ')

    const { data, error } = await supabase
      .from('tasks')
      .select(cols)
      .is('thread_id', null)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      const seen = new Set()
      const unique = (data ?? []).filter(t => seen.has(t.id) ? false : seen.add(t.id))
      setTasks(unique.map(r => ({ ...r, assignee: shapeProfile(r.assignee) })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const toggleDone = useCallback(async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'Done' ? 'Open' : 'Done'
    const { error } = await supabase
      .from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (!error) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    return error
  }, [])

  const updateNotes = useCallback(async (taskId, notes) => {
    const { error } = await supabase
      .from('tasks').update({ notes }).eq('id', taskId)
    if (!error) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes } : t))
    return error
  }, [])

  const updateField = useCallback(async (taskId, dbUpdates, stateUpdates) => {
    const { error } = await supabase
      .from('tasks').update(dbUpdates).eq('id', taskId)
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId
        ? { ...t, ...(stateUpdates ?? dbUpdates) }
        : t
      ))
    }
    return error
  }, [])

  return { tasks, loading, error, refetch: fetch, toggleDone, updateNotes, updateField }
}

// ── useLookups ────────────────────────────────────────────────────────────────
/**
 * Fetches lookup data for dropdowns: categories, threads, companies, users.
 * users is sourced from profiles (shaped as { id, name, initials, role }).
 */
export function useLookups() {
  const [lookups, setLookups] = useState({
    categories: [], threads: [], companies: [], users: [], threadProgress: {},
  })
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const s = await schemaCols()
    const catCols = s.hasMacroCategory ? 'id, name, macro_category' : 'id, name'
    const thCols  = s.hasThreadStatus
      ? 'id, name, status, template_id, company_id, company:companies(id, name, type)'
      : 'id, name, company_id, company:companies(id, name, type)'
    const [cats, threads, cos, profs] = await Promise.all([
      supabase.from('activity_categories').select(catCols).order('name'),
      supabase.from('threads').select(thCols).order('name'),
      supabase.from('companies').select('id, name, type, fund_id').order('name'),
      supabase.from('profiles').select('id, full_name, initials, role').order('full_name'),
    ])

    // Thread progress: try thread_steps (pre-012), fall back to tasks
    let stepRows
    const { data: tsData, error: tsErr } = await supabase
      .from('thread_steps').select('thread_id, status')
    if (tsErr) {
      const { data: tkData } = await supabase
        .from('tasks').select('thread_id, status').not('thread_id', 'is', null)
      stepRows = tkData
    } else {
      stepRows = tsData
    }
    const threadProgress = {}
    ;(stepRows ?? []).forEach(row => {
      if (!row.thread_id) return
      if (!threadProgress[row.thread_id]) threadProgress[row.thread_id] = { done: 0, total: 0 }
      threadProgress[row.thread_id].total++
      if (row.status === 'completed' || row.status === 'Done') threadProgress[row.thread_id].done++
    })

    // Use profiles if available, fall back to legacy users table (display-only —
    // legacy IDs are text, not UUID, so they can't be used as assignee_id FKs).
    let userList = (profs.data ?? []).map(shapeProfile)
    if (userList.length === 0) {
      const { data: legacyUsers } = await supabase.from('users').select('id, name, initials, role').order('name')
      userList = (legacyUsers ?? []).map(u => ({ ...u, _legacy: true }))
    }

    setLookups({
      categories: cats.data   ?? [],
      threads:    threads.data ?? [],
      companies:  cos.data    ?? [],
      users:      userList,
      threadProgress,
    })
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { ...lookups, loading, refetch: fetchAll }
}

// ── useProfiles ───────────────────────────────────────────────────────────────
export function useProfiles() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, initials, role')
      .order('full_name')
      .then(({ data }) => { setProfiles(data ?? []); setLoading(false) })
  }, [])

  return { profiles, loading }
}

// ── useTemplates ──────────────────────────────────────────────────────────────
/**
 * Lightweight hook — fetches thread_templates for the category-hint feature.
 * Returns a plain array (no loading state needed — hint degrades gracefully).
 */
export function useTemplates() {
  const [templates, setTemplates] = useState([])
  useEffect(() => {
    supabase
      .from('thread_templates')
      .select('id, name, steps')
      .order('name')
      .then(({ data }) => setTemplates(data ?? []))
  }, [])
  return templates
}

// ── useThread ─────────────────────────────────────────────────────────────────
/**
 * Fetches a single thread with all its tasks (ordered by "order" if available).
 */
export function useThread(threadId) {
  const [thread, setThread] = useState(null)
  const [tasks,  setTasks]  = useState([])
  const [loading, setLoading] = useState(true)

  const fetchThread = useCallback(async () => {
    if (!threadId) return
    setLoading(true)
    const s = await schemaCols()
    const thColParts = [
      'id, name, description, created_by, created_at',
      s.hasThreadStatus ? 'status, template_id' : null,
      'company_id, company:companies(id, name, type)',
    ].filter(Boolean)
    if (s.hasThreadAssignee) thColParts.push('assignee_id, assignee:profiles!assignee_id(id, full_name, initials, role)')
    if (s.hasThreadDueDate)  thColParts.push('due_date')
    if (s.hasThreadCategory) thColParts.push('category_id, category:activity_categories(id, name, macro_category)')
    if (s.hasThreadPriority) thColParts.push('priority')
    const thCols = thColParts.join(', ')

    const tkCols = [
      'id, title, description, status, priority, due_date, notes, created_at',
      s.hasOrder ? '"order"' : null,
      catSelect(s),
      'company:companies(id, name, type)',
      'assignee:profiles!assignee_id(id, full_name, initials, role)',
    ].filter(Boolean).join(',\n          ')

    const query = supabase.from('tasks').select(tkCols).eq('thread_id', threadId)
    if (s.hasOrder) query.order('"order"', { ascending: true })
    else query.order('created_at', { ascending: true })

    const [{ data: th }, { data: tk }] = await Promise.all([
      supabase.from('threads').select(thCols).eq('id', threadId).single(),
      query,
    ])

    const threadRow = th ? { ...th, assignee: shapeProfile(th.assignee ?? null) } : null
    setThread(threadRow)
    setTasks((tk ?? []).map(r => ({ ...r, assignee: shapeProfile(r.assignee) })))
    setLoading(false)
  }, [threadId])

  useEffect(() => { fetchThread() }, [fetchThread])

  // Add a new task at the end of the thread, inheriting thread-level attributes
  const addTask = useCallback(async (title) => {
    const s = await schemaCols()
    const insertFields = {
      thread_id:  threadId,
      title,
      status:     'Open',
      priority:   (s.hasThreadPriority && thread?.priority) ? thread.priority : 'Medium',
      visibility: 'team',
      notes:       '',
    }
    // Inherit company, category, and priority from the thread when set
    if (thread?.company_id)                              insertFields.company_id  = thread.company_id
    if (s.hasThreadCategory && thread?.category_id)      insertFields.category_id = thread.category_id
    if (s.hasOrder) {
      insertFields.order = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) + 1 : 0
    }

    const selCols = [
      'id, title, description, status, priority, due_date, notes, created_at',
      s.hasOrder ? '"order"' : null,
      catSelect(s),
      'company:companies(id, name, type)',
      'assignee:profiles!assignee_id(id, full_name, initials, role)',
    ].filter(Boolean).join(',\n        ')

    const { data, error } = await supabase
      .from('tasks')
      .insert(insertFields)
      .select(selCols)
      .single()
    if (!error) {
      setTasks(prev => [...prev, { ...data, assignee: shapeProfile(data.assignee) }])
    }
    return error
  }, [threadId, tasks, thread])

  // Cycle task status: Open → In Progress → In Review → Done → Open
  const STATUS_CYCLE = {
    'Open':      'In Progress',
    'In Progress': 'In Review',
    'In Review': 'Done',
    'Done':      'Open',
  }
  const cycleTaskStatus = useCallback(async (taskId, currentStatus) => {
    const next = STATUS_CYCLE[currentStatus] ?? 'Open'
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', taskId)
    if (!error) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: next } : t))
    return error
  }, [])

  const reorderTasks = useCallback(async (reordered) => {
    setTasks(reordered)
    await Promise.all(reordered.map((t, i) =>
      supabase.from('tasks').update({ order: i }).eq('id', t.id)
    ))
  }, [])

  const updateTask = useCallback(async (taskId, dbUpdates, stateUpdates) => {
    const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId)
    if (!error) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...(stateUpdates ?? dbUpdates) } : t))
    return error
  }, [])

  const deleteTask = useCallback(async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) setTasks(prev => prev.filter(t => t.id !== taskId))
    return error
  }, [])

  // Update thread metadata (name, description, status, company_id, assignee_id, due_date).
  // stateUpdates lets callers patch nested objects (e.g. { company: {id,name,type} })
  // that differ from the raw DB field names stored in fields.
  const updateThread = useCallback(async (fields, stateUpdates = {}) => {
    // Optimistic update — apply immediately, rollback on error
    let snapshot = null
    setThread(prev => {
      snapshot = prev
      return prev ? { ...prev, ...fields, ...stateUpdates } : prev
    })
    const { error } = await supabase.from('threads').update(fields).eq('id', threadId)
    if (error && snapshot) setThread(snapshot)
    return error
  }, [threadId])

  // Bulk-update all current tasks in this thread then refetch for fresh nested data.
  const cascadeToTasks = useCallback(async (fields) => {
    if (!tasks.length) return null
    const ids = tasks.map(t => t.id)
    const { error } = await supabase.from('tasks').update(fields).in('id', ids)
    if (!error) await fetchThread()
    return error
  }, [tasks, fetchThread])

  // Bulk-insert tasks from a template into this thread
  const addMultipleTasks = useCallback(async (taskRows) => {
    const { error } = await supabase.from('tasks').insert(taskRows)
    if (!error) await fetchThread()
    return error
  }, [fetchThread])

  // Delete thread and all its tasks
  const deleteThread = useCallback(async () => {
    // Delete tasks first (foreign key), then thread
    await supabase.from('tasks').delete().eq('thread_id', threadId)
    const { error } = await supabase.from('threads').delete().eq('id', threadId)
    return error
  }, [threadId])

  return {
    thread, tasks, loading, refetch: fetchThread,
    addTask, cycleTaskStatus, reorderTasks, updateTask, deleteTask,
    updateThread, cascadeToTasks, addMultipleTasks, deleteThread,
  }
}

// ── useActiveSteps ────────────────────────────────────────────────────────────
/**
 * Returns one "active task" per thread — the first non-Done task (by order) —
 * shaped with _isStep / _threadId markers for routing in App.jsx.
 */
export function useActiveSteps() {
  const [activeSteps, setActiveSteps] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSteps = useCallback(async () => {
    setLoading(true)
    const s = await schemaCols()
    const cols = [
      'id, title, description, status, priority, due_date, created_at',
      'thread_id',
      s.hasOrder ? '"order"' : null,
      threadEmbedFull(s),
      catSelect(s),
      'assignee:profiles!assignee_id(id, full_name, initials, role)',
    ].filter(Boolean).join(',\n        ')

    const query = supabase.from('tasks').select(cols)
      .not('thread_id', 'is', null)
      .neq('status', 'Done')
    if (s.hasOrder) query.order('"order"', { ascending: true })
    else query.order('created_at', { ascending: true })

    const { data, error } = await query

    if (!error && data) {
      // Group by thread, keep first (lowest order) per thread
      const byThread = {}
      for (const task of data) {
        if (!byThread[task.thread_id]) byThread[task.thread_id] = task
      }
      setActiveSteps(Object.values(byThread).map(task => ({
        ...task,
        assignee:   shapeProfile(task.assignee),
        category:   task.category ?? { id: null, name: 'Threads', macro_category: null },
        company:    task.thread?.company ?? null,
        thread:     task.thread ? { id: task.thread_id, name: task.thread.name } : null,
        visibility: 'team',
        notes:      '',
        created_by: null,
        _isStep:    true,
        _threadId:  task.thread_id,
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchSteps() }, [fetchSteps])

  // Cycle step-task status — same as a regular task but refetches after
  const STATUS_CYCLE = { 'Open': 'In Progress', 'In Progress': 'In Review', 'In Review': 'Done' }

  const cycleActiveStep = useCallback(async (taskId, currentStatus) => {
    const next = STATUS_CYCLE[currentStatus] ?? 'Done'
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', taskId)
    if (!error) fetchSteps()
    return error
  }, [fetchSteps])

  const updateActiveStep = useCallback(async (taskId, dbUpdates) => {
    const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId)
    if (!error) fetchSteps()
    return error
  }, [fetchSteps])

  return { activeSteps, loading, refetch: fetchSteps, cycleActiveStep, updateActiveStep }
}

// ── createTaskWithShares ──────────────────────────────────────────────────────
/**
 * Creates a new task and inserts task_shares rows for personal/restricted tasks.
 */
export async function createTaskWithShares(fields, shareWithIds = []) {
  const s = await schemaCols()
  const insertFields = {
    title:       fields.title,
    description: fields.description || null,
    status:      fields.status || 'Open',
    priority:    fields.priority,
    due_date:    fields.due_date    || null,
    notes:       '',
    visibility:  fields.visibility  ?? 'team',
    category_id: fields.category_id || null,
    thread_id:   fields.thread_id   || null,
    company_id:  fields.company_id  || null,
    assignee_id: fields.assignee_id || null,
  }
  if (s.hasOrder) insertFields.order = fields.order ?? null

  const selCols = [
    'id, title, description, status, priority, due_date, notes, created_at',
    'visibility, created_by',
    s.hasOrder ? '"order"' : null,
    catSelect(s),
    threadEmbed(s),
    'company:companies(id, name, type, fund_id)',
    'assignee:profiles!assignee_id(id, full_name, initials, role)',
  ].filter(Boolean).join(',\n      ')

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert([insertFields])
    .select(selCols)
    .single()

  if (taskError) return { data: null, error: taskError }

  if ((fields.visibility === 'personal' || fields.visibility === 'restricted') && shareWithIds.length > 0) {
    const rows = shareWithIds.map(uid => ({ task_id: task.id, shared_with: uid }))
    const { error: sharesError } = await supabase.from('task_shares').insert(rows)
    if (sharesError) return { data: task, error: sharesError }
  }

  return { data: { ...task, assignee: shapeProfile(task.assignee) }, error: null }
}

// ── createTemplate ────────────────────────────────────────────────────────────
export async function createTemplate(fields) {
  const s = await schemaCols()
  const selCols = s.hasTplDescription
    ? 'id, name, category, description, steps'
    : 'id, name, category, steps'
  const { data, error } = await supabase
    .from('thread_templates')
    .insert(fields)
    .select(selCols)
    .single()
  return { data, error }
}

// ── useManage ─────────────────────────────────────────────────────────────────
/**
 * Manages categories, companies, and thread_templates.
 * Funds are companies with type='fund' — derived from companies list.
 */
export function useManage() {
  const [categories, setCategories] = useState([])
  const [companies,  setCompanies]  = useState([])
  const [templates,  setTemplates]  = useState([])
  const [loading, setLoading]       = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const s = await schemaCols()
    const catCols = s.hasMacroCategory ? 'id, name, macro_category' : 'id, name'
    const tplCols = s.hasTplDescription
      ? 'id, name, category, description, steps'
      : 'id, name, category, steps'
    const [{ data: cats }, { data: cos }, { data: tpls }] = await Promise.all([
      supabase.from('activity_categories').select(catCols).order('name'),
      supabase.from('companies').select('id, name, type, fund_id').order('name'),
      supabase.from('thread_templates').select(tplCols).order('name'),
    ])
    setCategories(cats ?? [])
    setCompanies(cos   ?? [])
    setTemplates(tpls  ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // Derived: fund companies (type='fund') act as the old "funds" list
  const funds = useMemo(() => companies.filter(c => c.type === 'fund'), [companies])

  // ── Categories ──────────────────────────────────────────────────────────────
  const addCategory = useCallback(async (name, macro_category = null) => {
    const tmp = { id: `tmp-${Date.now()}`, name, macro_category }
    setCategories(prev => [...prev, tmp])
    const s = await schemaCols()
    const insertFields = s.hasMacroCategory ? { name, macro_category } : { name }
    const selCols = s.hasMacroCategory ? 'id, name, macro_category' : 'id, name'
    const { data, error } = await supabase
      .from('activity_categories').insert(insertFields)
      .select(selCols).single()
    if (error) { setCategories(prev => prev.filter(c => c.id !== tmp.id)); return error }
    setCategories(prev => prev.map(c => c.id === tmp.id ? data : c))
    return null
  }, [])

  const renameCategory = useCallback(async (id, name) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    const { error } = await supabase.from('activity_categories').update({ name }).eq('id', id)
    if (error) { refetch(); return error }
    return null
  }, [refetch])

  const updateCategory = useCallback(async (id, fields) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    const { error } = await supabase.from('activity_categories').update(fields).eq('id', id)
    if (error) { refetch(); return error }
    return null
  }, [refetch])

  const deleteCategory = useCallback(async (id) => {
    setCategories(prev => prev.filter(c => c.id !== id))
    const { error } = await supabase.from('activity_categories').delete().eq('id', id)
    if (error) { refetch(); return error }
    return null
  }, [refetch])

  // ── Companies ───────────────────────────────────────────────────────────────
  const addCompany = useCallback(async (fields) => {
    const tmp = { id: `tmp-${Date.now()}`, ...fields }
    setCompanies(prev => [...prev, tmp])
    const { data, error } = await supabase
      .from('companies').insert(fields)
      .select('id, name, type, fund_id').single()
    if (error) { setCompanies(prev => prev.filter(c => c.id !== tmp.id)); return error }
    setCompanies(prev => prev.map(c => c.id === tmp.id ? data : c))
    return null
  }, [])

  const updateCompany = useCallback(async (id, fields) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    const { error } = await supabase.from('companies').update(fields).eq('id', id)
    if (error) { refetch(); return error }
    return null
  }, [refetch])

  const deleteCompany = useCallback(async (id) => {
    setCompanies(prev => prev.filter(c => c.id !== id))
    // Null out fund_id for child companies
    setCompanies(prev => prev.map(c => c.fund_id === id ? { ...c, fund_id: null } : c))
    const { error } = await supabase.from('companies').delete().eq('id', id)
    if (error) { refetch(); return error }
    return null
  }, [refetch])

  // Fund helpers — delegate to company CRUD
  const addFund = useCallback(async (name) => {
    return addCompany({ name, type: 'fund', fund_id: null })
  }, [addCompany])

  const renameFund = useCallback(async (id, name) => {
    return updateCompany(id, { name })
  }, [updateCompany])

  const deleteFund = useCallback(async (id) => {
    return deleteCompany(id)
  }, [deleteCompany])

  // ── Templates ───────────────────────────────────────────────────────────────
  const addTemplate = useCallback(async (fields) => {
    const tmp = { id: `tmp-${Date.now()}`, ...fields }
    setTemplates(prev => [...prev, tmp])
    const s = await schemaCols()
    const selCols = s.hasTplDescription
      ? 'id, name, category, description, steps'
      : 'id, name, category, steps'
    const { data, error } = await supabase
      .from('thread_templates').insert(fields)
      .select(selCols).single()
    if (error) { setTemplates(prev => prev.filter(t => t.id !== tmp.id)); return error }
    setTemplates(prev => prev.map(t => t.id === tmp.id ? data : t))
    return null
  }, [])

  const updateTemplate = useCallback(async (id, fields) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t))
    const { error } = await supabase.from('thread_templates').update(fields).eq('id', id)
    if (error) { refetch(); return error }
    return null
  }, [refetch])

  const deleteTemplate = useCallback(async (id) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    const { error } = await supabase.from('thread_templates').delete().eq('id', id)
    if (error) { refetch(); return error }
    return null
  }, [refetch])

  return {
    categories, companies, templates, funds, loading, refetch,
    addCategory, renameCategory, updateCategory, deleteCategory,
    addCompany, updateCompany, deleteCompany,
    addFund, renameFund, deleteFund,
    addTemplate, updateTemplate, deleteTemplate,
  }
}
