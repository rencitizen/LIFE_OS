'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Todo, InsertTables, UpdateTables } from '@/types'

export function useTodos(coupleId: string | undefined, filters?: {
  status?: string
  assignedTo?: string | null
}) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['todos', coupleId, filters],
    queryFn: async () => {
      let query = supabase
        .from('todos')
        .select('*')
        .eq('couple_id', coupleId!)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.assignedTo !== undefined) {
        query = filters.assignedTo === null
          ? query.is('assigned_to', null)
          : query.eq('assigned_to', filters.assignedTo)
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as Todo[]
    },
    enabled: !!coupleId,
  })
}

export function useCreateTodo() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (todo: InsertTables<'todos'>) => {
      const { data, error } = await (supabase as any).rpc('register_app_todo', { p_payload: todo })
      if (error) throw error
      return data as Todo
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })
}

export function useCreateTodos() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (todos: InsertTables<'todos'>[]) => {
      const { data, error } = await (supabase as any).rpc('register_app_todos', { p_payloads: todos })
      if (error) throw error
      return (data ?? []) as Todo[]
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })
}

export function useUpdateTodo() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'todos'> & { id: string }) => {
      const { data, error } = await (supabase as any).rpc('update_app_todo', {
        p_todo_id: id,
        p_changes: updates,
      })
      if (error) throw error
      return data as Todo
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })
}

export function useDeleteTodo() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc('delete_app_todo', { p_todo_id: id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })
}
