'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { BucketListItem, InsertTables, UpdateTables } from '@/types'

export function useBucketListItems(coupleId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['bucket-list-items', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bucket_list_items')
        .select('*')
        .eq('couple_id', coupleId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as unknown as BucketListItem[]
    },
    enabled: !!coupleId,
  })
}

export function useCreateBucketListItem() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: InsertTables<'bucket_list_items'>) => {
      const { data, error } = await supabase
        .from('bucket_list_items')
        .insert(item)
        .select()
        .single()

      if (error) throw error
      return data as unknown as BucketListItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bucket-list-items'] })
    },
  })
}

export function useUpdateBucketListItem() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'bucket_list_items'> & { id: string }) => {
      const { data, error } = await supabase
        .from('bucket_list_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as unknown as BucketListItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bucket-list-items'] })
    },
  })
}

export function useDeleteBucketListItem() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bucket_list_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bucket-list-items'] })
    },
  })
}
