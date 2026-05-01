'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Expense, InsertTables, UpdateTables } from '@/types'

interface ExpenseWithCategory extends Expense {
  expense_categories: { name: string; icon: string | null; color: string | null } | null
}

export function useExpenses(coupleId: string | undefined, yearMonth?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['expenses', coupleId, yearMonth],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*, expense_categories(name, icon, color)')
        .eq('couple_id', coupleId!)
        .order('expense_date', { ascending: false })

      if (yearMonth) {
        const startDate = `${yearMonth}-01`
        const [year, month] = yearMonth.split('-').map(Number)
        const nextMonth = month === 12 ? 1 : month + 1
        const nextYear = month === 12 ? year + 1 : year
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
        query = query.gte('expense_date', startDate).lt('expense_date', endDate)
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as ExpenseWithCategory[]
    },
    enabled: !!coupleId,
  })
}

export function useMonthlyExpenseSummary(coupleId: string | undefined, yearMonth: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['expense-summary', coupleId, yearMonth],
    queryFn: async () => {
      const startDate = `${yearMonth}-01`
      const [year, month] = yearMonth.split('-').map(Number)
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_categories(name, icon)')
        .eq('couple_id', coupleId!)
        .gte('expense_date', startDate)
        .lt('expense_date', endDate)
      if (error) throw error

      const expenses = data as unknown as (Expense & { expense_categories: { name: string; icon: string | null } | null })[]
      const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
      const fixed = expenses.filter((e) => e.is_fixed).reduce((sum, e) => sum + Number(e.amount), 0)
      const variable = total - fixed
      const shared = expenses.filter((e) => e.expense_type === 'shared').reduce((sum, e) => sum + Number(e.amount), 0)
      const personal = expenses.filter((e) => e.expense_type === 'personal').reduce((sum, e) => sum + Number(e.amount), 0)

      const byCategory: Record<string, { name: string; icon: string | null; total: number }> = {}
      for (const e of expenses) {
        const catId = e.category_id || 'uncategorized'
        if (!byCategory[catId]) {
          byCategory[catId] = {
            name: e.expense_categories?.name || 'その他',
            icon: e.expense_categories?.icon || null,
            total: 0,
          }
        }
        byCategory[catId].total += Number(e.amount)
      }

      return { total, fixed, variable, shared, personal, byCategory, count: expenses.length }
    },
    enabled: !!coupleId,
  })
}

export function useExpenseHistory(coupleId: string | undefined, months = 12) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['expense-history', coupleId, months],
    queryFn: async () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

      const { data, error } = await supabase
        .from('expenses')
        .select('amount, expense_date')
        .eq('couple_id', coupleId!)
        .gte('expense_date', start.toISOString().slice(0, 10))
        .lt('expense_date', end.toISOString().slice(0, 10))
      if (error) throw error

      return data as Pick<Expense, 'amount' | 'expense_date'>[]
    },
    enabled: !!coupleId,
  })
}

export function useYearExpenseHistory(coupleId: string | undefined, year: number) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['expense-history-year', coupleId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, expense_date, category_id, paid_by, expense_categories(name, icon, color)')
        .eq('couple_id', coupleId!)
        .gte('expense_date', `${year}-01-01`)
        .lt('expense_date', `${year + 1}-01-01`)
      if (error) throw error

      return data as unknown as Array<
        Pick<Expense, 'amount' | 'expense_date' | 'category_id' | 'paid_by'> & {
          expense_categories: { name: string; icon: string | null; color: string | null } | null
        }
      >
    },
    enabled: !!coupleId,
  })
}

export function useCreateExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expense: InsertTables<'expenses'>) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert(expense)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Expense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      queryClient.invalidateQueries({ queryKey: ['expense-history'] })
      queryClient.invalidateQueries({ queryKey: ['expense-history-year'] })
    },
  })
}

export function useUpdateExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'expenses'> & { id: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Expense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      queryClient.invalidateQueries({ queryKey: ['expense-history'] })
      queryClient.invalidateQueries({ queryKey: ['expense-history-year'] })
    },
  })
}

export function useDeleteExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      queryClient.invalidateQueries({ queryKey: ['expense-history'] })
      queryClient.invalidateQueries({ queryKey: ['expense-history-year'] })
    },
  })
}
