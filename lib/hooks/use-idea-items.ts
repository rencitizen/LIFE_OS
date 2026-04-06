'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { IdeaItem, InsertTables, UpdateTables } from '@/types'

export function useIdeaItems(coupleId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['idea-items', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('idea_items')
        .select('*')
        .eq('couple_id', coupleId!)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as unknown as IdeaItem[]
    },
    enabled: !!coupleId,
  })
}

export function useCreateIdeaItem() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (idea: InsertTables<'idea_items'>) => {
      const { data, error } = await supabase
        .from('idea_items')
        .insert(idea)
        .select()
        .single()

      if (error) throw error
      return data as unknown as IdeaItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idea-items'] })
    },
  })
}

export function useUpdateIdeaItem() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'idea_items'> & { id: string }) => {
      const { data, error } = await supabase
        .from('idea_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as unknown as IdeaItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idea-items'] })
    },
  })
}

export function useDeleteIdeaItem() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('idea_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idea-items'] })
    },
  })
}
