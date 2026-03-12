'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Budget, InsertTables } from '@/types'

export function useBudget(coupleId: string | undefined, yearMonth: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['budget', coupleId, yearMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('couple_id', coupleId!)
        .eq('year_month', yearMonth)
        .single()
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
      return data as unknown as Budget | null
    },
    enabled: !!coupleId,
  })
}

export function useCreateBudget() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (budget: InsertTables<'budgets'>) => {
      const { data, error } = await supabase
        .from('budgets')
        .insert(budget)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Budget
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] })
    },
  })
}

export function useUpsertBudgetCategory() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (category: InsertTables<'budget_categories'>) => {
      const { data, error } = await supabase
        .from('budget_categories')
        .upsert(category)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] })
    },
  })
}
