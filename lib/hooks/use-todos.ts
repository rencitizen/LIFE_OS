'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { isMissingTodoColumnError, stripUnsupportedTodoColumns } from '@/lib/todo-compat'
import type { Todo, InsertTables, UpdateTables } from '@/types'

export function useTodos(coupleId: string | undefined, filters?: {
  status?: string
  assignedTo?: string | null
}) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['todos', coupleId, filters],
    queryFn: async () => {
      const makeQuery = (withExtendedColumns: boolean) => {
        let query = supabase
          .from('todos')
          .select('*')
          .eq('couple_id', coupleId!)

        if (withExtendedColumns) {
          query = query.order('start_date', { ascending: true, nullsFirst: false })
        }

        query = query
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })

        if (filters?.status) {
          query = query.eq('status', filters.status)
        }
        if (filters?.assignedTo !== undefined) {
          if (filters.assignedTo === null) {
            query = query.is('assigned_to', null)
          } else {
            query = query.eq('assigned_to', filters.assignedTo)
          }
        }

        return query
      }

      try {
        const { data, error } = await makeQuery(true)
        if (error) throw error
        return data as unknown as Todo[]
      } catch (error) {
        if (!isMissingTodoColumnError(error)) throw error

        const { data, error: fallbackError } = await makeQuery(false)
        if (fallbackError) throw fallbackError
        return data as unknown as Todo[]
      }
    },
    enabled: !!coupleId,
  })
}

export function useCreateTodo() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (todo: InsertTables<'todos'>) => {
      const executeInsert = async (payload: InsertTables<'todos'>) => {
        const { data, error } = await supabase
          .from('todos')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return data as unknown as Todo
      }

      try {
        return await executeInsert(todo)
      } catch (error) {
        if (!isMissingTodoColumnError(error)) throw error

        const fallbackPayload = stripUnsupportedTodoColumns(todo as Record<string, unknown>) as InsertTables<'todos'>
        return executeInsert(fallbackPayload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}

export function useCreateTodos() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (todos: InsertTables<'todos'>[]) => {
      const executeInsert = async (payload: InsertTables<'todos'>[]) => {
        const { data, error } = await supabase
          .from('todos')
          .insert(payload)
          .select()
        if (error) throw error
        return (data ?? []) as unknown as Todo[]
      }

      try {
        return await executeInsert(todos)
      } catch (error) {
        if (!isMissingTodoColumnError(error)) throw error

        const fallbackPayload = todos.map((todo) => stripUnsupportedTodoColumns(todo as Record<string, unknown>) as InsertTables<'todos'>)
        return executeInsert(fallbackPayload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}

export function useUpdateTodo() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'todos'> & { id: string }) => {
      const executeUpdate = async (payload: UpdateTables<'todos'>) => {
        const { data, error } = await supabase
          .from('todos')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as unknown as Todo
      }

      try {
        return await executeUpdate(updates)
      } catch (error) {
        if (!isMissingTodoColumnError(error)) throw error

        const fallbackPayload = stripUnsupportedTodoColumns(updates as Record<string, unknown>) as UpdateTables<'todos'>
        return executeUpdate(fallbackPayload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}

export function useDeleteTodo() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('todos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}
