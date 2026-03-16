'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Income, InsertTables, UpdateTables } from '@/types'

export type IncomeActualRow = Pick<Income, 'amount' | 'income_date' | 'income_type' | 'user_id'>

export function useIncomes(coupleId: string | undefined, yearMonth?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['incomes', coupleId, yearMonth],
    queryFn: async () => {
      let query = supabase
        .from('incomes')
        .select('*')
        .eq('couple_id', coupleId!)
        .order('income_date', { ascending: false })

      if (yearMonth) {
        const startDate = `${yearMonth}-01`
        const [year, month] = yearMonth.split('-').map(Number)
        const nextMonth = month === 12 ? 1 : month + 1
        const nextYear = month === 12 ? year + 1 : year
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
        query = query.gte('income_date', startDate).lt('income_date', endDate)
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as Income[]
    },
    enabled: !!coupleId,
  })
}

export function useIncomeHistory(coupleId: string | undefined, months = 12) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['income-history', coupleId, months],
    queryFn: async () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

      const { data, error } = await supabase
        .from('incomes')
        .select('amount, income_date')
        .eq('couple_id', coupleId!)
        .gte('income_date', start.toISOString().slice(0, 10))
        .lt('income_date', end.toISOString().slice(0, 10))
      if (error) throw error

      return data as Pick<Income, 'amount' | 'income_date'>[]
    },
    enabled: !!coupleId,
  })
}

export function useYearIncomeHistory(coupleId: string | undefined, year: number) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['income-history-year', coupleId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incomes')
        .select('amount, income_date, income_type')
        .eq('couple_id', coupleId!)
        .gte('income_date', `${year}-01-01`)
        .lt('income_date', `${year + 1}-01-01`)
      if (error) throw error

      return data as unknown as Pick<Income, 'amount' | 'income_date' | 'income_type'>[]
    },
    enabled: !!coupleId,
  })
}

export function useIncomeActualsByYears(coupleId: string | undefined, years: number[]) {
  const supabase = createClient()
  const normalizedYears = [...new Set(years)].sort((a, b) => a - b)

  return useQuery({
    queryKey: ['income-actuals-years', coupleId, normalizedYears.join(',')],
    queryFn: async () => {
      const startYear = normalizedYears[0]
      const endYear = normalizedYears[normalizedYears.length - 1]

      const { data, error } = await supabase
        .from('incomes')
        .select('amount, income_date, income_type, user_id')
        .eq('couple_id', coupleId!)
        .gte('income_date', `${startYear}-01-01`)
        .lt('income_date', `${endYear + 1}-01-01`)
        .order('income_date', { ascending: true })
      if (error) throw error

      return data as IncomeActualRow[]
    },
    enabled: !!coupleId && normalizedYears.length > 0,
  })
}

export function useCreateIncome() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (income: InsertTables<'incomes'>) => {
      const { data, error } = await supabase
        .from('incomes')
        .insert(income)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Income
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
      queryClient.invalidateQueries({ queryKey: ['income-history'] })
      queryClient.invalidateQueries({ queryKey: ['income-history-year'] })
    },
  })
}

export function useUpdateIncome() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'incomes'> & { id: string }) => {
      const { data, error } = await supabase
        .from('incomes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Income
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
      queryClient.invalidateQueries({ queryKey: ['income-history'] })
      queryClient.invalidateQueries({ queryKey: ['income-history-year'] })
    },
  })
}

export function useDeleteIncome() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('incomes')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
      queryClient.invalidateQueries({ queryKey: ['income-history'] })
      queryClient.invalidateQueries({ queryKey: ['income-history-year'] })
    },
  })
}
