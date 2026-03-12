'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ExpenseCategory, InsertTables } from '@/types'

export function useExpenseCategories(coupleId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['expense-categories', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('couple_id', coupleId!)
        .order('sort_order')
      if (error) throw error
      return data as unknown as ExpenseCategory[]
    },
    enabled: !!coupleId,
  })
}

export function useCreateCategory() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (category: InsertTables<'expense_categories'>) => {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert(category)
        .select()
        .single()
      if (error) throw error
      return data as unknown as ExpenseCategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
    },
  })
}
