'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Budget, BudgetCategory, InsertTables } from '@/types'

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
      if (error && error.code !== 'PGRST116') throw error
      return data as unknown as Budget | null
    },
    enabled: !!coupleId,
  })
}

export interface BudgetCategoryWithDetail extends BudgetCategory {
  expense_categories: { name: string; icon: string | null } | null
}

export function useBudgetCategories(budgetId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['budget-categories', budgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_categories')
        .select('*, expense_categories(name, icon)')
        .eq('budget_id', budgetId!)
      if (error) throw error
      return data as unknown as BudgetCategoryWithDetail[]
    },
    enabled: !!budgetId,
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
      queryClient.invalidateQueries({ queryKey: ['budget-categories'] })
    },
  })
}

export function useSeedBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/seed-budget', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'シードに失敗しました')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] })
      queryClient.invalidateQueries({ queryKey: ['budget-categories'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}
