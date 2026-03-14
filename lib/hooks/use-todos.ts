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
      const { data, error } = await supabase
        .from('todos')
        .insert(todo)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Todo
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
      const { data, error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Todo
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
