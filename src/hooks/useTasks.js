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
        category:categories(id, name),
        thread:threads(id, name),
        company:companies(id, name, type),
        assignee:users(id, name, initials, role)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setTasks(data)
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

  return { tasks, loading, error, refetch: fetch, toggleDone, updateNotes }
}

/**
 * Fetches lookup data needed to populate the "New task" form.
 */
export function useLookups() {
  const [lookups, setLookups] = useState({ categories: [], threads: [], companies: [], users: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('threads').select('id, name').order('name'),
      supabase.from('companies').select('id, name, type').order('name'),
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
 * Creates a new task and optionally logs an activity entry.
 */
export async function createTask(fields) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      title:       fields.title,
      description: fields.description || null,
      status:      'Open',
      priority:    fields.priority,
      due_date:    fields.due_date || null,
      notes:       '',
      category_id: fields.category_id,
      thread_id:   fields.thread_id,
      company_id:  fields.company_id || null,
      assignee_id: fields.assignee_id,
    }])
    .select(`
      id, title, description, status, priority, due_date, notes, created_at,
      category:categories(id, name),
      thread:threads(id, name),
      company:companies(id, name, type),
      assignee:users(id, name, initials, role)
    `)
    .single()

  return { data, error }
}
