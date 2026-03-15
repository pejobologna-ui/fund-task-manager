import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Fetches all tasks with their related data joined.
 * Returns { tasks, loading, error, refetch, toggleDone, updateNotes }
 */
export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, description, status, priority, due_date, notes, created_at,
        visibility, created_by,
        category:activity_categories(id, name),
        thread:threads(id, name),
        company:companies(id, name, type, fund),
        assignee:users(id, name, initials, role)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      // Deduplicate by id — RLS policies that join through task_shares can cause
      // PostgREST to return one row per matching share row.
      const seen = new Set()
      setTasks(data.filter(t => seen.has(t.id) ? false : seen.add(t.id)))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const toggleDone = useCallback(async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'Done' ? 'Open' : 'Done'
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)

    if (!error) {
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      )
    }
    return error
  }, [])

  const updateNotes = useCallback(async (taskId, notes) => {
    const { error } = await supabase
      .from('tasks')
      .update({ notes })
      .eq('id', taskId)

    if (!error) {
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, notes } : t)
      )
    }
    return error
  }, [])

  // Generic field updater. dbUpdates goes to Supabase; stateUpdates is merged
  // into local state (pass it when you also need to update nested objects like
  // the full `assignee` record alongside the FK column).
  const updateField = useCallback(async (taskId, dbUpdates, stateUpdates) => {
    const { error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', taskId)

    if (!error) {
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, ...(stateUpdates ?? dbUpdates) } : t)
      )
    }
    return error
  }, [])

  return { tasks, loading, error, refetch: fetch, toggleDone, updateNotes, updateField }
}

/**
 * Fetches lookup data needed to populate the "New task" form.
 */
export function useLookups() {
  const [lookups, setLookups] = useState({ categories: [], threads: [], companies: [], users: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('activity_categories').select('id, name').order('name'),
      supabase.from('threads').select('id, name').order('name'),
      supabase.from('companies').select('id, name, type, fund').order('name'),
      supabase.from('users').select('id, name, initials, role').order('name'),
    ]).then(([cats, threads, cos, users]) => {
      setLookups({
        categories: cats.data ?? [],
        threads:    threads.data ?? [],
        companies:  cos.data ?? [],
        users:      users.data ?? [],
      })
      setLoading(false)
    })
  }, [])

  return { ...lookups, loading }
}

/**
 * Fetches all profiles (for the share-with picker in the new task modal).
 */
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

/**
 * Creates a new task and inserts task_shares rows for personal tasks.
 * shareWithIds: array of profile UUIDs to share with (may be empty).
 */
export async function createTaskWithShares(fields, shareWithIds = []) {
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert([{
      title:       fields.title,
      description: fields.description || null,
      status:      'Open',
      priority:    fields.priority,
      due_date:    fields.due_date || null,
      notes:       '',
      visibility:  fields.visibility ?? 'team',
      category_id: fields.category_id,
      thread_id:   fields.thread_id   || null,
      company_id:  fields.company_id  || null,
      assignee_id: fields.assignee_id || null,
    }])
    .select(`
      id, title, description, status, priority, due_date, notes, created_at,
      visibility, created_by,
      category:activity_categories(id, name),
      thread:threads(id, name),
      company:companies(id, name, type, fund),
      assignee:users(id, name, initials, role)
    `)
    .single()

  if (taskError) return { data: null, error: taskError }

  if (shareWithIds.length > 0) {
    const rows = shareWithIds.map(uid => ({ task_id: task.id, shared_with: uid }))
    const { error: sharesError } = await supabase.from('task_shares').insert(rows)
    if (sharesError) return { data: task, error: sharesError }
  }

  return { data: task, error: null }
}
