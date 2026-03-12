'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ShoppingList, ShoppingItem, InsertTables } from '@/types'

export function useShoppingLists(coupleId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['shopping-lists', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('couple_id', coupleId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as ShoppingList[]
    },
    enabled: !!coupleId,
  })
}

export function useShoppingItems(listId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['shopping-items', listId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('list_id', listId!)
        .order('is_checked')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as ShoppingItem[]
    },
    enabled: !!listId,
  })
}

export function useCreateShoppingList() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (list: InsertTables<'shopping_lists'>) => {
      const { data, error } = await supabase
        .from('shopping_lists')
        .insert(list)
        .select()
        .single()
      if (error) throw error
      return data as unknown as ShoppingList
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
    },
  })
}

export function useCreateShoppingItem() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: InsertTables<'shopping_items'>) => {
      const { data, error } = await supabase
        .from('shopping_items')
        .insert(item)
        .select()
        .single()
      if (error) throw error
      return data as unknown as ShoppingItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-items'] })
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
    },
  })
}

export function useToggleShoppingItem() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_checked, checked_by }: { id: string; is_checked: boolean; checked_by: string }) => {
      const { data, error } = await supabase
        .from('shopping_items')
        .update({
          is_checked,
          checked_by: is_checked ? checked_by : null,
          checked_at: is_checked ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as ShoppingItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-items'] })
    },
  })
}
